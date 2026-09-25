---
title: "AWS Block and File Storage: EBS, EFS, and FSx"
layout: guide
category: AWS
subcategory: Storage Services
description: "Choosing between object, block, and file storage on AWS, then how each block and file service works: EBS volume types, performance, snapshots, and encryption; EFS mount targets, throughput modes, and storage classes; and what each FSx file system is for."
tags: [ebs, efs, fsx, block-storage, file-storage, ebs-snapshots, fundamentals]
---

## Object, Block, or File

AWS stores data in three shapes, and the shape decides how an application reaches it:

- **Object storage** (Amazon S3) holds whole objects addressed by key, read and written over HTTPS through an API. An application can't open a file in place or change a few bytes in the middle of one. It reads or replaces the whole object.
- **Block storage** (Amazon EBS and instance store) presents a raw disk to one operating system, which formats it with its own file system such as ext4, XFS, or NTFS. It's what databases and boot disks expect, and only the instance that owns it can read it.
- **File storage** (Amazon EFS and Amazon FSx) is a shared file system that many machines mount over the network at once, with directories, permissions, and locks.

| Option | Shape | Who can use it at once | Scope | Survives |
|---|---|---|---|---|
| **S3** | Object, over HTTPS | Any number of clients with permission | Region | Until deleted |
| **EBS volume** | Block | One instance (io1 and io2 allow up to 16 with Multi-Attach) | One Availability Zone | Stop, termination if configured, instance failure |
| **Instance store** | Block, on the host's own disks | The one instance | The host | Reboot only. Lost on stop, hibernation, termination, or disk failure |
| **EFS** | File, NFS for Linux | Thousands of instances, containers, and Lambda functions | Region, or one zone | Until deleted |
| **FSx** | File over SMB, NFS, or Lustre, plus iSCSI block storage on ONTAP | Many clients | One zone or two | Until deleted |
| **S3 Files** | File view of an S3 bucket, over NFS | EC2, Lambda, EKS, ECS | Region | Data lives in the bucket |

**S3 Files** (April 2026) sits between the rows. It mounts an S3 bucket or prefix as a shared file system built on EFS, keeps the recently used working set on fast storage, and synchronizes changes back to the bucket, which stays the authoritative copy. It suits file-based tools that need to work on data that already lives in S3. It costs more than the bucket alone. You pay a storage rate for data held on the fast storage and access charges each time data is imported onto it or exported back. Writes also reach the bucket asynchronously, so other S3 clients see them after a delay.

```
Can the application read and write whole objects through an HTTP API?
├── Yes → S3
└── No, it needs a disk or a file system → Do several machines need the same data?
    ├── No → Does the data have to survive the instance stopping?
    │   ├── No → Instance store (scratch space, caches, temporary files)
    │   └── Yes → EBS
    └── Yes → Which protocol do the clients speak?
        ├── NFS from Linux
        │   ├── Data already in S3 and staying there → S3 Files
        │   └── Otherwise → EFS (or FSx for OpenZFS for lower latency)
        ├── SMB from Windows → FSx for Windows File Server
        ├── Several protocols, iSCSI, or NetApp features → FSx for NetApp ONTAP
        └── Parallel HPC or ML throughput → FSx for Lustre
```

The scope column matters as much as the shape. An EBS volume exists in one Availability Zone, and only an instance in that zone can attach it. To move its data to another zone, you take a **snapshot**, which is stored at Region scope, and restore it as a new volume in the other zone. An EFS file system is a Regional resource. Clients reach it through a **mount target**, a network interface the file system places in one subnet of each zone, so an instance in any zone mounts the same data through its own zone's mount target.

{% include figure.html id="aws-ebs-efs-scope" %}

Quotas for all of these services are per account per Region unless stated otherwise.

---

## Amazon EBS

### Volume Types

An EBS volume is a network-attached disk. AWS stores it redundantly within its Availability Zone, so it survives the failure of a single piece of hardware, but not the loss of the zone. Volumes come in SSD types for transactional work, where the number of small reads and writes per second (IOPS) matters most, and HDD types for streaming work, where megabytes per second (throughput) matters most. Prices are per GB-month in US East (N. Virginia):

| Type | Size | Max IOPS | Max throughput | Durability | Storage price |
|---|---|---|---|---|---|
| **gp3** (General Purpose SSD) | 1 GiB–64 TiB | 80,000 | 2,000 MiB/s | 99.8–99.9% | $0.08 |
| **gp2** (older General Purpose SSD) | 1 GiB–16 TiB | 16,000 | 250 MiB/s | 99.8–99.9% | $0.10 |
| **io2 Block Express** (Provisioned IOPS SSD) | 4 GiB–64 TiB | 256,000 | 4,000 MiB/s | 99.999% | $0.125 |
| **io1** (older Provisioned IOPS SSD) | 4 GiB–16 TiB | 64,000 | 1,000 MiB/s | 99.8–99.9% | $0.125 |
| **st1** (Throughput Optimized HDD) | 125 GiB–16 TiB | 500 | 500 MiB/s | 99.8–99.9% | $0.045 |
| **sc1** (Cold HDD) | 125 GiB–16 TiB | 250 | 250 MiB/s | 99.8–99.9% | $0.015 |

Durability here is per volume per year, so 99.8% means up to two of every 1,000 volumes fail in a year. That's far below S3's eleven nines, and it's why snapshots matter even for volumes that never lose their instance.

**gp3 is the default for almost everything**, including boot volumes, most databases, and development environments. Every gp3 volume includes 3,000 IOPS and 125 MiB/s whatever its size. More can be provisioned independently of size, at $0.005 per IOPS and $0.04 per MiB/s each month, up to 500 IOPS per GiB of volume and 0.25 MiB/s per provisioned IOPS. A 160 GiB volume can reach the full 80,000 IOPS.

**gp2 is the previous generation.** Its performance is tied to size at 3 IOPS per GiB, with a credit bucket that lets volumes under 1 TiB burst to 3,000 IOPS for a while. A 100 GiB gp2 volume has a baseline of 300 IOPS and slows down once its credits run out. gp3 costs 20% less per GiB and gives the same volume 3,000 IOPS with no credits. Changing a volume from gp2 to gp3 happens in place without downtime, and if you don't specify performance, EBS keeps whichever is higher of the old volume's performance and the gp3 baseline. The console defaults to gp3 when creating a volume, but some API paths still default to gp2, so infrastructure code should state the type.

**io2 Block Express is for the workloads gp3 can't serve.** Choose it when a volume needs more than 80,000 IOPS or 2,000 MiB/s, consistent sub-millisecond latency (average under 500 microseconds for 16 KiB I/O), 99.999% durability, or Multi-Attach. Its IOPS are billed separately and dominate the cost: $0.065 per IOPS a month up to 32,000, $0.0455 from 32,001 to 64,000, and $0.03185 above that. A 1 TiB io2 volume with 64,000 IOPS costs about $3,660 a month, of which storage is $128. A 1 TiB gp3 volume with the same IOPS costs about $390, so io2 pays for itself only when a workload needs its latency, durability, or scale beyond gp3's limits. io1 is the older Provisioned IOPS type, and io2 gives higher durability for the same storage price.

**st1 and sc1 are for large sequential reads and writes**, such as log processing, Kafka, or data that's scanned rarely. Their throughput scales with size (st1 has a baseline of 40 MiB/s per TiB, sc1 12 MiB/s per TiB) and they can't be boot volumes. They're poor at small random I/O, so a database on st1 is slow no matter how large the volume.

### Performance Depends on the Instance Too

A volume can't deliver more than its instance can carry. Each instance type has a maximum EBS bandwidth, IOPS, and number of attached volumes, separate from its network bandwidth, and smaller sizes often reach their maximum only in bursts. Current-generation instances are **EBS-optimized** by default, meaning that EBS traffic has dedicated capacity rather than competing with application traffic. Before provisioning a fast volume, check that the instance type's EBS limits are at least as high, or the extra IOPS are paid for and never used. Instances built on the Nitro System, the dedicated hardware platform that nearly all current instance types run on, can drive volumes up to 256,000 IOPS, while older instance types reach at most 32,000.

IOPS and throughput also meet at the I/O size. Throughput equals IOPS multiplied by the size of each operation, so a database doing 16 KiB reads at 10,000 IOPS moves about 156 MiB/s, while a log processor doing 1 MiB reads needs only 500 IOPS to move 500 MiB/s. A gp3 volume left at the 125 MiB/s baseline caps the database at about 8,000 of those reads a second, however many IOPS are provisioned.

When one volume isn't enough, the operating system can stripe several volumes together as **RAID 0**, which adds their IOPS and throughput. It has no redundancy, so losing any one volume loses the whole array, and each volume needs its own snapshot, taken together (see Snapshots below). With gp3 reaching 80,000 IOPS on a single volume, striping is now mostly for workloads beyond that. Mirroring with RAID 1 adds little, because EBS already replicates each volume within its zone.

### Changing a Volume in Place

**Elastic Volumes** lets you increase a volume's size, change its type, or change its IOPS and throughput while it stays attached and in use. A size increase is usable within seconds, but the operating system still has to extend its partition and file system to see the new space. The rest of the change runs in the background and can take from minutes to several hours. A 1 TiB volume can take up to six hours. A volume can be modified up to four times in a rolling 24-hour period, and each change must finish before the next one starts.

Size only grows. To shrink a volume, create a smaller one and copy the data across with a tool such as rsync or robocopy. That asymmetry is why the usual advice is to provision what's needed now with some headroom and grow it later, rather than guessing a large size up front.

### Sharing a Volume with Multi-Attach

An io2 volume with **Multi-Attach** enabled can attach to up to 16 Nitro-based instances in the same zone, each with full read and write access. It doesn't make the data shareable by itself. Ordinary file systems such as ext4, XFS, and NTFS assume they're the only writer and will corrupt data if two instances mount them at once, so Multi-Attach needs a cluster-aware file system or an application that coordinates writes itself. io2 supports NVMe reservations, the I/O fencing protocol that clustered databases and Windows Server Failover Clustering use to stop a failed node from writing. Multi-Attach volumes can't be boot volumes. io1 also supports Multi-Attach, but only in three Regions, only for Linux, and without fencing, so io2 is the one to use. For ordinary shared files, a file service is simpler.

### Snapshots

A **snapshot** is a point-in-time copy of a volume, stored in Amazon S3 at Region scope and managed by EBS, so it doesn't appear in any of your buckets. The first snapshot of a volume copies every written block. Later ones store only the blocks that changed since the previous snapshot, and each snapshot references the unchanged blocks held by earlier ones. Every snapshot can still restore the complete volume on its own. Deleting one removes only the blocks no other snapshot needs, so deleting an old snapshot often frees less storage than its size suggests. Snapshots cost $0.05 per GB-month of stored data.

A snapshot is **crash-consistent**. It captures what was on disk at that instant, like pulling the power cord, and leaves out anything still in the application's or operating system's memory. Databases recover from that the same way they recover from a crash. When an application needs a cleaner copy, pause its writes or flush its buffers first. AWS Backup can take application-consistent snapshots on Windows through the Volume Shadow Copy Service (VSS). For a volume set striped together, or a database that spreads data and logs across volumes, take a **multi-volume snapshot**, which captures every volume attached to an instance at the same instant.

Snapshots are what move and protect EBS data beyond its zone:

- **Restore into any zone** in the Region, as a new volume of any type and a size at least as large.
- **Copy to another Region** for disaster recovery, or **share with another account**. Encrypted snapshots use a KMS key (see Encryption below). One encrypted with the default key that AWS creates and manages for EBS (`aws/ebs`) can't be shared, because that key can't be granted to other accounts. Share snapshots encrypted with a customer managed key, one you create and control, and grant the other account use of the key.
- **Automate the schedule** with Amazon Data Lifecycle Manager, which creates and expires snapshots of tagged volumes, or with AWS Backup, which also covers other services. **Recycle Bin** retention rules can keep deleted snapshots recoverable for a set period, as protection against accidental or malicious deletion.

#### Restoring Quickly

A volume restored from a snapshot is usable at once, but its blocks are copied down from S3 as they're first read. Until every block has arrived, reads of new blocks are much slower, which can matter a great deal for a database brought back during an incident. Three options remove or shorten that initialization:

| Option | How it works | Cost |
|---|---|---|
| **Read every block first** | Run `fio` or `dd` across the device before putting load on it | Free, but takes minutes to hours depending on size and instance bandwidth |
| **Provisioned rate for volume initialization** | Set a rate of 100–300 MiB/s when creating the volume, and EBS fills it in a predictable time | A per-GiB charge on the snapshot's data |
| **Fast snapshot restore** | Enable it on a snapshot in chosen zones, and volumes created there are fully initialized immediately | $0.75 per snapshot per zone per hour, about $540 a month each. Up to 5 snapshots per Region |

Fast snapshot restore suits a small number of snapshots that a recovery plan depends on, such as a golden database image. Its full benefit applies to volumes up to 64,000 IOPS and 1,000 MiB/s. For everything else, a provisioned initialization rate gives most of the predictability for a one-time charge. With the 300 MiB/s rate, 10 GiB of snapshot data is ready in about 34 seconds, and 1 TiB in about an hour.

#### Archiving Snapshots

**EBS Snapshots Archive** stores a snapshot for $0.0125 per GB-month instead of $0.05, for snapshots kept 90 days or longer and rarely restored. The catch is that archiving converts the snapshot into a full copy of every written block, because it can no longer lean on the others in the chain. A daily snapshot of a 500 GB volume that stored only 10 GB of changes becomes a full 500 GB copy when archived, and costs more than before. Archive monthly, quarterly, or end-of-project snapshots, not daily ones. An archived snapshot must be restored to the standard tier before use, which can take up to 72 hours, and deleting it within 90 days bills the remaining days.

### Encryption

EBS encryption uses a KMS key in the volume's Region and encrypts the volume, the data moving between it and the instance, and every snapshot and volume made from it. The encryption runs in the host's Nitro hardware rather than on the instance's CPU, using a data key that stays in that hardware while the volume is attached. Disabling the KMS key doesn't affect a volume that's already attached, but the next attempt to attach it fails.

**Encryption by default** is a per-account, per-Region setting that forces every new volume and snapshot copy in that Region to be encrypted, with the AWS managed key or a customer managed key you choose. It doesn't touch existing volumes. To encrypt one, snapshot it, copy the snapshot with encryption turned on, and create a new volume from the copy. Turning the setting on in every Region you use, including ones you don't expect to use, is a cheap safeguard. The key of an existing volume or snapshot can't be changed, but a snapshot copy can be re-encrypted with a different key.

### Where EBS Costs Leak

EBS bills for what's provisioned, not what's used. A 1 TiB gp3 volume holding 100 GB of data costs the same as a full one, and so do IOPS and throughput provisioned above the baseline but never reached. Most EBS waste comes from resources that outlive their purpose:

- **Unattached volumes.** Terminating an instance deletes only the volumes whose `DeleteOnTermination` flag is set. Root volumes attached at launch are deleted by default. Data volumes added in the console at launch, and any volume attached later, are kept by default, and they keep billing while attached to nothing, in the `available` state.
- **Snapshots of deleted volumes.** Deleting a volume leaves its snapshots behind. Data Lifecycle Manager expires only the snapshots it created itself, so manual and scripted snapshots stay until someone deletes them.
- **gp2 volumes** not yet moved to gp3.
- **Fast snapshot restore** left enabled after the recovery test or migration that needed it.
- **Overprovisioned IOPS and throughput.** CloudWatch's `VolumeReadOps`, `VolumeWriteOps`, and `VolumeIdleTime` show what a volume uses, and AWS Compute Optimizer recommends volume types and sizes from them.

---

## Instance Store

Some instance types come with **instance store**, disks physically attached to the host the instance runs on, usually NVMe SSDs. The number and size of the disks are fixed by the instance type and size (a `d` in the type name, as in `m7gd`, marks one that has them), and they cost nothing beyond the instance price. Because the disks sit in the host rather than across a network, SSD instance store tends to deliver more IOPS at lower latency than an EBS volume.

The data lasts only as long as the instance stays on that host. A reboot keeps it, but stopping, hibernating, or terminating the instance erases it, and so does a failure of the underlying disk. Instance store volumes can't be detached, moved to another instance, or snapshotted. That makes them right for data that's temporary or that exists somewhere else as well: caches, buffers, scratch space for batch jobs, and nodes of systems that replicate their own data across instances, such as Cassandra or Kafka clusters. Anything that has to survive the instance goes on EBS or into a shared service.

---

## Amazon EFS

### How Clients Reach a File System

An **EFS file system** is an NFS file system (NFSv4.0 and 4.1) that grows and shrinks as files are added and removed, with no capacity to provision. It serves Linux clients: EC2 instances, ECS tasks on EC2 or Fargate, EKS pods through the EFS CSI driver, Lambda functions attached to the VPC, and on-premises servers over Direct Connect or VPN. Windows clients aren't supported, which is what FSx for Windows File Server is for.

EFS offers two **file system types**, chosen at creation:

- **Regional** (recommended) stores data across at least three Availability Zones and stays available if a zone fails. It can have one mount target in each zone of its VPC.
- **One Zone** stores data in a single zone and has one mount target there, for about half the price of Regional storage. Losing the zone can lose the data, so AWS turns on automatic AWS Backup backups for One Zone file systems, which are stored across zones.

Each mount target is an elastic network interface with a private IP address in one subnet, and its **security group** decides which clients can connect on NFS port 2049. Allow the security groups of the clients that need the file system, not whole IP address ranges. Clients mount with the **EFS mount helper** from the `amazon-efs-utils` package, which handles TLS and IAM authorization. It resolves the file system's DNS name to the mount target in the client's own zone. Traffic to a mount target in another zone pays inter-AZ data transfer, which is also the everyday cost of mounting a One Zone file system from instances in other zones.

A file system's mount targets all sit in one VPC at a time. Clients in other VPCs or accounts reach them over VPC peering or a transit gateway, mounting by IP address or with DNS set up for the purpose.

### What Several Writers See

EFS gives the **close-to-open consistency** that NFS applications expect. Once a writer closes a file or calls `fsync`, any client that opens the file afterward sees the change, but a client that already has the file open may not see another client's writes until it reopens it. File locking uses NFSv4 locks, which are advisory. Applications that take locks are protected from each other, but nothing stops a program that doesn't ask for a lock from writing. Shared content like web assets, build caches, and model files fits this easily. Two processes appending to the same file from different instances need an application-level protocol, or a database.

### Throughput Modes

Performance is set by the **throughput mode**. It can be changed after creation, except that a file system whose lifecycle policy uses the Archive class must stay on Elastic.

| Mode | How throughput is set | Maximum per file system (Regional) | Billed for |
|---|---|---|---|
| **Elastic** (default, recommended) | Scales automatically with demand | 20–60 GiB/s read, 1–5 GiB/s write, depending on Region | Data read ($0.03 per GB) and written ($0.06 per GB) |
| **Provisioned** | You set a fixed rate, independent of size | 3–10 GiB/s read, 1–3.33 GiB/s write | $6 per MB/s-month above what the stored data would earn in Bursting mode |
| **Bursting** | 50 MiB/s per TiB stored in Standard, with credits to burst to 100 MiB/s per TiB (at least 100 MiB/s) | 3–5 GiB/s read, 1–3 GiB/s write | Nothing beyond storage |

Reads count less than writes toward a file system's limits. In Bursting and Provisioned modes, EFS meters reads at a third of the rate of writes, so the same allowance carries about three times as much read throughput as write. A single client can reach 1,500 MiB/s on an Elastic file system using version 2.0 or later of the EFS mount helper, or 500 MiB/s otherwise.

Bursting ties speed to size, which catches small file systems out. A file system with 100 GiB in Standard storage has a baseline of 5 MiB/s, which earns enough credit to burst at 100 MiB/s for only about 72 minutes a day, and it drops back to 5 MiB/s once the credits run out. Elastic suits spiky or unpredictable workloads, especially those whose average throughput is 5% or less of their peak. Provisioned is cheaper for a sustained, predictable rate above that, and Bursting only suits large file systems whose steady load stays under their baseline. After switching to Provisioned or changing its amount, you have to wait 24 hours to switch back or reduce the amount.

Separately, a file system has a **performance mode**, fixed at creation. **General Purpose** is the default and the one AWS recommends for every file system. **Max I/O** is a previous-generation mode with higher latency per operation, and it can't be used with Elastic throughput or One Zone file systems.

### Storage Classes and Lifecycle

Files are stored in one of three **storage classes**, and **lifecycle management** moves them between classes based on when each file was last read or written. Prices per GB-month in US East (N. Virginia), for Regional file systems using Elastic throughput:

| Class | For | First-byte read latency | Storage | Reading it | Moving files into it |
|---|---|---|---|---|---|
| **Standard** | Active data | About 1 ms | $0.30 | Elastic read charge only | Nothing |
| **Infrequent Access (IA)** | Data read a few times a quarter | Tens of milliseconds | $0.016 | Plus $0.01 per GB | $0.01 per GB |
| **Archive** | Data read a few times a year or less | Tens of milliseconds | $0.008 | Plus $0.03 per GB | $0.03 per GB |

On file systems using Bursting or Provisioned throughput, IA costs $0.025 per GB-month instead, and Archive isn't available. One Zone file systems cost $0.16 for Standard and $0.0133 for IA. Files in IA and Archive are billed at a minimum of 128 KiB each, and Archive has a 90-day minimum storage duration. File metadata, including names and the directory tree, always stays in Standard, so listing a directory stays fast and doesn't count as reading the files.

A lifecycle configuration has three policies, applied to the whole file system:

- **Transition into IA** after a file goes unaccessed for a set number of days, 30 by default.
- **Transition into Archive** after a longer period, 90 days by default.
- **Transition into Standard** on first access, off by default. When it's off, a file read from IA stays there and pays the IA read charge each time. Turn it on for data that becomes active again once touched, such as a project reopened after months.

Tiering is where most EFS savings come from. A 1 TB file system with 200 GB in active use costs $300 a month with everything in Standard. Once the other 800 GB has moved to IA, it costs about $73 a month before throughput charges, plus a one-time $8 for the move. The price is latency. The first read from IA or Archive takes tens of milliseconds instead of about one, which matters for an application that opens many small, rarely used files.

### Access Control and Encryption

Three layers decide what a client can do:

- **IAM and the file system policy.** IAM policies control who can manage file systems. A **file system policy**, a resource policy on the file system, controls which principals can mount it, whether they can write, and whether they can act as the root user. With IAM authorization, the mount helper signs the mount with the client's IAM role, such as an EC2 instance profile or an ECS task role.
- **POSIX permissions**, the standard Linux owner, group, and mode bits on files and directories, enforced by EFS for the user and group ID the client presents.
- **Access points.** An **access point** is an application-specific entry into the file system that forces every request through it to use a given POSIX user and group, and to see only a given directory as its root. Two applications sharing one file system each get their own access point, and neither can read the other's directory. Lambda functions mount EFS only through an access point.

Encryption at rest is chosen at creation and can't be changed afterward. The console turns it on by default, but the API, CLI, and infrastructure-as-code tools don't unless told to, so an unencrypted file system is usually a template that left it out. To fix one, replicate it to a new encrypted file system. An IAM or service control policy can deny `elasticfilesystem:CreateFileSystem` when the `elasticfilesystem:Encrypted` condition is false. Encryption in transit uses TLS, turned on with the mount helper's `tls` option. A file system policy that denies requests where `aws:SecureTransport` is false makes TLS mandatory for every client.

### Backup and Replication

**AWS Backup** is the standard way to take point-in-time backups of a file system, and new file systems created in the console have automatic daily backups turned on. **EFS replication** keeps a second file system in the same or another Region, or another account, continuously synchronized with the source. After the first full copy, it keeps a recovery point objective of 15 minutes for most file systems, longer for ones with more than 100 million files or very large files that change often. Replication copies changes as of each sync rather than as a point-in-time snapshot, so it protects against losing a zone or Region, not against a mistaken deletion, which it copies too. Backups cover that.

---

## Amazon FSx

**Amazon FSx** runs four widely used file systems as managed services, for workloads that need a specific protocol or feature set EFS doesn't provide. Each FSx file system lives in one or two Availability Zones of a VPC, with throughput you provision. Capacity is usually provisioned too, though Lustre and OpenZFS also offer an Intelligent-Tiering storage class that grows and shrinks with the data.

| File system | Protocols | For |
|---|---|---|
| **FSx for Windows File Server** | SMB | Windows applications and home directories that need Active Directory integration, NTFS permissions, and DFS namespaces |
| **FSx for NetApp ONTAP** | NFS and SMB file access, plus iSCSI, which serves block volumes (LUNs) over the network | Migrating from on-premises NetApp, mixed Linux and Windows access to the same files, and ONTAP features such as SnapMirror replication, FlexClone copies, and automatic tiering of cold data |
| **FSx for OpenZFS** | NFS | Linux workloads that need lower latency than EFS, or ZFS snapshots and instant clones, for example to give each test environment its own copy of a dataset |
| **FSx for Lustre** | Lustre, an open-source parallel file system, from Linux clients | High-performance computing, ML training, and media rendering that need very high parallel throughput, usually linked to an S3 bucket so the file system loads data from it and writes results back |

Windows File Server, ONTAP, and OpenZFS offer Multi-AZ deployments with a standby in a second zone. Lustre runs in a single zone, as persistent file systems for longer-lived data or scratch file systems for short, temporary jobs, since its usual job is fast access to data whose durable copy lives in S3.

Choose EFS when Linux clients need NFS with no capacity planning and Regional durability. Reach for FSx when the protocol, the latency, or a specific file system feature is the requirement.

---

## Key Takeaways

1. **Choose the shape first.** Object storage is for data read through an API, block storage for one machine's disk, and file storage for data several machines share as files.
2. **An EBS volume lives in one Availability Zone.** Snapshots, stored at Region scope, are how its data moves to another zone, another Region, or another account.
3. **gp3 is the default volume type.** It includes 3,000 IOPS and 125 MiB/s at any size, scales to 80,000 IOPS, and costs 20% less than gp2. io2 Block Express is for the latency, durability, or scale gp3 can't reach.
4. **A volume is only as fast as its instance.** Check the instance type's EBS bandwidth and IOPS limits, and remember that throughput is IOPS times I/O size.
5. **Snapshots are incremental, crash-consistent, and slow to restore by default.** Plan for initialization with a provisioned rate or fast snapshot restore, and archive only snapshots kept for months.
6. **EFS is Regional and reached through a mount target in each zone.** Use Elastic throughput and General Purpose mode unless a workload proves otherwise, and let lifecycle management move cold files to IA and Archive.
7. **Encryption and access are set up differently on each service.** EBS encryption by default is a per-Region setting, EFS encryption is fixed at creation, and EFS access points confine each application to its own directory.
8. **FSx covers the protocols and features EFS doesn't.** Windows File Server for SMB, ONTAP for multiprotocol and NetApp features, OpenZFS for low-latency NFS with clones, and Lustre for parallel throughput linked to S3.
