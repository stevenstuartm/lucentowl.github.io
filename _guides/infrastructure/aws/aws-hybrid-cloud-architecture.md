---
title: "AWS Hybrid Cloud: Outposts, Local Zones, Hybrid Nodes, and Storage Gateway"
layout: guide
category: AWS
subcategory: Migration & Hybrid Cloud
description: "Running workloads that stay on premises or near them with AWS: Outposts racks, Local Zones and Dedicated Local Zones, managing your own servers with Systems Manager, ECS Anywhere, and EKS Hybrid Nodes, bridging storage with Storage Gateway, how each behaves when the link to the Region fails, and how to choose."
tags: [hybrid-cloud, outposts, local-zones, storage-gateway, eks-hybrid-nodes, ecs-anywhere, practical]
---

## Why Workloads Stay Hybrid

A hybrid workload runs partly in an AWS Region and partly somewhere else, usually a data center, a factory, a hospital, or a store. The reasons it stays that way tend to be physical or legal rather than technical preference:

- **Latency to local systems.** A control loop on a factory line, a trading engine next to an exchange, or medical imaging next to its scanners can't wait for a round trip to the nearest Region.
- **Data residency.** Law or contract requires the data to stay in a country, a state, or a building where no Region runs.
- **Data gravity.** Large datasets produced on site cost too much time or bandwidth to move before they are processed.
- **Migration in progress.** Some applications have moved and others haven't, so the two halves still call each other.
- **Recent investment.** Hardware bought last year has years of depreciation left.

Every option below except a standard Local Zone needs a network path from your site back to its Region, over the internet, a Site-to-Site VPN, or Direct Connect depending on the option, and DNS that resolves names across both sides, usually through Route 53 Resolver endpoints. How much each option degrades when that path fails is one of the main differences between them.

---

## Four Ways to Run Hybrid

AWS's hybrid options differ in whose hardware runs the workload and where it sits.

| Option | Whose hardware | Where it runs | What AWS manages |
|---|---|---|---|
| **Local Zones** | AWS's | An AWS facility in a metro area, or for a Dedicated Local Zone, a site the customer chooses | Everything, as in a Region |
| **Outposts** | AWS's, in your building | Your data center or site | The hardware and the AWS services on it |
| **Your servers, managed from AWS** (Systems Manager, ECS Anywhere, EKS Hybrid Nodes) | Yours | Your data center, on your servers or VMs | The control plane and management tooling only |
| **Storage Gateway** | Yours (a VM on your hypervisor), or an EC2 instance | Your site, in front of AWS storage | The storage in AWS, while you run the gateway |

They answer different constraints. If the constraint is distance to users in a city without a Region, a Local Zone solves it without any hardware. If the constraint is that the data or the process must be inside your building, the choice is between AWS-run infrastructure on site (Outposts or a Dedicated Local Zone) and your own hardware managed from AWS. Storage Gateway answers a narrower question, how on-premises applications can keep using file, block, or tape protocols while the data lands in AWS.

---

## Outposts: AWS Hardware on Your Site

An **Outpost** is AWS-owned hardware that AWS delivers, installs, monitors, and maintains at your site, running a subset of AWS services under the same APIs, console, and IAM as the Region. Each Outpost is an extension of one Availability Zone in its **parent Region**. You create subnets on it in an existing VPC, and instances there reach instances in the Region's subnets over private IP addresses in the same VPC.

{% include figure.html id="aws-outposts-service-link" %}

Two network connections define an Outpost. The **service link** connects it to the parent Region, over Direct Connect or the internet, and carries both the management traffic that lets the Region control the Outpost and VPC traffic between the Outpost and the Region. The **local gateway** connects it to your on-premises network, so local systems talk to Outpost workloads without leaving the building.

### Outposts Racks

**Outposts racks** are 42U racks of AWS servers, switches, and power. They run EC2 and EBS, S3 on Outposts, ECS, EKS nodes, RDS, ElastiCache, EMR, and Application Load Balancers. Second-generation racks, generally available since April 2025, run newer EC2 instance families such as M7i, C7i, and R7i. An instance family is a line of instance types with the same balance of CPU and memory, and it matters for capacity planning below. Deployments of four or more compute racks add an ACE rack for network aggregation. A second-generation single-rack Outpost, generally available since September 10, 2026, fits up to 2,688 vCPUs and 100 TB of EBS storage into one self-contained rack for sites short on space.

AWS stopped selling the original **Outposts servers**, 1U and 2U servers for small sites, and is moving existing server customers to racks. The single-rack Outpost is now the small-site option.

### What Happens When the Service Link Fails

An Outpost is managed from its parent Region, so it depends on the service link for anything that changes state. If the link drops, running EC2 instances and their attached EBS volumes keep working and stay reachable locally, and S3 on Outposts keeps serving existing buckets for up to 12 hours. But launching, starting, stopping, and terminating instances may fail, and metrics and logs are cached locally for up to seven days before they can be lost. Keep the service link redundant, and don't build a local process that needs to launch capacity during an outage.

Kubernetes on an Outpost can do more. EKS, which runs on Outposts racks only, runs either as an **extended cluster**, with the control plane in the Region and nodes on the Outpost, or as a **local cluster**, with the control plane itself running on the Outpost. A local cluster keeps scheduling and cluster operations working through a disconnect, which suits sites that must keep changing workloads when the link is down, or that must keep the control plane on site for residency.

### Capacity and Cost

An Outpost has exactly the capacity you ordered, carved into slots of specific instance sizes. There is no spare pool to draw on, so auto scaling stops at the hardware's edge. When a host fails, AWS schedules its replacement, and its instances can restart only on free slots of the same family on the remaining hosts. AWS's guidance is to order at least one spare host's worth of capacity per instance family (N+1) so failed instances have somewhere to go.

Pricing is a commitment for the configuration, with terms of one, three, or five years depending on the configuration, and all, partial, or no upfront payment. At the end of a term, an Outpost you don't return or renew continues month to month at the no-upfront rate. The price covers delivery, installation, maintenance, and patching. Data transfer from the Region to the Outpost is billed on top.

---

## Local Zones: AWS Near Your Users

A **Local Zone** is AWS infrastructure in a metro area, run by AWS in its own facility, that extends a parent Region. You opt in to the zone, create subnets there in a VPC from the parent Region, and launch a subset of services, typically EC2, EBS, ECS, EKS, and a few others, depending on the zone. The control plane stays in the parent Region. There's no charge for enabling a zone, but resources there are priced differently from the parent Region.

Local Zones serve latency to users and residency within the zone's metro, such as real-time gaming, live video, virtual workstations, or a regulator requiring data to stay in a particular state. A standard Local Zone needs no link from your site, since users reach it over the internet or a Direct Connect connection like any Region.

**Dedicated Local Zones** are built for the exclusive use of one customer or community, typically a government or regulated industry, and AWS places them wherever the customer chooses, including the customer's own data center. AWS runs them, with a service set that includes EC2, EBS, S3, VPC, Elastic Load Balancing, ECS, EKS, and Direct Connect, and adds controls over access and operations for sovereignty requirements. Unlike a standard Local Zone, a Dedicated Local Zone on your premises depends on its connection to the parent Region, which AWS manages, and on management services in that Region.

---

## Managing Your Own Servers from AWS

When the hardware on site is yours and should stay yours, AWS can still run the control plane and management tools. Each of these services registers on-premises servers or VMs with a Region, so they appear alongside cloud resources.

- **Systems Manager hybrid nodes.** Installing the SSM Agent with a hybrid activation, an activation code and ID that register a machine outside EC2, turns a server into a managed node for Session Manager, Run Command, Patch Manager, and inventory. Registration itself is free. From September 30, 2026, AWS charges $0.05 per Session Manager session and $0.002 per Run Command invocation on hybrid nodes, and Patch Manager runs are billed as Run Command invocations.
- **ECS Anywhere.** Registers servers as external instances in an ECS cluster, using the SSM Agent to establish trust, for $0.01025 per instance-hour. Running containers survive a lost connection, and task credentials last up to six hours, but the cluster can't scale until the Region is reachable again.
- **EKS Hybrid Nodes.** Joins on-premises machines, physical or virtual, x86 or Arm, as nodes of an EKS cluster whose control plane stays in the Region, billed per vCPU-hour while attached. The on-premises node network must be routable from the cluster's VPC. AWS recommends making the pod network routable too, because without it webhooks must run on cloud nodes and load balancers can't target pods on hybrid nodes. AWS states that Hybrid Nodes need a reliable connection and don't suit disconnected or intermittently connected sites. EKS Anywhere, which runs the whole cluster on your own hardware, is AWS's answer for those.

Workloads on these servers often need to call AWS APIs themselves. **IAM Roles Anywhere** issues temporary AWS credentials to on-premises workloads that present an X.509 certificate from a certificate authority you register, which removes long-lived access keys from on-premises servers.

---

## Storage Gateway: AWS Storage Behind Local Protocols

**AWS Storage Gateway** runs as a VM on your hypervisor (VMware ESXi, Hyper-V, KVM, or Nutanix AHV) or as an EC2 instance, and presents AWS storage to local applications over the protocols they already use. Each gateway is activated in one Region and writes to storage there. The dedicated hardware appliance stopped being sold on May 12, 2025, with support continuing until May 2028 for appliances already in service.

| Gateway | Local protocol | Where the data lands | Typical use |
|---|---|---|---|
| **S3 File Gateway** | NFS or SMB file shares | S3 objects, one per file | File shares, backups, and data feeds that AWS analytics will read |
| **Volume Gateway, cached** | iSCSI block volumes | S3, with frequently used blocks cached locally | Block storage that outgrows local disks |
| **Volume Gateway, stored** | iSCSI block volumes | Kept fully on site, with snapshots in AWS as EBS snapshots | Local block storage with off-site backup |
| **Tape Gateway** | A virtual tape library for backup software | Virtual tapes in S3, archived to S3 Glacier Flexible Retrieval or Deep Archive | Replacing physical tape |

Most gateway types keep a local disk cache, so recently used data is served at local speed while the full dataset lives in AWS. Amazon FSx File Gateway, which fronted FSx for Windows File Server, closed to new customers on October 28, 2024.

### How S3 File Gateway Behaves

S3 File Gateway acknowledges a write once it lands in the local cache, then uploads it to S3 in the background. When the cache fills, it evicts the least recently used data. Two consequences follow. A file written on premises appears in S3 only after its upload finishes, so a pipeline triggered by the S3 object sees it later than the writer does. And the gateway doesn't notice objects that other applications write straight to the bucket until something calls the `RefreshCache` API.

The gateway provides no locking or coherency across gateways, so several gateways, or a gateway plus other applications, writing to one bucket produce unpredictable results. AWS recommends one writer per bucket, with other gateways mounting it read-only.

A gateway that can't reach its Storage Gateway service endpoints shows as offline, so it depends on its link to the Region like the other options here.

### What Storage Gateway Costs

Beyond the storage it creates (S3 objects, EBS snapshots, or virtual tapes at their usual rates), Storage Gateway charges per GB of data written to AWS, capped at $125 per gateway per month, with the first 100 GB per account free. The gateway VM itself runs on your hardware at no AWS charge.

---

## Choosing Among Them

Most hybrid decisions resolve with a few questions in order:

1. **Can the workload run in a Region, or in a Local Zone near its users?** If so, do that. Anything on site costs more to run and depends on a network link.
2. **Must the compute sit in your building?** If so, decide whose hardware. Outposts and Dedicated Local Zones put AWS-run infrastructure on site with the Region's services and APIs, at a committed price. Your own servers can be managed from AWS instead, billed per instance-hour (ECS Anywhere), per vCPU-hour (EKS Hybrid Nodes), or per use (Systems Manager).
3. **Must the site keep working, and keep changing, when the Region is unreachable?** Outposts keeps running EC2 workloads alive through a disconnect, and an EKS local cluster on an Outpost keeps scheduling too. With ECS Anywhere and EKS Hybrid Nodes, running work continues but scheduling and scaling stop until the link returns. A site that must run for long stretches with no link on its own hardware needs something that runs entirely locally, such as EKS Anywhere. Snowball Edge devices, once the portable answer for disconnected sites, closed to new customers on November 7, 2025.
4. **Is the need only storage?** If local applications just need somewhere cheap and durable to put files, blocks, or tapes, Storage Gateway solves it without moving the applications.

---

## Common Pitfalls

- **Ordering an Outpost with no spare capacity.** Without N+1 slots per instance family, a single host failure leaves its instances down until AWS replaces the hardware.
- **Several writers on one S3 File Gateway bucket.** Without cross-gateway locking, two sites writing the same share overwrite each other. Keep one writer per bucket.
- **Pipelines that assume a saved file is already in S3.** File Gateway uploads in the background, so jobs triggered from S3 run later than the write, and jobs reading S3 directly can miss recent files.
- **An unroutable pod network on EKS Hybrid Nodes.** Webhooks and load balancer targets then have to run in the cloud, which surprises teams that expected every workload to run on site.
- **Long-lived keys on on-premises servers.** Use IAM Roles Anywhere or the credentials Systems Manager provides to managed nodes, not access keys in configuration files.

---

## Key Takeaways

- Workloads stay hybrid for latency, residency, data gravity, an unfinished migration, or recent hardware, and every option except a standard Local Zone depends on a network path from its site to the Region.
- Local Zones bring AWS-run infrastructure to a metro area, and Dedicated Local Zones to a site the customer chooses. Outposts racks put AWS-owned hardware in your building as an extension of one Availability Zone. They keep running workloads alive without the service link, and an EKS local cluster keeps scheduling too.
- Order Outposts capacity as N+1 per instance family, since there is no pool beyond the hardware you bought.
- Systems Manager, ECS Anywhere, and EKS Hybrid Nodes manage your own servers from a Region and need a reliable connection. IAM Roles Anywhere gives on-premises workloads temporary credentials.
- Storage Gateway fronts S3, EBS snapshots, and Glacier with file, block, and tape protocols. S3 File Gateway uploads asynchronously and supports one writer per bucket.
