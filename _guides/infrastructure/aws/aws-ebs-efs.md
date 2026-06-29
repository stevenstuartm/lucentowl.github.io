---
title: "AWS EBS & EFS for System Architects"
layout: guide
category: AWS
subcategory: Storage Services
description: "Comprehensive guide to AWS EBS and EFS covering volume types, file systems, performance optimization, cost management, and when to use block vs file storage"
tags: [aws, ebs, efs, storage, block-storage, file-storage, performance, cost-optimization, fundamentals]
---

## What Problems EBS and EFS Solve

AWS provides two primary block and file storage services that address different storage challenges:

### Amazon EBS (Elastic Block Store)

**Storage challenges solved:**

**Persistent block storage for single EC2 instances**: EBS provides network-attached block devices that persist independently of EC2 instance lifecycle. Stop or terminate an instance; the EBS volume retains data. Attach volumes to new instances without data loss. Volumes survive instance failures.

**Predictable, high-performance storage for databases and applications**: EBS delivers single-digit millisecond latency and up to 256,000 IOPS per volume (io2 Block Express). Databases like MySQL, PostgreSQL, Oracle, and SQL Server require consistent, low-latency block storage. EBS provides this without managing physical disks or storage arrays.

**Point-in-time backup without downtime**: EBS snapshots capture volume state while the volume remains online and accessible. Create daily snapshots for disaster recovery without application interruptions. Snapshots are incremental (only changed blocks stored), reducing backup storage costs by 70-90% compared to full backups.

**Flexible capacity without overprovisioning**: Resize volumes without downtime using Elastic Volumes. Start with 100 GB, grow to 16 TB as data grows. Change volume type (gp3 → io2) while attached to running instance. No need to overprovision storage upfront.

### Amazon EFS (Elastic File System)

**Storage challenges solved:**

**Shared file storage across multiple instances**: EFS provides NFS-compatible shared file system accessible by thousands of EC2 instances simultaneously. Multiple web servers share content. Containerized applications share configuration. Build clusters share code repositories. No complex NFS server management.

**Automatic scaling without capacity planning**: EFS automatically grows and shrinks as you add/remove files. No pre-provisioning. File system can scale from 1 GB to petabytes without intervention. Pay only for storage used. No unused capacity waste.

**High availability and durability without replication**: EFS automatically replicates data across multiple Availability Zones within a region. Designed for 99.99% availability. If one AZ fails, data remains accessible from other AZs. No manual replication configuration needed.

**Serverless and container workloads requiring shared storage**: Lambda functions mount EFS for shared state, large dependencies, or machine learning models. Fargate containers mount EFS for persistent data across container restarts. Kubernetes persistent volumes backed by EFS enable stateful applications.

## EBS vs EFS: Core Differences

| Dimension | Amazon EBS | Amazon EFS |
|-----------|------------|------------|
| **Storage Type** | Block storage (raw volumes formatted as file systems) | File storage (fully managed NFS) |
| **Access Model** | Single EC2 instance (except Multi-Attach io2) | Thousands of EC2 instances, Lambda, Fargate simultaneously |
| **Performance** | Up to 256,000 IOPS, 4,000 MB/s per volume | Up to 3 GiB/s read, 1 GiB/s write per file system |
| **Latency** | Sub-millisecond (0.5-1ms for io2 Block Express) | Low single-digit milliseconds (1-10ms) |
| **Availability** | Single AZ (replicate to Multi-AZ with snapshots) | Multi-AZ by default (99.99% availability) |
| **Scalability** | `16 TB − 64 TB` per volume | Petabytes, auto-scaling |
| **Pricing** | $0.08-$0.125/GB/month | $0.30/GB/month (Standard), $0.16/GB (One Zone) |
| **Use Cases** | Databases, boot volumes, single-instance apps | Shared web content, code repositories, container storage |

<div class="callout callout--tip">
<p class="callout__title">Decision Framework</p>
<ul>
<li><strong>Single instance with high IOPS?</strong> → EBS</li>
<li><strong>Multiple instances need shared access?</strong> → EFS</li>
<li><strong>Database or boot volume?</strong> → EBS</li>
<li><strong>Lambda or Fargate persistent storage?</strong> → EFS</li>
<li><strong>Cost-sensitive?</strong> → EBS (2-4x cheaper per GB)</li>
<li><strong>No capacity planning?</strong> → EFS (auto-scales)</li>
</ul>
</div>

## Amazon EBS (Elastic Block Store)

### EBS Volume Types

EBS offers five volume types optimized for different workload characteristics: IOPS, throughput, and cost.

#### gp3 (General Purpose SSD) - Recommended Default

**Purpose**: Balanced price/performance for most workloads

**Performance**:
- **Baseline**: 3,000 IOPS and 125 MB/s at any size (1 GB to 16 TB)
- **Max**: 16,000 IOPS and 1,000 MB/s (configurable independently)
- **Latency**: Single-digit milliseconds
- **Delivered**: 99% of provisioned performance

**Pricing** (US East):
- Storage: $0.08/GB/month
- 3,000 IOPS included free
- Additional IOPS: $0.005/IOPS/month
- 125 MB/s included free
- Additional throughput: $0.04/MB/s/month

**When to use**:
- Boot volumes for EC2 instances
- Low-latency interactive applications
- Development and test environments
- Virtual desktops
- MySQL, PostgreSQL, MariaDB databases (medium workloads)

**Cost comparison** (500 GB volume, 3,000 IOPS, 125 MB/s):
- gp3: $40/month
- gp2 (previous generation): $50/month
- **Savings**: 20%

**gp3 vs gp2**: gp3 provides consistent 3,000 IOPS at any size. gp2 provides 3 IOPS per GB (500 GB × 3 = 1,500 IOPS). For volumes >333 GB needing 3,000 IOPS, gp3 is 20% cheaper.

**Best practice**: Use gp3 as default for all new volumes. Migrate gp2 to gp3 for immediate 20% cost savings without performance impact.

#### io2 Block Express (Provisioned IOPS SSD)

**Purpose**: Highest performance for mission-critical, I/O-intensive workloads

**Performance**:
- **IOPS**: Up to 256,000 IOPS per volume (64,000 for regular io2)
- **Throughput**: Up to 4,000 MB/s per volume
- **Latency**: Sub-millisecond (average <500 microseconds for 16 KB I/O)
- **Durability**: 99.999% (0.001% annual failure rate vs 0.1-0.2% for other EBS volumes)
- **Delivered**: 99.9% of provisioned performance

**Pricing** (US East):
- Storage: $0.125/GB/month
- IOPS: $0.065/IOPS/month (tiered pricing at higher IOPS)

**When to use**:
- Large relational databases (Oracle, SQL Server, MySQL, PostgreSQL) with high transaction rates
- NoSQL databases (MongoDB, Cassandra) requiring consistent low latency
- Business-critical applications requiring 99.999% durability
- Workloads needing >16,000 IOPS

**Cost example** (1 TB volume, 64,000 IOPS):
- Storage: 1,000 GB × $0.125 = $125/month
- IOPS: 64,000 × $0.065 = $4,160/month
- **Total**: $4,285/month

**Multi-Attach**: io2 and io2 Block Express support Multi-Attach, allowing a single volume to attach to up to 16 EC2 instances simultaneously in the same AZ. Use for clustered applications requiring shared block storage (clustered databases, shared file systems like Oracle RAC).

**Best practice**: Use io2 Block Express for databases with >16,000 IOPS requirements or when sub-millisecond latency is critical. For lower IOPS (<16,000), use gp3 (significantly cheaper).

#### st1 (Throughput Optimized HDD)

**Purpose**: Low-cost HDD for frequently accessed, throughput-intensive workloads

**Performance**:
- **Baseline**: 40 MB/s per TB
- **Burst**: 250 MB/s per TB
- **Max throughput**: 500 MB/s per volume
- **IOPS**: Not designed for IOPS-intensive workloads
- **Size**: 125 GB - 16 TB

**Pricing** (US East):
- Storage: $0.045/GB/month

**When to use**:
- Big data analytics (Hadoop, Kafka, log processing)
- Data warehouses (sequential reads)
- ETL workloads
- Streaming workloads requiring high throughput, not high IOPS

**Don't use for**:
- Boot volumes (SSD required)
- Databases (require low latency and high IOPS)
- Random I/O workloads

**Cost comparison** (1 TB volume):
- st1: $45/month
- gp3: $80/month
- **Savings**: 44% (but only for sequential throughput workloads)

#### sc1 (Cold HDD)

**Purpose**: Lowest-cost HDD for infrequently accessed data

**Performance**:
- **Baseline**: 12 MB/s per TB
- **Burst**: 80 MB/s per TB
- **Max throughput**: 250 MB/s per volume
- **Size**: 125 GB - 16 TB

**Pricing** (US East):
- Storage: $0.015/GB/month

**When to use**:
- Infrequently accessed data requiring few scans per day
- Cold storage for data you can't delete but rarely access
- Lowest-cost option for throughput-oriented storage

**Cost comparison** (1 TB volume):
- sc1: $15/month
- st1: $45/month
- gp3: $80/month
- **Savings**: 81% vs gp3

**Best practice**: Use sc1 only when data is accessed <once per day and cost is more important than performance. For frequent access, gp3 provides better cost-per-IOPS.

### EBS Volume Selection Framework

| Workload | Volume Type | Reasoning |
|----------|-------------|-----------|
| Boot volumes | **gp3** | Balanced performance, 20% cheaper than gp2 |
| MySQL/PostgreSQL (small-medium) | **gp3** | 3,000-16,000 IOPS sufficient, cost-effective |
| MySQL/PostgreSQL (large, high TPS) | **io2 Block Express** | >16,000 IOPS, sub-ms latency, 99.999% durability |
| Oracle, SQL Server (production) | **io2 Block Express** | High IOPS, durability, consistent performance |
| MongoDB, Cassandra | **io2 Block Express** | Consistent low latency for write-heavy workloads |
| NoSQL (moderate workload) | **gp3** | Cost-effective for moderate IOPS |
| Big data (Hadoop, Kafka) | **st1** | High throughput, sequential I/O, low cost |
| Log processing | **st1** | Streaming reads, throughput-oriented |
| Archived data (rare access) | **sc1** | Lowest cost, infrequent access acceptable |
| Dev/test environments | **gp3** | Balanced performance, low cost |

**Decision tree**:
1. **Is data accessed <once per day?** → sc1
2. **Is workload throughput-intensive (big data, streaming)?** → st1
3. **Do you need >16,000 IOPS or <500μs latency?** → io2 Block Express
4. **Everything else** → gp3 (default)

### EBS Performance Optimization

#### IOPS vs Throughput

**IOPS** (Input/Output Operations Per Second): Number of read/write operations per second
- Matters for: Databases, transactional workloads, random I/O
- Measured by: Small block size operations (4 KB, 8 KB, 16 KB)

**Throughput** (MB/s): Amount of data transferred per second
- Matters for: Big data, log processing, sequential I/O
- Measured by: Large block size operations (128 KB, 256 KB, 1 MB)

**Key insight**: IOPS and throughput are independent on gp3. You can provision 3,000 IOPS with 1,000 MB/s or 16,000 IOPS with 125 MB/s depending on workload.

**Example** (database vs big data):
- **Database**: 10,000 IOPS, 200 MB/s (small random reads/writes)
- **Big data**: 3,000 IOPS, 1,000 MB/s (large sequential reads)

#### EBS-Optimized Instances

EBS-optimized instances provide dedicated bandwidth for EBS I/O, preventing network traffic from impacting storage performance.

**How it works**:
- Dedicated EBS bandwidth separate from network bandwidth
- No contention between application network traffic and storage I/O
- Most current-generation instances are EBS-optimized by default

**EBS bandwidth by instance type** (examples):
- m5.large: 4,750 Mbps (594 MB/s)
- m5.xlarge: 4,750 Mbps
- m5.2xlarge: 4,750 Mbps
- m5.4xlarge: 4,750 Mbps
- m5.8xlarge: 6,800 Mbps (850 MB/s)
- m5.12xlarge: 9,500 Mbps (1,187 MB/s)

**Best practice**: Always use EBS-optimized instances for production workloads. Verify instance EBS bandwidth matches or exceeds volume throughput requirements.

#### RAID Configuration

RAID (Redundant Array of Independent Disks) combines multiple EBS volumes to achieve higher IOPS or throughput than a single volume supports.

**RAID 0 (striping)**:
- Combine N volumes for N× IOPS and throughput
- No redundancy (if one volume fails, all data lost)
- Example: 4× 16,000 IOPS gp3 volumes = 64,000 IOPS (vs io2 Block Express cost)

**When to use RAID 0**:
- Need >16,000 IOPS but want gp3 pricing (cheaper than io2 Block Express)
- Need >1,000 MB/s throughput

**Cost comparison** (64,000 IOPS):
- io2 Block Express (1 TB): $4,285/month
- RAID 0 with 4× gp3 (1 TB each, 16,000 IOPS each): 4× $320 = $1,280/month (**70% savings**)
- **Trade-off**: No single-volume durability, more operational complexity

**RAID 1 (mirroring)**:
- Not recommended for EBS (EBS already replicates data within AZ)
- Use EBS snapshots for backups instead

**Best practice**: Use RAID 0 only when you need >16,000 IOPS and are cost-conscious. For mission-critical workloads, use io2 Block Express for simplicity and durability.

#### Elastic Volumes

Elastic Volumes allow modifying volume type, size, and IOPS without detaching from running instance.

**What you can change**:
- Volume type: gp2 → gp3, gp3 → io2, io2 → io2 Block Express
- Size: Increase (cannot decrease)
- IOPS: Increase or decrease (gp3, io2)
- Throughput: Increase or decrease (gp3)

**How it works**:
- Modification applied in background (volume enters "optimizing" state)
- Volume remains online and accessible during modification
- Optimization completes in minutes to hours depending on size

**Limitations**:
- Cannot decrease volume size (only increase)
- Can only modify volume once every 6 hours
- Cannot change to/from Magnetic (standard) volumes

**Best practice**: Start with smaller volumes and grow as needed. Modify volume type from gp2 to gp3 for immediate 20% cost savings without downtime.

### EBS Snapshots

Snapshots are incremental backups stored in S3 with 99.999999999% durability.

#### How Snapshots Work

**Incremental**:
- First snapshot: Full copy of volume
- Subsequent snapshots: Only changed blocks
- Restoring: AWS reconstructs volume from all incremental snapshots

**Example** (1 TB volume, 10% daily change):
- Day 1: 1 TB snapshot
- Day 2: 100 GB snapshot (only changed blocks)
- Day 3: 100 GB snapshot
- Total storage after 3 days: 1.2 TB (vs 3 TB for full backups)
- **Storage savings**: 60%

**Consistency**:
- Crash-consistent by default (point-in-time capture)
- Application-consistent requires freezing I/O (use VSS, XFS freeze, or stop database writes)

**Best practice**: For databases, flush buffers and freeze I/O before snapshot. For file systems, unmount or freeze. For simpler approach, use AWS Backup for application-consistent snapshots.

#### Fast Snapshot Restore (FSR)

FSR eliminates I/O latency penalty when creating volumes from snapshots.

**Problem**: Volumes created from snapshots initialize blocks lazily (on first access). First read of each block has high latency (hundreds of milliseconds).

**Solution**: FSR pre-initializes blocks so volume has full performance immediately.

**Performance**:
- Without FSR: First access to each block = high latency
- With FSR: Instant full performance (all blocks pre-initialized)

**Pricing**:
- $0.75/hour per snapshot per AZ
- Example: 1 snapshot enabled in 1 AZ for 1 month = $0.75 × 720 hours = **$540/month**

**When to use FSR**:
- Disaster recovery requiring instant volume restoration
- Large volumes (multi-TB) where initialization takes hours
- Production databases requiring <1 minute RTO

**Don't use for**:
- Cost-sensitive workloads (expensive)
- Test/dev environments
- Volumes where manual initialization is acceptable

**Alternative**: Use `dd` or `fio` to read entire volume after creation (free, but takes time: 1 hour per TB).

**Best practice**: Enable FSR only for critical DR scenarios where cost justifies instant recovery. For most workloads, standard snapshot restore with manual initialization is cost-effective.

#### Snapshot Lifecycle and Cost Optimization

**Data Lifecycle Manager (DLM)**:
- Automate snapshot creation and deletion
- Create snapshots every 12/24 hours
- Retain snapshots for 7 days / 30 days / 1 year
- Delete old snapshots automatically

**DLM policy example** (retain daily snapshots for 7 days):
```
Target: All volumes with tag "Backup=Daily"
Schedule: Create snapshot daily at 03:00 UTC
Retention: 7 snapshots (oldest deleted automatically)
```

**Snapshot Archive tier**:
- Move old snapshots to archive storage: 75% cost savings
- Archive tier: $0.0125/GB/month vs standard $0.05/GB/month
- Restore time: 24-72 hours
- Use for: Compliance snapshots retained for years

**Cost comparison** (1 TB snapshot retained 7 years):
- Standard tier: 1,000 GB × $0.05 × 84 months = $4,200
- Archive tier: 1,000 GB × $0.0125 × 84 months = $1,050
- **Savings**: 75%

**Best practice**: Use DLM to automate snapshot creation/deletion. Move snapshots older than 90 days to archive tier for long-term retention. Delete snapshots of deleted volumes (DLM doesn't auto-delete these).

### EBS Cost Optimization

#### Right-Sizing Volumes

**Problem**: Overprovisioning volumes wastes money. Creating 1 TB volume for 100 GB data costs 10× more than necessary.

**Solution**: Start small and grow with Elastic Volumes.

**Example** (database grows from 100 GB to 500 GB over 1 year):
- **Overprovisioned**: 1 TB gp3 from day 1 = $80/month × 12 = $960/year
- **Right-sized**: Start 100 GB, grow to 500 GB after 6 months = ($8 × 6) + ($40 × 6) = $288/year
- **Savings**: 70%

**Best practice**: Provision 20-30% above current usage for growth. Monitor disk usage monthly and resize when approaching 80% full.

#### gp2 to gp3 Migration

**Immediate savings**: 20% cost reduction with same or better performance

**Example** (10× 500 GB gp2 volumes):
- gp2 cost: 10 × 500 GB × $0.10 = $500/month
- gp3 cost: 10 × 500 GB × $0.08 = $400/month
- **Savings**: $100/month ($1,200/year)

**Migration steps**:
1. Identify all gp2 volumes (AWS CLI or Cost Explorer)
2. Modify volume type: gp2 → gp3
3. No downtime, no data migration, instant 20% savings

**Best practice**: Migrate all gp2 to gp3 immediately. There's no reason to use gp2 (gp3 is newer, better, cheaper).

#### Delete Unused Volumes

**Problem**: Detached volumes continue incurring costs. Teams delete EC2 instances but forget to delete attached EBS volumes. Volumes remain "available" state charging full price.

**Identification**:
- AWS Cost Explorer: Filter by EBS volumes
- AWS CLI: List volumes with state=available
- Trusted Advisor: Detects unused volumes

**Cost impact** (100 GB gp3 volume forgotten for 1 year):
- $8/month × 12 = $96/year per volume
- If you have 50 forgotten volumes: **$4,800/year waste**

**Best practice**: Tag volumes with owner and project. Review "available" volumes monthly. Set up CloudWatch alarm when volume is detached for >7 days.

#### Snapshot Optimization

**Delete orphaned snapshots**:
- Snapshots of deleted volumes still incur costs
- DLM doesn't delete snapshots when source volume is deleted
- Manually identify and delete these snapshots

**Use incremental snapshots**:
- Don't copy full volumes; use snapshots
- Snapshots are incremental and deduplicated
- 10 full copies of 1 TB volume = 10 TB
- 10 snapshots with 10% daily change = 1.9 TB (**81% savings**)

**Best practice**: Use DLM to enforce snapshot retention policies. Archive snapshots older than 90 days for 75% cost savings. Audit snapshots quarterly for orphaned snapshots.

### EBS Security

#### Encryption at Rest

**How it works**:
- Encryption enabled per volume
- Uses AWS KMS for key management
- AES-256 encryption
- Encryption happens on EC2 host (no performance impact)

**What's encrypted**:
- Data at rest on volume
- Data in transit between volume and instance
- Snapshots created from encrypted volume
- Volumes created from encrypted snapshot

**Encryption by default**:
- Enable encryption by default for region
- All new volumes created after enabling are encrypted
- Existing unencrypted volumes remain unencrypted

**Enable encryption on unencrypted volume**:
1. Create snapshot of unencrypted volume
2. Copy snapshot with encryption enabled
3. Create volume from encrypted snapshot
4. Attach encrypted volume to instance

**Performance impact**: None (encryption handled by Nitro hardware)

**Best practice**: Enable EBS encryption by default in all regions. Use customer-managed KMS keys for compliance workloads requiring key rotation and audit trails.

#### Access Control

**IAM policies**:
- Control who can create, delete, attach, detach volumes
- Control who can create, delete snapshots
- Control who can copy snapshots between regions

**Example** (read-only snapshot access):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeSnapshots",
        "ec2:DescribeVolumes"
      ],
      "Resource": "*"
    }
  ]
}
```

**Snapshot sharing**:
- Share snapshots with specific AWS accounts
- Share snapshots publicly (not recommended for sensitive data)
- Shared snapshots can be copied to other accounts

**Best practice**: Use least privilege IAM policies. Don't share snapshots publicly. For cross-account access, share encrypted snapshots with KMS key access.

## Amazon EFS (Elastic File System)

### EFS Performance Modes

EFS offers two performance modes optimized for different latency and throughput characteristics.

#### General Purpose (Default)

**Purpose**: Lowest latency for latency-sensitive workloads

**Performance**:
- **Latency**: Low single-digit milliseconds per operation
- **IOPS**: Up to 7,000 file operations/second per file system
- **Throughput**: Scales with file system size (50 MB/s per TB of storage)

**When to use**:
- Web serving environments
- Content management systems
- Home directories
- Development environments
- General file serving

**Best practice**: Use General Purpose as default unless you have specific high-throughput requirements.

#### Max I/O

**Purpose**: Higher aggregate throughput and operations for highly parallelized workloads

**Performance**:
- **Latency**: Higher latency (tens of milliseconds)
- **IOPS**: No practical limit on file operations
- **Throughput**: Higher aggregate throughput than General Purpose

**When to use**:
- Big data analytics
- Media processing (video rendering, transcoding)
- Genomics analysis
- Thousands of instances accessing file system simultaneously

**Trade-off**: Higher latency per operation in exchange for unlimited aggregate throughput.

**Best practice**: Start with General Purpose. Switch to Max I/O only if CloudWatch metrics show you're hitting General Purpose limits.

**Warning**: Performance mode cannot be changed after creation. Must create new file system and migrate data.

### EFS Throughput Modes

EFS offers three throughput modes that determine how file system performance scales.

#### Elastic Throughput (Default, Recommended)

**Purpose**: Automatic performance scaling for spiky workloads

**How it works**:
- Throughput automatically scales up to 3 GiB/s reads and 1 GiB/s writes
- Pay only for throughput used (not provisioned)
- No performance management required

**Performance**:
- Read: Up to 3 GiB/s per file system
- Write: Up to 1 GiB/s per file system
- Scales instantly to meet demand

**Pricing**:
- Read: $0.03/GB transferred
- Write: $0.06/GB transferred

**When to use**:
- Spiky workloads (high throughput for short periods, low throughput otherwise)
- Unknown workloads (access patterns difficult to forecast)
- Workloads with <5% average-to-peak throughput ratio

**Cost example** (1 TB read during month):
- Elastic: 1,000 GB × $0.03 = $30
- Bursting: Included with storage
- **Cost**: $30 (but only if you actually read 1 TB)

**Best practice**: Use Elastic as default for new file systems. Perfect for dev/test, CI/CD, batch processing.

#### Bursting Throughput

**Purpose**: Throughput scales with file system size using credit system

**How it works**:
- Baseline: 50 MB/s per TB of storage
- Burst: Up to 100 MB/s per TB (for up to 12 hours per day)
- Uses burst credits (earned at baseline rate, consumed when bursting)

**Performance** (example file systems):
- 100 GB: 5 MB/s baseline, 10 MB/s burst
- 1 TB: 50 MB/s baseline, 100 MB/s burst
- 10 TB: 500 MB/s baseline, 1,000 MB/s burst

**Burst credits**:
- New file system: 2.1 TiB of burst credits
- Earn credits: When throughput below baseline
- Spend credits: When throughput above baseline
- Run out of credits: Throttled to baseline

**When to use**:
- Workloads with predictable, steady throughput
- Large file systems (>1 TB) where baseline throughput is sufficient
- Cost-sensitive workloads (no throughput charges)

**Best practice**: Use Bursting for file systems >1 TB with steady access patterns. Monitor burst credits in CloudWatch; if frequently depleted, switch to Elastic or Provisioned.

#### Provisioned Throughput

**Purpose**: Provision specific throughput independent of file system size

**How it works**:
- Specify throughput (MB/s) needed
- Pay for provisioned throughput regardless of usage
- File system delivers provisioned throughput consistently

**Pricing**:
- $6/MB/s/month (US East)

**When to use**:
- Small file systems (<1 TB) needing high throughput
- Consistent high throughput (>5% average-to-peak ratio)
- Predictable workloads where you can optimize provisioning

**Cost example** (100 GB file system, need 100 MB/s):
- Bursting: 100 GB × 50 MB/s per TB = 5 MB/s baseline (insufficient)
- Provisioned: 100 MB/s × $6 = $600/month
- Elastic: Pay only for throughput used (likely cheaper than $600)

**Best practice**: Use Provisioned only for small file systems with high, consistent throughput. For most workloads, Elastic is simpler and cheaper.

### EFS Storage Classes

EFS offers four storage classes with lifecycle management to automatically optimize costs.

#### Standard (Regional)

**Purpose**: Frequently accessed data requiring high availability

**Characteristics**:
- Replicated across multiple AZs (99.99% availability)
- Lowest latency
- Highest cost

**Pricing** (US East):
- Storage: $0.30/GB/month

**When to use**:
- Active datasets accessed daily/weekly
- Shared web content
- Container persistent volumes
- Home directories

#### Infrequent Access (Standard-IA)

**Purpose**: Infrequently accessed data with multi-AZ redundancy

**Characteristics**:
- Replicated across multiple AZs
- Lower latency than One Zone-IA
- 92% cheaper storage than Standard
- Per-GB retrieval fee

**Pricing** (US East):
- Storage: $0.025/GB/month (92% savings vs Standard)
- Access: $0.01/GB retrieval

**When to use**:
- Files accessed monthly or quarterly
- Backup and archive data requiring high availability
- Compliance data accessed occasionally

**Cost comparison** (1 TB stored, accessed once per month):
- Standard: $300/month
- Standard-IA: $25 storage + $10 access = $35/month (**88% savings**)

#### One Zone

**Purpose**: Frequently accessed data where multi-AZ redundancy is not required

**Characteristics**:
- Single AZ (lower availability than Standard)
- 47% cheaper than Standard
- Same performance as Standard

**Pricing** (US East):
- Storage: $0.16/GB/month

**When to use**:
- Development and testing environments
- Recreatable data (cache, temporary files)
- Data replicated from on-premises (already has off-cloud backup)

**Risk**: If AZ fails, data is lost. Use only for non-critical or recreatable data.

#### One Zone-IA

**Purpose**: Lowest-cost storage for infrequently accessed, non-critical data

**Characteristics**:
- Single AZ
- 92% cheaper than One Zone
- Per-GB retrieval fee

**Pricing** (US East):
- Storage: $0.0133/GB/month (96% savings vs Standard)
- Access: $0.01/GB retrieval

**When to use**:
- Archived data rarely accessed
- Backups of dev/test environments
- Lowest-cost option when multi-AZ redundancy not required

**Cost comparison** (1 TB stored, accessed once per quarter):
- Standard: $300/month
- One Zone-IA: $13.30/month (**96% savings**)

### EFS Intelligent-Tiering

Intelligent-Tiering automatically moves files between Standard and IA tiers based on access patterns.

**How it works**:
- Configure lifecycle policy: 7, 14, 30, 60, or 90 days
- Files not accessed for policy duration move to IA tier
- Files moved back to Standard on first access

**Lifecycle policies available**:
- Transition to IA after: 1, 7, 14, 30, 60, or 90 days of no access
- Transition to Archive after: 30, 60, 90, 180, 270, or 365 days of no access (future feature)

**Example** (1 TB file system, 500 GB accessed weekly, 500 GB not accessed for 30+ days):
- Without lifecycle: 1 TB × $0.30 = $300/month
- With lifecycle (30-day IA): (500 GB × $0.30) + (500 GB × $0.025) = $150 + $12.50 = $162.50/month
- **Savings**: 46%

**Best practice**: Enable Intelligent-Tiering with 30-day policy for all file systems. No operational overhead, automatic cost optimization.

### EFS Cost Optimization

#### Use Lifecycle Management

**Enable for all file systems**:
- 30-day lifecycle policy provides best balance (files stale after a month move to IA)
- Monitor access patterns in CloudWatch
- Adjust policy based on actual access frequency

**Savings potential**:
- 50-92% for files transitioned to IA
- Average savings across mixed workloads: 40-60%

**Best practice**: Start with 30-day policy. If CloudWatch shows files frequently accessed after 30 days, increase to 60 or 90 days.

#### Use One Zone for Non-Critical Data

**When appropriate**:
- Dev/test environments (47% savings vs Standard)
- Recreatable data (build artifacts, caches)
- Data replicated from other sources

**Risk mitigation**:
- Back up critical files to S3
- Document that data is single-AZ
- Don't use for production workloads requiring HA

**Cost comparison** (1 TB dev environment):
- Standard: $300/month
- One Zone: $160/month (**47% savings**)

#### Right-Size Throughput Mode

**Elastic vs Bursting**:
- If file system >1 TB with steady access: Use Bursting (included with storage)
- If file system <1 TB or spiky access: Use Elastic (pay for throughput used)

**Example** (100 GB file system, 10 GB reads per month):
- Bursting: Baseline = 5 MB/s (may be insufficient)
- Elastic: 10 GB × $0.03 = $0.30/month
- **Elastic is cheaper and provides better performance**

**Best practice**: Use Elastic unless you have >1 TB and steady throughput (then use Bursting).

#### Delete Unused File Systems

**Problem**: Deleted EC2 instances or projects leave unused EFS file systems.

**Identification**:
- CloudWatch metrics: BytesRead, BytesWritten = 0 for 30+ days
- Cost Explorer: EFS costs with no usage

**Cost impact** (100 GB unused file system):
- $30/month × 12 = $360/year waste

**Best practice**: Tag file systems with project/owner. Review usage quarterly. Delete file systems with zero I/O for 90+ days.

### EFS Security

#### Encryption

**Encryption at rest**:
- Enable encryption when creating file system (cannot enable later)
- Uses AWS KMS for key management
- AES-256 encryption
- No performance impact

**Encryption in transit**:
- Use EFS mount helper with TLS option
- Encrypts data between EC2 instance and EFS
- Mount command: `mount -t efs -o tls fs-12345:/ /mnt/efs`

**Best practice**: Always create encrypted file systems. Use TLS for encryption in transit. Enable encryption by default in AWS Config.

#### Access Control

**POSIX permissions**:
- Standard Linux file permissions (owner, group, other)
- Set permissions at file/directory level
- Enforced at application level

**IAM policies**:
- Control who can create, delete file systems
- Control who can mount file systems
- Control who can modify file system settings

**EFS Access Points**:
- Application-specific entry points into file system
- Enforce user identity and root directory per Access Point
- Simplify access management for multiple applications

**Example** (separate access for web app and batch jobs):
- Access Point 1: `/web-content` with user `www-data`
- Access Point 2: `/batch-jobs` with user `batch-user`
- Each application mounts via its Access Point, sees only its directory

**Best practice**: Use Access Points to enforce least privilege. Don't use root credentials to mount file systems. Use IAM roles for EC2/Fargate to authenticate mounts.

#### Network Security

**VPC security groups**:
- EFS mount targets exist in VPC subnets
- Control access with security group rules
- Allow NFS traffic (port 2049) from specific sources

**Example** (allow access from web servers only):
```
EFS security group:
Inbound: NFS (2049) from web-server-security-group
```

**VPC endpoints**:
- Not required for EFS (EFS natively integrates with VPC)
- Mount targets automatically private (no internet exposure)

**Best practice**: Use security groups to restrict access to specific EC2 instances or subnets. Never allow 0.0.0.0/0 access to EFS mount targets.

## When to Use EBS vs EFS vs S3

| Use Case | EBS | EFS | S3 |
|----------|-----|-----|-----|
| **EC2 boot volume** | ✅ | ❌ | ❌ |
| **Database (MySQL, PostgreSQL)** | ✅ | ❌ | ❌ |
| **Single EC2 persistent storage** | ✅ | ⚠️ (works but expensive) | ⚠️ (API access only) |
| **Multi-instance shared storage** | ❌ | ✅ | ⚠️ (object storage) |
| **Container persistent volumes** | ⚠️ (single container) | ✅ | ❌ |
| **Lambda persistent storage** | ❌ | ✅ | ⚠️ (API access) |
| **Shared web content** | ❌ | ✅ | ✅ |
| **Big data analytics** | ⚠️ (st1) | ⚠️ (if shared) | ✅ |
| **Backup/archive** | ⚠️ (snapshots) | ❌ | ✅ |
| **Cost-sensitive storage** | ⚠️ ($0.08/GB) | ❌ ($0.30/GB) | ✅ ($0.023/GB) |

### Decision Framework

**Choose EBS when**:
- ✅ Single EC2 instance needs persistent storage
- ✅ Running databases (MySQL, PostgreSQL, MongoDB, etc.)
- ✅ Need high IOPS or low latency (<1ms)
- ✅ Boot volumes
- ✅ Cost per GB is important (2-4x cheaper than EFS)

**Choose EFS when**:
- ✅ Multiple instances need shared file access
- ✅ Containers/Kubernetes need persistent volumes
- ✅ Lambda needs persistent storage for ML models or shared state
- ✅ Auto-scaling without capacity planning
- ✅ Multi-AZ redundancy required

**Choose S3 when**:
- ✅ Object storage (files, not file system)
- ✅ Long-term archive or backup
- ✅ Static website hosting
- ✅ Data lakes
- ✅ Lowest cost per GB
- ✅ Access from serverless (Lambda with SDK, not file system)

### Cost Comparison (1 TB storage, 1 year)

| Service | Configuration | Annual Cost |
|---------|---------------|-------------|
| **EBS** | gp3 (3,000 IOPS) | $960 |
| **EBS** | io2 Block Express (64,000 IOPS) | $51,420 |
| **EFS** | Standard | $3,600 |
| **EFS** | Standard-IA (accessed 1x/month) | $420 |
| **EFS** | One Zone | $1,920 |
| **S3** | Standard | $276 |
| **S3** | Intelligent-Tiering (infrequent) | $150 |

**Key insight**: EBS is cheapest for single-instance block storage. S3 is cheapest for object storage. EFS is most expensive but necessary for multi-instance file sharing.

## Common Pitfalls

### 1. Using gp2 Instead of gp3

**Problem**: gp2 is 20% more expensive than gp3 with same or worse performance. gp2 is the older generation; gp3 is newer and better.

**Cost impact** (100× 500 GB gp2 volumes):
- gp2: 100 × 500 GB × $0.10 = $5,000/month
- gp3: 100 × 500 GB × $0.08 = $4,000/month
- **Annual waste**: $12,000

**Solution**: Migrate all gp2 to gp3 using Elastic Volumes. No downtime, instant savings.

**Best practice**: Use gp3 as default for all new volumes. Create organization-wide policy to prevent gp2 creation.

### 2. Overprovisioning IOPS on gp3

**Problem**: Provisioning 16,000 IOPS when workload only needs 3,000 wastes money.

**Cost impact** (500 GB volume, 16,000 IOPS provisioned, only 3,000 used):
- Storage: $40/month
- Excess IOPS: (16,000 - 3,000) × $0.005 = $65/month
- **Total waste**: $65/month per volume

**Solution**: Monitor IOPS usage with CloudWatch metrics (VolumeReadOps, VolumeWriteOps). Right-size IOPS to actual usage + 20% buffer.

**Best practice**: Start with baseline 3,000 IOPS. Increase only if CloudWatch shows consistent usage near 3,000.

### 3. Not Enabling EBS Encryption by Default

**Problem**: Creating unencrypted volumes violates compliance. Manually encrypting later requires downtime and effort.

**Solution**: Enable EBS encryption by default in each region.

**Steps**:
1. EC2 Console → Account Attributes → EBS encryption
2. Enable "Always encrypt new EBS volumes"
3. All new volumes created after this are encrypted

**Best practice**: Enable in all regions immediately. Use AWS Config to detect unencrypted volumes and alert.

### 4. Forgetting to Delete Detached Volumes

**Problem**: Deleting EC2 instance doesn't delete attached EBS volumes by default. Volumes remain in "available" state charging full price.

**Cost impact** (100 GB gp3 volume forgotten for 2 years):
- $8/month × 24 months = $192 waste

**Solution**:
- Set "Delete on Termination" flag when creating volumes
- Review "available" volumes monthly and delete unused
- Tag volumes with owner/project for accountability

**Best practice**: Default "Delete on Termination" to true for non-root volumes. Set CloudWatch alarm for volumes detached >30 days.

### 5. Using EFS for Single-Instance Workloads

**Problem**: EFS costs $0.30/GB vs EBS $0.08/GB. Using EFS when EBS suffices wastes 3.75× money.

**Cost impact** (1 TB single EC2 instance storage):
- EFS: $300/month
- EBS gp3: $80/month
- **Annual waste**: $2,640

**Solution**: Use EBS for single-instance storage. Use EFS only when multiple instances need shared access.

**Best practice**: Ask "Do multiple instances need to access this storage?" If no, use EBS.

### 6. Not Using EFS Lifecycle Management

**Problem**: Storing all data in Standard tier when 50-80% is infrequently accessed wastes money.

**Cost impact** (1 TB file system, 500 GB not accessed for 30+ days):
- Without lifecycle: $300/month
- With lifecycle: $150 + $12.50 = $162.50/month
- **Annual waste**: $1,650

**Solution**: Enable lifecycle management with 30-day policy on all file systems.

**Best practice**: Enable lifecycle when creating file system. Monitor CloudWatch to verify files are transitioning to IA.

### 7. Using Provisioned IOPS for Workloads That Don't Need It

**Problem**: io2 costs 56% more storage + IOPS costs. Using io2 when gp3 provides sufficient performance wastes money.

**Cost impact** (500 GB, 10,000 IOPS):
- gp3: $40 storage + $35 IOPS = $75/month
- io2: $62.50 storage + $650 IOPS = $712.50/month
- **Waste**: $637.50/month ($7,650/year)

**Solution**: Use gp3 for workloads <16,000 IOPS. Only use io2 Block Express when you need >16,000 IOPS or sub-millisecond latency.

**Best practice**: Monitor actual IOPS usage with CloudWatch. If consistently below 16,000 IOPS, use gp3.

### 8. Not Using Fast Snapshot Restore Sparingly

**Problem**: FSR costs $540/month per snapshot per AZ. Enabling for all snapshots is expensive.

**Cost impact** (10 snapshots in 2 AZs):
- 10 snapshots × 2 AZs × $540/month = $10,800/month ($129,600/year)

**Solution**: Enable FSR only for DR snapshots requiring instant recovery. For test/dev, use standard snapshots and manually initialize.

**Best practice**: Limit FSR to <5 critical snapshots. Document business justification for each FSR-enabled snapshot.

### 9. Not Cleaning Up Old Snapshots

**Problem**: Snapshots of deleted volumes continue incurring costs indefinitely.

**Cost impact** (100× 100 GB orphaned snapshots):
- 100 snapshots × 100 GB × $0.05 = $500/month ($6,000/year waste)

**Solution**: Use DLM to automate snapshot retention. Audit snapshots quarterly to identify orphans.

**Best practice**: Tag snapshots with source volume ID. Use Lambda to detect and delete snapshots of deleted volumes.

### 10. Using EBS for Shared Storage Between Instances

**Problem**: EBS attaches to single instance (except Multi-Attach io2, which is complex and expensive). Attempting to share data between instances with EBS requires copying data or complex NFS setup.

**Solution**: Use EFS for shared storage. It's designed for multi-instance access.

**Best practice**: Ask "Will multiple instances need this data?" If yes, use EFS. If no, use EBS.

### 11. Not Using Elastic Throughput for EFS Spiky Workloads

**Problem**: Provisioned Throughput charges $6/MB/s/month even when not used. Spiky workloads pay for peak throughput 24/7.

**Cost impact** (100 MB/s needed 1 hour/day):
- Provisioned: 100 MB/s × $6 = $600/month
- Elastic: ~$10/month (pay only for actual throughput used)
- **Waste**: $590/month ($7,080/year)

**Solution**: Use Elastic Throughput for spiky workloads (CI/CD, batch processing, dev/test).

**Best practice**: Default to Elastic Throughput unless you have steady, predictable throughput (then use Bursting for >1 TB file systems).

### 12. Not Archiving Old Snapshots

**Problem**: Keeping all snapshots in standard tier when archive tier is 75% cheaper.

**Cost impact** (1 TB snapshot retained 3 years):
- Standard: 1,000 GB × $0.05 × 36 months = $1,800
- Archive: 1,000 GB × $0.0125 × 36 months = $450
- **Waste**: $1,350 per snapshot

**Solution**: Move snapshots older than 90 days to archive tier.

**Best practice**: Use DLM to automatically archive snapshots after 90 days. Keep recent snapshots (7-30 days) in standard tier for fast recovery.

### 13. Not Right-Sizing EBS Volume Sizes

**Problem**: Overprovisioning volume size wastes money. Creating 1 TB volume when you only need 200 GB costs 5× more.

**Cost impact** (1 TB provisioned, 200 GB used):
- Cost: $80/month
- Needed: $16/month
- **Waste**: $64/month ($768/year)

**Solution**: Monitor disk usage with CloudWatch metrics (VolumeUsedBytes). Provision 20-30% above current usage.

**Best practice**: Start small (100-200 GB). Grow with Elastic Volumes as needed. Review disk usage quarterly.

### 14. Using General Purpose Performance Mode When Max I/O Is Needed

**Problem**: General Purpose limits at 7,000 operations/second. Workloads with thousands of instances may hit this limit, causing throttling.

**Solution**: Monitor CloudWatch metrics (PercentIOLimit). If consistently >90%, switch to Max I/O performance mode.

**Caveat**: Cannot change performance mode after file system creation. Must create new file system and migrate data.

**Best practice**: Start with General Purpose. Only use Max I/O for workloads with >1,000 instances or high-parallelization (big data, media processing).

### 15. Not Using EBS Multi-Attach for Shared Block Storage

**Problem**: Attempting to build shared block storage with application-level replication when Multi-Attach io2 provides this natively.

**Solution**: For clustered applications (Oracle RAC, GFS2), use Multi-Attach io2 instead of building custom replication.

**Limitations**:
- Only available on io2 and io2 Block Express
- Up to 16 instances in same AZ
- Requires cluster-aware file system (not ext4/xfs)

**Best practice**: Use Multi-Attach for clustered databases or shared block storage. For shared file storage, use EFS (simpler, cheaper, multi-AZ).

## Key Takeaways

1. **gp3 is the default for EBS**: 20% cheaper than gp2 with better performance. Migrate all gp2 to gp3 immediately for instant savings. Use gp3 for boot volumes, databases (small-medium), and general workloads.

2. **Use io2 Block Express sparingly**: Only for workloads requiring >16,000 IOPS or sub-millisecond latency. For <16,000 IOPS, gp3 is significantly cheaper ($75 vs $712 for 10,000 IOPS).

3. **EBS vs EFS decision is about sharing**: Use EBS for single-instance storage (cheaper, lower latency). Use EFS for multi-instance storage (auto-scaling, multi-AZ). Don't use EFS for single-instance workloads (3.75× more expensive than EBS).

4. **Enable EFS Intelligent-Tiering by default**: 30-day lifecycle policy provides 40-60% average savings with no operational overhead. Files automatically move to IA tier when not accessed, move back on access.

5. **Elastic Throughput is the new EFS default**: Automatically scales to 3 GiB/s reads, 1 GiB/s writes. Pay only for throughput used. Perfect for spiky workloads (CI/CD, batch processing). Use Bursting for >1 TB file systems with steady throughput.

6. **Snapshots are incremental and cost-effective**: First snapshot is full copy, subsequent snapshots only store changed blocks. Use DLM to automate snapshot creation/deletion. Archive snapshots older than 90 days for 75% savings.

7. **Fast Snapshot Restore is expensive ($540/month per snapshot per AZ)**: Use only for DR scenarios requiring instant recovery. For most workloads, standard snapshots with manual initialization is cost-effective (1 hour per TB).

8. **Enable EBS encryption by default**: Prevents accidental unencrypted volume creation. No performance impact (handled by Nitro hardware). Use customer-managed KMS keys for compliance workloads requiring key rotation.

9. **Delete unused volumes and snapshots**: Detached volumes continue charging full price. Orphaned snapshots (from deleted volumes) continue incurring costs. Review "available" volumes and orphaned snapshots monthly.

10. **Right-size volumes and IOPS**: Don't overprovision. Start with 3,000 IOPS on gp3 and grow as needed. Monitor CloudWatch metrics (VolumeReadOps, VolumeWriteOps, VolumeUsedBytes) to identify optimization opportunities.

11. **Use One Zone for non-critical EFS workloads**: 47% cheaper than Standard for dev/test environments and recreatable data. Accept single-AZ risk for cost savings. Back up critical files to S3.

12. **EFS cost is driven by storage tier**: Standard ($0.30/GB) is 12× more expensive than Standard-IA ($0.025/GB). Lifecycle management moves files to IA automatically. Enable for all file systems.

13. **Multi-Attach io2 enables shared block storage**: Up to 16 instances can attach to single io2/io2 Block Express volume. Use for clustered databases (Oracle RAC). Requires cluster-aware file system (GFS2, Oracle ACFS).

14. **Performance modes cannot be changed**: General Purpose vs Max I/O is set at file system creation. Start with General Purpose unless you have thousands of instances. Monitor PercentIOLimit in CloudWatch.

15. **Cost comparison per GB** (monthly):
    - **EBS gp3**: $0.08/GB (single instance, high IOPS)
    - **EBS io2**: $0.125/GB + IOPS cost (highest performance)
    - **EFS Standard**: $0.30/GB (multi-instance, multi-AZ)
    - **EFS One Zone**: $0.16/GB (multi-instance, single-AZ)
    - **EFS Standard-IA**: $0.025/GB + retrieval (infrequent access)
    - **S3 Standard**: $0.023/GB (object storage, cheapest)
