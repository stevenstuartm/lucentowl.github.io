---
title: "Azure Managed Disks & Azure Files"
layout: guide
category: Azure
subcategory: Storage Services
description: "Managed Disks and Azure Files fundamentals for architects including disk types, performance tiers, shared disks, Azure Files SMB and NFS shares, Azure NetApp Files, and block and file storage patterns on Azure."
tags: [infrastructure, azure, cloud-computing, reliability, performance, cost-analysis, practical]
---

## What Are Azure Managed Disks and Azure Files

[Azure Managed Disks](https://learn.microsoft.com/en-us/azure/virtual-machines/managed-disks-overview){:target="_blank" rel="noopener noreferrer"} are block-level storage volumes managed by Azure and used with Azure Virtual Machines. They replace the older "unmanaged disks" model where administrators had to manage storage accounts, calculate capacity limits, and handle storage account distribution manually. Every new VM deployment should use managed disks.

[Azure Files](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-introduction){:target="_blank" rel="noopener noreferrer"} provides fully managed file shares in the cloud, accessible via the Server Message Block (SMB 3.x) protocol, the Network File System (NFS 4.1) protocol, and the Azure Files REST API. Azure file shares can be mounted concurrently by cloud and on-premises deployments of Windows, Linux, and macOS.

These two services address different storage needs. Managed disks are block storage volumes attached to individual VMs (or shared across clustered VMs). Azure Files is shared file storage accessible by many clients simultaneously over standard network file system protocols.

### What Problems Managed Disks and Azure Files Solve

**Without Managed Disks:**
- Administrators manually create and manage storage accounts for VM disks
- Storage account IOPS and throughput limits must be tracked and balanced across VMs
- Disk availability depends on storage account replication settings configured by the administrator
- Snapshots and backups require custom storage account management
- No availability zone support for block storage

**With Managed Disks:**
- Azure handles storage account placement, replication, and capacity management transparently
- Each disk has its own performance profile independent of other disks
- Zone-redundant storage (ZRS) options provide cross-zone durability
- Integrated snapshot, image, and backup capabilities
- Encryption at rest enabled by default with platform-managed or customer-managed keys

**Without Azure Files:**
- Teams deploy and manage Windows file servers or Linux NFS servers on VMs
- Shared storage for applications requires configuring clustering, replication, and failover manually
- On-premises file servers lack cloud integration for hybrid scenarios
- File share backup and disaster recovery require separate infrastructure

**With Azure Files:**
- Fully managed file shares with no server infrastructure to maintain
- SMB and NFS protocol support for cross-platform access
- Identity-based authentication through Entra ID and on-premises Active Directory
- Azure File Sync bridges on-premises file servers with cloud storage
- Integrated backup through Azure Backup with share-level snapshots

### How These Services Differ from AWS

| Concept | AWS | Azure |
|---------|-----|-------|
| **Block storage for VMs** | EBS (Elastic Block Store) | Managed Disks |
| **High-performance block storage** | io2 Block Express (up to 256K IOPS) | Ultra Disk / Premium SSD v2 (up to 160K IOPS per disk) |
| **General purpose SSD** | gp3 | Premium SSD (P-series) |
| **Throughput-optimized HDD** | st1 | Standard HDD |
| **Managed NFS file shares** | EFS (Elastic File System) | Azure Files (NFS) or Azure NetApp Files |
| **Managed SMB file shares** | FSx for Windows File Server | Azure Files (SMB) |
| **Enterprise NAS** | FSx for NetApp ONTAP | Azure NetApp Files |
| **Shared block storage** | io2 Multi-Attach | Shared Disks (Premium SSD / Ultra Disk) |
| **Ephemeral OS storage** | Instance store | Ephemeral OS Disks (VM cache or temp disk) |
| **Block storage snapshots** | EBS Snapshots (incremental, S3-backed) | Managed Disk Snapshots (incremental) |
| **File share sync to on-premises** | No native equivalent | Azure File Sync |

<div class="callout callout--note">
<p class="callout__title">Pricing Model Difference</p>
<p>AWS EBS gp3 provides a baseline of 3,000 IOPS and 125 MB/s included at any volume size, with independent scaling of IOPS and throughput. Azure Premium SSD ties performance to disk size (a P30 1-TiB disk gets 5,000 IOPS; a P10 128-GiB disk gets 500 IOPS). Azure Premium SSD v2 and Ultra Disk allow independent IOPS/throughput/size tuning similar to gp3 and io2, but standard Premium SSD does not.</p>
</div>

---

## Azure Managed Disks

### Managed Disks Fundamentals

A managed disk is a virtual hard disk (VHD) stored as page blobs in Azure Storage, but with the storage account entirely abstracted away. Azure manages the underlying storage infrastructure, handles replication, and provides integrated features like snapshots, encryption, and RBAC access control.

Before managed disks, Azure VMs used "unmanaged disks" stored as VHD files in storage accounts that administrators created and managed directly. This required careful planning around storage account limits (20,000 IOPS per standard storage account), distribution of VHDs across multiple accounts to avoid throttling, and manual management of the underlying storage.

Managed disks eliminated all of this complexity. There is no reason to use unmanaged disks for new deployments, and Microsoft recommends migrating existing unmanaged disks to managed disks.

### Disk Roles

Every VM has at least one managed disk serving as the OS disk, and can optionally have data disks and a temporary disk.

**OS Disk:** Required for every VM. Contains the operating system and boot partition. Maximum size is 4 TiB (4,095 GiB). Registered as a SATA drive. By default, the OS disk uses ReadWrite host caching for faster boot and OS operations. The OS disk persists across VM stop-deallocate operations.

**Data Disks:** Optional disks for application data, databases, or any storage that should be kept separate from the OS. Maximum size per disk is 32,767 GiB. The number of data disks a VM can attach depends on the VM size (ranging from 2 disks on small VMs to 64 or more on large VMs). Data disks persist across VM stop-deallocate operations.

**Temporary Disk:** Most VM sizes include a temporary disk that provides short-term, low-latency storage directly on the physical host. This disk is not a managed disk and has no durability guarantee. Data on the temporary disk is lost during maintenance events, VM redeployment, or stop-deallocate operations. It is appropriate for scratch data like page files, swap files, or temporary application caches. The temporary disk is free (included with the VM).

<div class="callout callout--tip">
<p class="callout__title">Temporary Disk Warning</p>
<p>Never store application data, database files, or anything that cannot be regenerated on the temporary disk. It is truly ephemeral. VM sizes with a "d" in the name (like Standard_D4s_v5) have a local temporary disk; sizes without "d" (like Standard_E4s_v5) may not.</p>
</div>

### Disk Types

Azure offers five managed disk types optimized for different workload characteristics.

| Disk Type | Max IOPS (per disk) | Max Throughput (per disk) | Max Size | Latency | Best For |
|-----------|-------------------|-------------------------|----------|---------|----------|
| **Ultra Disk** | 160,000 | 4,000 MiB/s | 65,536 GiB | Sub-millisecond | SAP HANA, top-tier databases, transaction-heavy workloads |
| **Premium SSD v2** | 80,000 | 1,200 MiB/s | 65,536 GiB | Sub-millisecond | Production databases, latency-sensitive workloads needing flexible tuning |
| **Premium SSD** | 20,000 | 900 MiB/s | 32,767 GiB | Single-digit millisecond | Production VMs, web servers, medium databases |
| **Standard SSD** | 6,000 | 750 MiB/s | 32,767 GiB | Single-digit millisecond | Web servers, dev/test, lightly used applications |
| **Standard HDD** | 2,000 | 500 MiB/s | 32,767 GiB | Higher | Backup, disaster recovery, infrequent access |

#### Ultra Disk

[Ultra Disks](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-types#ultra-disks){:target="_blank" rel="noopener noreferrer"} deliver the highest performance available on Azure. They allow you to independently set disk size, IOPS (up to 160,000), and throughput (up to 4,000 MiB/s), and you can dynamically adjust these parameters without detaching the disk or stopping the VM. This flexibility makes Ultra Disks suitable for data-intensive workloads like SAP HANA, top-tier SQL Server deployments, and high-frequency transaction processing.

Ultra Disks have some constraints. They are not available in all regions or with all VM sizes. They cannot be used as OS disks. They do not support disk snapshots, VM images, availability sets, or Azure Site Recovery. These constraints mean Ultra Disks are typically reserved for data disks on workloads that genuinely require sub-millisecond latency at very high IOPS.

#### Premium SSD v2

[Premium SSD v2](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-types#premium-ssd-v2){:target="_blank" rel="noopener noreferrer"} bridges the gap between Ultra Disk and standard Premium SSD. Like Ultra Disk, it allows independent tuning of IOPS, throughput, and size. Unlike Ultra Disk, it supports snapshots, has broader region availability, and costs significantly less for equivalent performance.

Premium SSD v2 provides a baseline of 3,000 IOPS and 125 MiB/s included with any disk size, with the ability to scale up independently. This pricing model is similar to AWS gp3, making it a natural default choice for production workloads that need predictable performance without paying for a fixed disk-size-to-performance ratio.

Premium SSD v2 cannot be used as OS disks and does not support host caching. It is designed for data disks on production database servers, analytics workloads, and applications that benefit from decoupled performance tuning.

#### Premium SSD

[Premium SSD](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-types#premium-ssds){:target="_blank" rel="noopener noreferrer"} (P-series) is the most commonly used disk type for production VMs. Performance is tied to the provisioned disk size: larger disks get more IOPS and throughput. A P10 (128 GiB) disk provides 500 IOPS and 100 MiB/s, while a P50 (4 TiB) disk provides 7,500 IOPS and 250 MiB/s.

This coupling of size to performance means that architects sometimes over-provision disk size to get higher IOPS, paying for capacity they do not need. Premium SSD v2 addresses this problem by decoupling the three dimensions.

Premium SSD supports host caching (ReadOnly and ReadWrite), can be used for OS disks, supports snapshots and images, and is available with zone-redundant storage (ZRS). It is the default recommendation for production workloads that do not require the independent tuning of v2 or Ultra Disk.

#### Standard SSD

Standard SSD provides SSD-backed performance at a lower cost than Premium SSD. It is suitable for web servers, development and test environments, and lightly used production workloads where consistent low latency is desirable but high IOPS are not required. Standard SSD supports ZRS for cross-zone durability.

#### Standard HDD

Standard HDD is the lowest-cost managed disk option, backed by traditional spinning hard drives. It is appropriate for backup and archival storage, disaster recovery volumes that are rarely accessed, and non-critical batch workloads where latency is acceptable.

### Ephemeral OS Disks

[Ephemeral OS Disks](https://learn.microsoft.com/en-us/azure/virtual-machines/ephemeral-os-disks){:target="_blank" rel="noopener noreferrer"} use the VM's local (cache or temporary) storage for the OS disk instead of a remote managed disk. The OS disk is created on the local host when the VM starts and is destroyed when the VM is deallocated.

**Advantages:**
- Faster VM boot and reimage times (local storage eliminates network latency)
- No storage cost for the OS disk (uses the VM's included cache or temp storage)
- Lower read/write latency for OS operations
- VM reimage resets the OS disk to its original state instantly

**Trade-offs:**
- All OS disk data is lost on stop-deallocate, VM redeployment, or host maintenance
- Disk size is limited by the VM's cache or temp disk size
- Not suitable for VMs that store state on the OS disk
- No support for disk snapshots of ephemeral OS disks

Ephemeral OS disks are ideal for stateless workloads like web servers in a scale set, container hosts, and batch processing nodes where the OS disk is disposable and application data lives on separate data disks or external storage.

### Disk Performance

#### Bursting

Managed disks support [bursting](https://learn.microsoft.com/en-us/azure/virtual-machines/disk-bursting){:target="_blank" rel="noopener noreferrer"} to temporarily exceed their provisioned IOPS and throughput limits, handling spikes without requiring permanent over-provisioning.

**Credit-based bursting** is available on Premium SSD disks P20 (512 GiB) and smaller. The disk accumulates burst credits during periods of low activity and spends them during spikes. Credits accumulate up to a maximum burst of 3,500 IOPS and 170 MiB/s. Credit-based bursting is free and enabled by default.

**On-demand bursting** is available on Premium SSD disks larger than P20. It allows bursting beyond the provisioned performance without a credit model, sustained for as long as needed. On-demand bursting incurs an additional flat enablement charge plus per-burst-transaction charges when the disk exceeds its provisioned performance. This model is useful for workloads with unpredictable, sustained spikes like batch processing or seasonal traffic surges.

#### Host Caching

Azure VMs provide a [host cache](https://learn.microsoft.com/en-us/azure/virtual-machines/premium-storage-performance#disk-caching){:target="_blank" rel="noopener noreferrer"} that sits between the VM and the managed disk, using the local SSD and memory on the physical host.

| Cache Setting | Behavior | Best For |
|---------------|----------|----------|
| **ReadOnly** | Reads served from host cache; writes go directly to disk | Data disks with read-heavy workloads like database data files |
| **ReadWrite** | Reads and writes served from host cache; writes flushed to disk asynchronously | OS disks (default), workloads tolerant of small data loss on host failure |
| **None** | No caching; all I/O goes directly to the managed disk | Write-heavy workloads like database log files, workloads requiring write consistency |

**Best practices for host caching:**
- Use ReadOnly for database data files where reads dominate and write consistency matters
- Use None for database transaction log files where every write must be durable immediately
- Use ReadWrite only for OS disks; the small risk of data loss during host failure is acceptable for OS data
- Premium SSD v2 and Ultra Disk do not support host caching (their sub-millisecond latency makes it unnecessary)

<div class="callout callout--note">
<p class="callout__title">VM-Level Performance Caps</p>
<p>Each VM size has its own maximum IOPS and throughput limits that cap the combined performance of all attached disks. A Standard_D8s_v5 VM supports up to 12,800 uncached IOPS regardless of how many disks are attached. When designing storage layouts, check both the disk limits and the VM limits to avoid a bottleneck at the VM level.</p>
</div>

### Shared Disks

[Shared disks](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-shared){:target="_blank" rel="noopener noreferrer"} allow a single managed disk to be attached to multiple VMs simultaneously. This is the Azure equivalent of AWS io2 Multi-Attach and is designed for clustered applications that manage concurrent access through a cluster-aware file system or application protocol.

**Supported disk types:** Premium SSD and Ultra Disk (Standard SSD and Standard HDD do not support sharing).

**Use cases:**
- SQL Server Failover Cluster Instances (FCI) using Windows Server Failover Clustering (WSFC)
- SAP ASCS/SCS high-availability clusters
- Clustered file servers using Scale-Out File Server (SOFS)
- Any application with built-in cluster coordination like SCSI Persistent Reservations (SCSI PR)

**Requirements:**
- The application or cluster software must handle concurrent I/O coordination (Azure does not arbitrate access)
- The cluster nodes must use SCSI PR or an equivalent fencing mechanism to prevent data corruption
- The maximum number of VMs sharing a disk depends on the disk type (up to 10 for Premium SSD, up to 5 for Ultra Disk in most configurations)

Shared disks are not a general-purpose shared storage solution. They require cluster-aware software to manage access. For general shared file access, use Azure Files instead.

### Disk Encryption

Azure provides multiple encryption layers for managed disks, all encrypting data at rest.

**Server-Side Encryption (SSE):** Enabled by default on all managed disks. Data is encrypted transparently before being written to the physical storage media. By default, Azure uses [platform-managed keys](https://learn.microsoft.com/en-us/azure/virtual-machines/disk-encryption){:target="_blank" rel="noopener noreferrer"} (PMK), but you can switch to customer-managed keys (CMK) stored in Azure Key Vault for greater control over key rotation and access policies.

**Azure Disk Encryption (ADE):** Uses BitLocker (Windows) or DM-Crypt (Linux) to encrypt the OS and data disks from within the guest OS. ADE protects data at the VM level, meaning the encryption is visible to the guest OS and can be enforced by Azure Policy. ADE requires Azure Key Vault to store the encryption keys.

**Encryption at Host:** Encrypts data on the VM host itself before it reaches the Azure Storage infrastructure. This covers the temporary disk and disk caches, which SSE alone does not protect. Encryption at host must be enabled at the VM level.

**Double Encryption:** Combines platform-managed SSE with either customer-managed SSE or ADE, providing two layers of encryption with two different keys. This addresses compliance scenarios requiring double encryption at rest.

For most workloads, the default SSE with platform-managed keys provides sufficient protection. Organizations with regulatory requirements typically add customer-managed keys (for key control) or ADE (for guest-level enforcement). Encryption at host is recommended when temporary disk or cache data sensitivity is a concern.

### Snapshots and Images

**Incremental Snapshots:** [Incremental snapshots](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-incremental-snapshots){:target="_blank" rel="noopener noreferrer"} capture only the blocks that changed since the previous snapshot. They are significantly cheaper and faster to create than full snapshots. Incremental snapshots are stored as managed disks themselves and can be used to create new managed disks. They are the recommended approach for regular backup and point-in-time recovery.

**Full Snapshots:** Capture the entire contents of a disk at a point in time. Full snapshots cost more because they store all data, not just changes. They are useful for creating a baseline before a major change or for copying a disk to another region.

**VM Images:** You can capture a generalized VM (one that has been sysprepped on Windows or deprovisioned on Linux) as an image in the [Azure Compute Gallery](https://learn.microsoft.com/en-us/azure/virtual-machines/azure-compute-gallery){:target="_blank" rel="noopener noreferrer"} (formerly Shared Image Gallery). Images include the OS disk and all data disks, versioned and replicated across regions for consistent VM deployments.

### Disk Availability

**Zone-Redundant Storage (ZRS):** Available for Premium SSD and Standard SSD, ZRS replicates the managed disk synchronously across three availability zones within a region. If a zone fails, a ZRS disk remains accessible from another zone. ZRS disks cost more than locally redundant (LRS) disks but provide cross-zone durability without relying on snapshots for zone failure protection.

**Locally Redundant Storage (LRS):** The default for all disk types. LRS replicates data three times within a single data center. If the entire availability zone fails, LRS disks in that zone become unavailable.

**Availability Zones and Disk Placement:** LRS managed disks are pinned to a specific availability zone (or no zone). A zonal VM in Zone 1 can only attach LRS disks in Zone 1. ZRS disks can be attached to VMs in any zone within the region, simplifying failover scenarios.

---

## Azure Files

### Azure Files Fundamentals

[Azure Files](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-introduction){:target="_blank" rel="noopener noreferrer"} provides fully managed file shares hosted in Azure Storage accounts. File shares are accessible via SMB 3.x (port 445), NFS 4.1, or the Azure Files REST API. From the client perspective, an Azure file share looks and behaves like any other network file share, mountable as a drive letter on Windows or a mount point on Linux and macOS.

Azure Files eliminates the need to deploy and manage file server VMs. Azure handles the underlying infrastructure including replication, patching, capacity management, and availability. File shares scale to 100 TiB per share without capacity planning or manual intervention.

### Storage Account Considerations

Azure file shares live within [Azure Storage accounts](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-overview){:target="_blank" rel="noopener noreferrer"}. The storage account type determines the available tiers and features.

| Storage Account Type | Supported Tiers | Protocols | Redundancy Options |
|---------------------|----------------|-----------|-------------------|
| **General-purpose v2 (GPv2)** | Transaction optimized, Hot, Cool | SMB, REST | LRS, ZRS, GRS, GZRS |
| **FileStorage (Premium)** | Premium | SMB, NFS | LRS, ZRS |

Premium file shares require a FileStorage storage account (not a standard GPv2 account). Standard file shares use GPv2 accounts. You cannot mix premium and standard shares in the same storage account.

### Tiers

**Premium (SSD-backed):** Provisioned performance model where you specify the share size and receive guaranteed IOPS and throughput based on that size. Premium shares provide single-digit millisecond latency for most operations. They support both SMB and NFS protocols. Premium shares are ideal for databases, development environments, and latency-sensitive applications that need consistent performance.

**Transaction Optimized (Standard):** The default standard tier, optimized for transaction-heavy workloads like file shares used by applications, team collaboration, and content management. Priced with a lower storage cost but higher transaction cost compared to Hot.

**Hot (Standard):** Balanced between storage cost and transaction cost. Appropriate for general-purpose file sharing and team collaboration scenarios.

**Cool (Standard):** Lower storage cost with higher transaction and data retrieval costs. Suited for online archive storage, regulatory data, and files that are stored long-term but accessed infrequently.

<div class="callout callout--tip">
<p class="callout__title">Tier Selection</p>
<p>Standard tiers (Transaction Optimized, Hot, Cool) can be changed on existing shares without downtime or data movement. Start with Transaction Optimized for new workloads, monitor usage patterns, then switch to Hot or Cool if appropriate. Premium shares cannot be converted to Standard and vice versa because they require different storage account types.</p>
</div>

### SMB vs NFS

Azure Files supports two network file system protocols, but they cannot be mixed on the same share.

| Aspect | SMB (3.x) | NFS (4.1) |
|--------|-----------|-----------|
| **Platform support** | Windows, Linux, macOS | Linux, macOS (not natively Windows) |
| **Authentication** | Entra ID Kerberos, on-premises AD DS, storage account key | No identity-based authentication (network-level controls only) |
| **Encryption in transit** | SMB encryption (AES-128/256) | Not supported natively (use VPN or Private Endpoints for security) |
| **Available tiers** | Premium and all Standard tiers | Premium only |
| **Port** | 445 | 2049 |
| **POSIX permissions** | No (uses Windows ACLs via NTFS semantics) | Yes |
| **Use cases** | Windows workloads, hybrid file shares, identity-integrated access | Linux workloads, container persistent volumes, POSIX-compatible applications |

NFS shares on Azure Files require the Premium tier (FileStorage account). NFS shares do not support identity-based authentication; access is controlled through Virtual Network rules and Private Endpoints. For Linux workloads that need identity-based access control, consider Azure NetApp Files or deploying an NFS server with Kerberos.

<div class="callout callout--note">
<p class="callout__title">Port 445 and ISP Blocking</p>
<p>Many internet service providers block port 445 (SMB) for security reasons. Mounting an Azure SMB file share over the public internet may fail if the client's ISP blocks this port. For reliable access from on-premises or home networks, use Azure VPN Gateway, ExpressRoute, or Azure Private Endpoints to route SMB traffic over a private connection. See the <a href="/study-guides/infrastructure/azure/azure-expressroute-vpn.html">ExpressRoute & VPN Gateway</a> guide for connectivity options.</p>
</div>

### Identity-Based Access for SMB Shares

Azure Files supports identity-based authentication for SMB shares, allowing organizations to apply familiar Windows-style permissions to cloud file shares.

**Entra ID Kerberos Authentication:** Enables Entra ID (Azure AD) joined or hybrid-joined clients to authenticate to Azure file shares using their Entra ID credentials. This works for cloud-only identities without requiring line-of-sight to a domain controller. Users authenticate with their cloud identity, and share-level permissions are managed through Azure RBAC roles.

**On-Premises Active Directory DS Integration:** Azure Files can be joined to an on-premises Active Directory domain. Users authenticate using their AD DS credentials, and administrators apply the same share-level and NTFS file-level permissions they use for on-premises file servers. This model supports lift-and-shift migration of file server workloads.

**Permission Model (SMB):**
- **Share-level permissions:** Controlled through Azure RBAC roles like Storage File Data SMB Share Reader, Contributor, and Elevated Contributor. These roles determine whether a user can access the share at all.
- **File/folder-level permissions:** Standard Windows NTFS permissions (read, write, modify, full control) applied at the directory and file level using Windows Explorer or command-line tools.

Both layers apply. A user needs the appropriate RBAC role at the share level AND the correct NTFS permissions at the file/folder level to access data.

### Azure File Sync

[Azure File Sync](https://learn.microsoft.com/en-us/azure/storage/file-sync/file-sync-introduction){:target="_blank" rel="noopener noreferrer"} extends Azure Files to on-premises Windows file servers, providing a centralized file share in Azure while maintaining local access performance.

**How it works:**
- Install the Azure File Sync agent on one or more Windows Server machines
- Register the server with the Storage Sync Service in Azure
- Create sync groups that define the relationship between the Azure file share (cloud endpoint) and the server path (server endpoint)
- Files synchronize bidirectionally between the cloud share and the local server

**Cloud Tiering:** The defining feature of Azure File Sync. Cloud tiering automatically moves infrequently accessed files from the local server to the Azure file share, replacing them with lightweight placeholder files that look like the original files in the file system. When a user or application accesses a tiered file, Azure File Sync transparently recalls it from Azure. Frequently accessed files remain fully cached on the local server.

This creates an effective hot/cold tiering model where the local server acts as a cache for the most-used data while the full dataset resides in Azure Files. Organizations can reduce local storage requirements significantly while maintaining the perception of a complete local file server.

**Multi-Site Sync:** Multiple on-premises servers can sync to the same Azure file share, enabling branch office scenarios where each location has a local cache of the same centralized data. Changes made at one location propagate through Azure to all other registered servers.

**Use cases:**
- Branch office file server consolidation (centralize in Azure, cache locally at each branch)
- Lift-and-shift of on-premises file servers to Azure while maintaining local access during transition
- Disaster recovery for file servers (Azure Files becomes the durable copy)
- Reducing local storage hardware by tiering cold data to Azure

### Azure Files Backup

Azure Files integrates with [Azure Backup](https://learn.microsoft.com/en-us/azure/backup/azure-file-share-backup-overview){:target="_blank" rel="noopener noreferrer"} for share-level snapshot management and point-in-time restore.

**Share Snapshots:** Azure Files supports read-only snapshots of the entire file share at a specific point in time. Snapshots are incremental (only changes since the last snapshot are stored). Individual files or the entire share can be restored from a snapshot.

**Azure Backup Integration:** Azure Backup orchestrates snapshot creation on a schedule, manages retention policies, and provides a centralized dashboard for backup monitoring. Backup policies can define daily, weekly, monthly, and yearly retention with configurable retention periods.

**Point-in-Time Restore:** Standard file shares (Transaction Optimized, Hot, Cool) support point-in-time restore, which allows restoring the share to any point within a configurable retention period (up to 30 days) without relying on individual snapshots.

### Azure Files Networking

Azure file shares are accessible through the storage account's public endpoint by default, but production deployments typically restrict access using private networking.

**Private Endpoints:** Create a [Private Endpoint](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints){:target="_blank" rel="noopener noreferrer"} for the storage account to assign it a private IP address within your VNet. All SMB and NFS traffic then flows over the private network without traversing the public internet. Private Endpoints work across VNet peering and VPN/ExpressRoute connections, enabling on-premises access to Azure Files over private links. See the [Private Link & Virtual WAN](/study-guides/infrastructure/azure/azure-private-link-virtual-wan.html) guide for architecture patterns.

**Service Endpoints:** A lower-cost alternative to Private Endpoints that routes traffic over the Azure backbone but does not assign a private IP. The storage account's public endpoint remains active. Service endpoints restrict access to specific VNet subnets but do not support on-premises access.

**Firewall Rules:** The storage account firewall can restrict access to specific VNet subnets, IP ranges, or Private Endpoints. For production deployments, disable public endpoint access and route all traffic through Private Endpoints.

---

## Azure NetApp Files

[Azure NetApp Files](https://learn.microsoft.com/en-us/azure/azure-netapp-files/azure-netapp-files-introduction){:target="_blank" rel="noopener noreferrer"} is an enterprise-grade, fully managed NAS service powered by NetApp ONTAP technology. It provides sub-millisecond latency, high throughput, and advanced data management features for demanding workloads.

### How It Works

Azure NetApp Files uses a capacity pool model. You provision a capacity pool with a service level (Standard, Premium, or Ultra) that determines the throughput per TiB. Within a pool, you create volumes (NFS, SMB, or dual-protocol) that consume capacity from the pool. Volumes are deployed into delegated subnets within your VNet.

### When to Use Azure NetApp Files vs Azure Files

| Factor | Azure Files | Azure NetApp Files |
|--------|-------------|-------------------|
| **Latency** | Single-digit millisecond (Premium), higher for Standard | Sub-millisecond |
| **Max throughput per share** | Up to 10 GiB/s (Premium, large shares) | Up to 4,500 MiB/s per volume |
| **Protocol support** | SMB 3.x, NFS 4.1, REST | NFS 3/4.1, SMB 3.x, dual-protocol |
| **Advanced NAS features** | Basic snapshots, backup | ONTAP snapshots, cloning, cross-region replication, SnapMirror |
| **Identity integration** | Entra ID Kerberos, AD DS | AD DS, LDAP |
| **Minimum commitment** | Pay-as-you-go (Standard), provisioned size (Premium) | Minimum 2-TiB capacity pool |
| **Cost** | Lower | Higher (significant minimum commitment) |
| **Best for** | General file sharing, hybrid sync, cost-sensitive workloads | SAP, Oracle, high-performance Linux workloads, media rendering |

Azure NetApp Files is the right choice when workloads require sub-millisecond latency, advanced NAS features like volume cloning and cross-region replication, or compatibility with on-premises NetApp environments. For general file sharing, hybrid sync scenarios, and cost-sensitive workloads, Azure Files is more appropriate.

---

## Storage Selection Framework

Choosing between Managed Disks, Azure Files, and Azure Blob Storage depends on the access pattern, protocol requirements, sharing model, and performance needs.

| Factor | Managed Disks | Azure Files | Blob Storage |
|--------|--------------|-------------|-------------|
| **Access pattern** | Single VM (or clustered with shared disks) | Multiple clients via SMB/NFS | Application code via REST/SDK |
| **Protocol** | Block device (mounted as disk) | SMB 3.x, NFS 4.1, REST | REST, SDK, Data Lake Storage Gen2 |
| **Sharing** | Single VM attachment (shared disks for clusters) | Thousands of concurrent clients | Unlimited concurrent clients via REST |
| **Performance** | Up to 160K IOPS, sub-millisecond latency | Up to 100K IOPS (Premium), single-digit ms | Varies by tier and access pattern |
| **Maximum size** | 64 TiB per disk | 100 TiB per share | 5 PiB per account |
| **Persistence** | Independent of VM lifecycle | Independent of any VM | Independent of compute |
| **Cost model** | Per-GiB provisioned + performance tier | Per-GiB used (Standard) or provisioned (Premium) + transactions | Per-GiB stored + transactions + retrieval |

### Decision Guide

**Use Managed Disks when:**
- The workload is a database, application server, or any VM that needs dedicated block storage
- Performance requirements demand high IOPS and sub-millisecond latency on a per-VM basis
- The workload pattern is single-VM attachment (or failover clustering with shared disks)
- You need OS disks for VMs (managed disks are the only option)

**Use Azure Files when:**
- Multiple clients or services need concurrent access to the same file data
- The workload uses SMB or NFS protocols natively (Windows file shares, Linux NFS mounts)
- You need hybrid cloud file access with Azure File Sync for on-premises caching
- Containers or serverless functions need shared persistent storage
- You need identity-based access control with Entra ID or Active Directory

**Use Blob Storage when:**
- The workload accesses data through application code using REST APIs or SDKs
- Data is unstructured (images, videos, documents, logs, backups)
- You need lifecycle management to automatically move data between hot, cool, cold, and archive tiers
- The data volume is massive (petabyte-scale) and cost optimization is a priority

---

## Architecture Patterns

### Pattern 1: Production VM with Tiered Disk Layout

```
VM (Standard_D16s_v5)
├── OS Disk: Premium SSD P30 (1 TiB) - ReadWrite cache
├── Data Disk 1: Premium SSD v2 (500 GiB, 10,000 IOPS) - ReadOnly cache - App data
├── Data Disk 2: Premium SSD v2 (200 GiB, 5,000 IOPS) - None cache - Transaction logs
└── Temporary Disk: Used for page file and temp data (included with VM)
```

Separating database data files and log files onto different disks with different caching policies optimizes I/O patterns. Data files benefit from ReadOnly caching for read-heavy access. Log files require None caching to ensure write durability.

### Pattern 2: SQL Server Failover Cluster with Shared Disks

```
VM 1 (Node A) ─┐
                ├── Shared Premium SSD (data) ── Windows Server Failover Cluster
VM 2 (Node B) ─┘    Shared Premium SSD (logs)       with SQL Server FCI
```

Both VMs attach the same shared managed disks. WSFC manages which node has active access. If the active node fails, WSFC promotes the standby node, which already has the disks attached. This pattern provides high availability for SQL Server without requiring Always On Availability Groups or shared network storage.

### Pattern 3: Hybrid File Server with Azure File Sync

```
Azure Files (SMB share, 10 TiB)
        ↕ sync
Branch Office A: Windows Server + File Sync Agent (2 TiB local cache)
        ↕ sync
Branch Office B: Windows Server + File Sync Agent (2 TiB local cache)
```

Each branch office maintains a local cache of frequently accessed files. Cold files are tiered to Azure and transparently recalled on access. The full dataset exists in Azure Files, providing centralized backup and disaster recovery. Each branch only needs enough local storage for its working set.

### Pattern 4: Container Persistent Storage with Azure Files

```
AKS Cluster
├── Pod A ─┐
├── Pod B ─┼── Azure Files (NFS Premium) via PersistentVolume
└── Pod C ─┘
```

Azure Files NFS shares serve as persistent volumes for Kubernetes pods that need shared state. The Container Storage Interface (CSI) driver handles mounting the share into pods. This pattern provides shared, persistent storage across pod restarts and rescheduling without managing an NFS server.

### Pattern 5: High-Performance Database with Ultra Disk

```
VM (Standard_E64s_v5)
├── Ephemeral OS Disk (stateless, fast boot)
├── Ultra Disk 1 (1 TiB, 80,000 IOPS, 2,000 MiB/s) - SAP HANA data
└── Ultra Disk 2 (512 GiB, 40,000 IOPS, 1,000 MiB/s) - SAP HANA log
```

Ultra Disks provide the highest I/O performance for mission-critical databases. Ephemeral OS disks eliminate storage costs and latency for the OS layer. IOPS and throughput are independently tuned per disk to match the specific workload characteristics of data and log volumes.

---

## Common Pitfalls

### Pitfall 1: Over-Provisioning Premium SSD for IOPS

**Problem:** Provisioning a Premium SSD P50 (4 TiB) disk when the workload only needs 500 GiB of capacity but requires 7,500 IOPS. The architect pays for 4 TiB of storage to get the performance tier they need.

**Result:** Significant wasted spend on unused capacity. The cost of 4 TiB of Premium SSD far exceeds what 500 GiB of storage should cost.

**Solution:** Use Premium SSD v2, which decouples IOPS, throughput, and capacity. Provision 500 GiB with 7,500 IOPS and pay for exactly what you need. Alternatively, if on Premium SSD, consider enabling on-demand bursting for workloads that spike intermittently rather than requiring sustained high IOPS.

---

### Pitfall 2: Storing Data on the Temporary Disk

**Problem:** Placing application data, database files, or user uploads on the VM's temporary disk because it shows up as a fast local drive.

**Result:** Data is lost when the VM is stop-deallocated, resized, or migrated to a new host during a maintenance event. There is no recovery option.

**Solution:** Use managed data disks for all persistent data. Reserve the temporary disk exclusively for page files, swap files, and application scratch data that can be regenerated. Configure applications to use explicit paths on managed disks.

---

### Pitfall 3: Ignoring VM-Level IOPS Caps

**Problem:** Attaching multiple high-performance disks to a VM that cannot support their combined IOPS. The architect provisions three Premium SSD v2 disks at 20,000 IOPS each (60,000 total) but attaches them to a VM size that caps at 25,600 uncached IOPS.

**Result:** The disks never reach their provisioned performance. The VM becomes the bottleneck, and the extra IOPS provisioned on the disks is wasted spend.

**Solution:** Always check the VM size's maximum uncached IOPS and throughput before provisioning disk performance. Size the VM to match or exceed the combined disk performance requirements. Azure documentation lists both cached and uncached limits per VM size.

---

### Pitfall 4: Choosing NFS on Azure Files Without Premium Tier

**Problem:** Attempting to create NFS file shares on a standard GPv2 storage account.

**Result:** The deployment fails because NFS on Azure Files requires a FileStorage (Premium) storage account. NFS is not available on standard tiers.

**Solution:** Use a FileStorage storage account for NFS shares. If cost is a concern and the workload can use SMB, standard tiers support SMB at a lower price point. For NFS workloads that need standard-tier pricing, evaluate Azure NetApp Files Standard tier as an alternative.

---

### Pitfall 5: Mounting SMB Shares Over the Public Internet

**Problem:** Attempting to mount Azure Files SMB shares from on-premises over the public internet without a VPN or Private Endpoint.

**Result:** The connection fails because most ISPs block port 445 (SMB) outbound. Even when the ISP does not block it, sending SMB traffic over the public internet creates security risks and unpredictable performance.

**Solution:** Use Azure VPN Gateway, ExpressRoute, or Private Endpoints to provide a private network path for SMB traffic. For hybrid scenarios, Azure File Sync is often a better approach because it syncs data to a local Windows Server, avoiding the need for direct SMB connectivity to Azure.

---

### Pitfall 6: Using Azure Files When Managed Disks Are More Appropriate

**Problem:** Using Azure Files as the data disk for a single database VM because it seems simpler than managing multiple managed disks.

**Result:** Higher latency, lower IOPS, and higher cost per IOPS compared to managed disks. Database performance suffers because file share protocols add overhead that block storage avoids.

**Solution:** Use managed disks for single-VM block storage workloads, especially databases. Azure Files is designed for shared file access by multiple clients, not as a replacement for dedicated block storage. The overhead of the file protocol layer (SMB or NFS) adds latency that databases cannot afford.

---

## Key Takeaways

1. **Always use managed disks for VM storage.** Unmanaged disks are a legacy pattern with no advantages. Managed disks provide automatic replication, integrated snapshots, RBAC, encryption, and availability zone support without managing storage accounts.

2. **Premium SSD v2 is the most flexible production disk type.** It decouples IOPS, throughput, and capacity like AWS gp3, letting you pay for exactly the performance you need without over-provisioning disk size. Consider it the default for production data disks that do not require Ultra Disk performance.

3. **Match host caching to the workload pattern.** Use ReadOnly for read-heavy data files, None for write-heavy log files, and ReadWrite only for OS disks. Incorrect caching degrades performance or risks data loss.

4. **Check VM-level IOPS limits, not just disk limits.** The VM size caps the combined performance of all attached disks. Provisioning disk IOPS beyond what the VM can deliver wastes money.

5. **Shared disks are for clustered applications, not general file sharing.** Shared disks require cluster-aware software like WSFC or SCSI Persistent Reservations to manage concurrent access. For general shared storage, use Azure Files.

6. **Azure Files replaces file server VMs, not disk storage.** Use Azure Files when multiple clients need concurrent access via SMB or NFS. Use managed disks when a single VM needs dedicated block storage for databases or applications.

7. **NFS on Azure Files requires Premium tier.** Standard file shares only support SMB. If your Linux workload needs NFS at a lower cost point, evaluate Azure NetApp Files Standard tier or Azure Files Premium with careful capacity planning.

8. **Azure File Sync bridges on-premises and cloud file storage.** It provides local caching with cloud tiering, enabling branch office consolidation and hybrid scenarios without requiring users to change their workflow.

9. **Private Endpoints are the recommended networking model for Azure Files in production.** They eliminate public internet exposure, support on-premises access over VPN or ExpressRoute, and work with both SMB and NFS protocols.

10. **Ultra Disk and Premium SSD v2 do not support OS disks or host caching.** Use Premium SSD for OS disks and use these high-performance types for data disks where their sub-millisecond latency and independent tuning justify the constraints.
