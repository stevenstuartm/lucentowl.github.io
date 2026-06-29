---
title: "AWS RDS & Aurora for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "Comprehensive guide to AWS RDS and Aurora covering database engines, high availability, performance optimization, Aurora Serverless, cost management, and when to use RDS vs Aurora"
tags: [aws, rds, aurora, databases, relational-database, high-availability, cost-optimization, fundamentals]
---

## What Is Amazon RDS?

Amazon Relational Database Service (RDS) is a managed database service that handles operational tasks like provisioning, patching, backup, recovery, and scaling. RDS supports six database engines: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, and Db2.

**What Problems RDS Solves**:
- **Operational overhead**: Eliminates manual database administration tasks (patching, backups, monitoring)
- **High availability**: Provides Multi-AZ deployments with automated failover (<35 seconds for Multi-AZ DB clusters)
- **Scalability**: Supports vertical scaling (resize instances) and horizontal scaling (read replicas)
- **Compliance**: Meets security and compliance requirements (encryption at rest/transit, audit logging, VPC isolation)
- **Cost predictability**: Pay-as-you-go pricing with Reserved Instance options (up to 69% savings vs on-demand)

**When to use RDS**:
- You need a managed relational database without operational complexity
- You require compatibility with specific database engines (Oracle, SQL Server, Db2)
- Your workload has predictable performance requirements
- You want lower costs compared to Aurora for non-critical or development workloads

## What Is Amazon Aurora?

Amazon Aurora is a MySQL- and PostgreSQL-compatible relational database built for the cloud. Aurora delivers up to 5x the throughput of MySQL and 3x the throughput of PostgreSQL while providing commercial-grade availability and durability.

**What Makes Aurora Different**:
- **Cloud-native storage**: Distributed, fault-tolerant storage layer that replicates data across 3 Availability Zones (6 copies)
- **Performance**: Superior throughput compared to standard RDS engines
- **Auto-scaling storage**: Grows automatically from 10 GB to 128 TB in 10 GB increments
- **Fast recovery**: Crash recovery is nearly instantaneous (no replay of database redo logs)
- **Advanced features**: Aurora Serverless v2, Global Database, I/O-Optimized configuration

**When to use Aurora**:
- You need premium performance for read-intensive or dynamic workloads
- You require global database replication with <1 second lag
- You want auto-scaling capacity without manual intervention (Aurora Serverless v2)
- You need up to 15 read replicas (vs 5 for standard RDS)

## RDS vs Aurora: Decision Framework

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Amazon RDS</h4>
<ul>
<li><strong>Best for:</strong> Predictable workloads, engine compatibility</li>
<li><strong>Performance:</strong> Standard engine performance</li>
<li><strong>Storage:</strong> gp3, Provisioned IOPS (up to 64 TB)</li>
<li><strong>Read Replicas:</strong> Up to 5</li>
<li><strong>Failover:</strong> 60-120 seconds (Multi-AZ)</li>
<li><strong>Pricing:</strong> Lower baseline cost</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Amazon Aurora</h4>
<ul>
<li><strong>Best for:</strong> Dynamic workloads, read-heavy, global apps</li>
<li><strong>Performance:</strong> 5x MySQL, 3x PostgreSQL throughput</li>
<li><strong>Storage:</strong> Auto-scaling (10 GB to 128 TB)</li>
<li><strong>Read Replicas:</strong> Up to 15</li>
<li><strong>Failover:</strong> &lt;35 seconds (Multi-AZ DB cluster)</li>
<li><strong>Pricing:</strong> 20-30% premium, better performance/GB</li>
</ul>
</div>
</div>

| Dimension | Amazon RDS | Amazon Aurora |
|-----------|------------|---------------|
| **Database Engines** | MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Db2 | MySQL-compatible, PostgreSQL-compatible |
| **Performance** | Standard engine performance | 5x MySQL, 3x PostgreSQL throughput |
| **Storage** | gp3, Provisioned IOPS (up to 64 TB) | Auto-scaling (10 GB to 128 TB) |
| **Read Replicas** | Up to 5 | Up to 15 |
| **Failover Time** | 60-120 seconds (Multi-AZ) | <35 seconds (Multi-AZ DB cluster) |
| **Replication Lag** | Asynchronous (seconds to minutes) | <100ms typical |
| **Pricing** | Lower baseline cost | 20-30% premium, but better performance/GB |
| **Use Case** | Predictable workloads, engine compatibility | Dynamic workloads, read-heavy, global apps |

**Cost Comparison Example** (db.r6g.xlarge in us-east-1):
- **RDS MySQL**: $0.252/hour on-demand ($185/month) + storage ($0.115/GB gp3)
- **Aurora MySQL**: $0.29/hour on-demand ($213/month) + I/O charges ($0.20 per million requests) or I/O-Optimized ($0.348/hour, $255/month)
- **Savings Plans**: Up to 69% off on-demand pricing for 1-year or 3-year commitment

## RDS Instance Types and Storage

### Instance Classes

RDS offers three instance families optimized for different workload characteristics:

**General Purpose (db.m)**:
- **db.m8g** (Graviton4): Latest generation, up to 48 vCPUs, 192 GB RAM, best price-performance
- **db.m7i** (Intel Xeon): Up to 48 vCPUs, 192 GB RAM, for Intel-dependent workloads
- **db.m7g** (Graviton3): Previous Graviton generation, still highly efficient
- **Use case**: Balanced compute and memory for most production workloads

**Memory Optimized (db.r)**:
- **db.r8g** (Graviton4): Latest generation, up to 48 vCPUs, 384 GB RAM, 2:1 memory-to-vCPU ratio
- **db.r7i** (Intel Xeon): Up to 48 vCPUs, 384 GB RAM
- **db.r7g** (Graviton3): Previous Graviton generation
- **Use case**: Memory-intensive workloads, large datasets, high-concurrency applications

**Burstable (db.t)**:
- **db.t4g** (Graviton2): 2-8 vCPUs, 0.5-32 GB RAM, baseline performance with burst credits
- **Use case**: Development, testing, low-traffic applications with intermittent spikes

<div class="callout callout--tip">
<p class="callout__title">Graviton Instance Advantage</p>
<p>Graviton-based instances (m8g, r8g, t4g) provide up to 40% better price-performance compared to Intel/AMD equivalents. This is one of the easiest ways to reduce costs without sacrificing performance.</p>
</div>

### Storage Types

| Storage Type | Use Case | IOPS | Throughput | Cost (us-east-1) |
|--------------|----------|------|------------|------------------|
| **General Purpose SSD (gp3)** | Most workloads | 3,000-16,000 baseline | 125-1,000 MB/s | $0.115/GB/month |
| **Provisioned IOPS SSD (io2)** | OLTP, latency-sensitive | Up to 256,000 | Up to 4,000 MB/s | $0.125/GB + $0.065/IOPS |
| **Magnetic** | Legacy only | ~100 | Low | $0.10/GB (deprecated) |

**Storage Best Practices**:
- **Default to gp3**: Balanced performance for 95% of workloads, 20% cheaper than gp2
- **Use Provisioned IOPS for production OLTP**: When you need consistent high IOPS (>16,000) or sub-millisecond latency
- **Migrate from gp2**: gp3 provides 3,000 baseline IOPS regardless of size (gp2 scales IOPS with size at 3 IOPS/GB)
- **Size storage appropriately**: RDS storage auto-scales, but oversizing wastes cost; start with actual needs + 20% headroom

## High Availability: Multi-AZ Deployments

Multi-AZ provides automatic failover to a standby instance in a different Availability Zone when the primary fails.

### Multi-AZ Deployment (Traditional)

**How it works**:
- Synchronous replication to a standby instance in a different AZ
- Automatic failover in 60-120 seconds when primary fails
- Standby instance is not accessible for reads (passive)
- Failover triggers: AZ failure, primary instance failure, OS patching, storage failure

**Cost**: ~30% premium over single-AZ (you pay for the standby instance)

**Use case**: Production workloads requiring 99.95%+ availability

### Multi-AZ DB Cluster (Newer Option)

**How it works**:
- One primary instance (read/write) + two readable standby instances across 3 AZs
- Faster failover (<35 seconds) compared to traditional Multi-AZ
- Standby instances are readable (can offload read traffic)
- Dedicated transaction log instances for faster commits

**Cost**: ~50% premium over single-AZ (three instances total)

**Use case**: Mission-critical workloads requiring <35 second recovery and readable standbys

**Comparison**:

| Feature | Multi-AZ Deployment | Multi-AZ DB Cluster |
|---------|---------------------|---------------------|
| **Failover Time** | 60-120 seconds | <35 seconds |
| **Readable Standbys** | No | Yes (2 readable standbys) |
| **AZ Coverage** | 2 AZs | 3 AZs |
| **Cost Premium** | ~30% | ~50% |
| **Engines** | All RDS engines | MySQL, PostgreSQL |

## Read Replicas

Read replicas allow you to offload read traffic from the primary instance to one or more replicas.

**RDS Read Replicas**:
- Up to 5 read replicas per primary instance
- Asynchronous replication (typical lag: seconds to minutes depending on workload)
- Can be in the same Region or cross-Region
- Can be promoted to standalone instances
- **Use case**: Scale read-heavy workloads, analytics queries, disaster recovery

**Aurora Read Replicas**:
- Up to 15 read replicas sharing the same storage layer
- Replication lag typically <100ms (much faster than RDS)
- Auto-scaling read replicas based on load
- Failover target (one replica becomes primary if primary fails)
- **Use case**: Highly concurrent read traffic, global applications

**Replication Lag Considerations**:
- **<1 second lag**: Acceptable for most applications (eventual consistency tolerated)
- **>5 seconds lag**: Indicates replica struggling to keep up; consider larger instance or reduce write volume
- **Monitor CloudWatch metric**: `ReplicaLag` for RDS, `AuroraReplicaLag` for Aurora

## Aurora Serverless v2

Aurora Serverless v2 automatically scales database capacity based on application demand, eliminating the need to provision and manage instances.

**How it works**:
- Capacity measured in Aurora Capacity Units (ACUs): 1 ACU = 2 GB RAM + corresponding CPU/networking
- Scales from 0.5 ACUs to 256 ACUs in fine-grained increments
- Scaling happens in seconds without interrupting connections
- Pay only for capacity used per second ($0.12/ACU hour in us-east-1)

**When to use Aurora Serverless v2**:
- **Variable workloads**: Traffic patterns with unpredictable spikes (e.g., SaaS applications with usage variations)
- **Development/test environments**: Only pay for capacity when actively used
- **Multi-tenant applications**: Auto-scale per tenant load without manual intervention
- **Infrequently accessed applications**: Scale down to minimum during idle periods

**Cost Example**:
- **Provisioned Aurora**: db.r6g.large ($0.174/hour = $128/month) always running
- **Serverless v2**: 0.5 ACUs minimum ($0.06/hour = $44/month) + scaling for peaks
- **Savings**: 66% cost reduction for workloads idle 50%+ of the time

**Minimum Capacity Considerations**:
- **Global Database**: Requires minimum 8 ACUs for secondary regions
- **Read replicas**: Each replica has independent ACU scaling
- **Cold start**: No cold start delay (capacity adjusts in seconds, not minutes)

**2025 Performance Improvements**: Aurora Serverless v2 received 30% performance improvement for write-heavy workloads in early 2025.

## Aurora Global Database

Aurora Global Database enables a single database to span multiple AWS Regions with sub-second replication and disaster recovery.

**How it works**:
- One primary Region (read/write) + up to 5 secondary Regions (read-only)
- Replication lag typically <1 second across Regions
- Each secondary Region can have up to 16 read replicas
- Promotes a secondary Region to primary in <1 minute during disaster recovery

**Cost**:
- **Replication charges**: $0.20 per million replicated write I/Os
- **Cross-Region data transfer**: $0.02/GB
- **Example**: 1 million writes/day = $6/month replication cost

**Use cases**:
- **Disaster recovery**: <1 minute RTO (Recovery Time Objective), <1 second RPO (Recovery Point Objective)
- **Low-latency global reads**: Serve users from nearest Region with local read replicas
- **Business continuity**: Entire Region failure doesn't impact global availability

**Performance Expectations**:
- **Replication lag**: <1 second typical (99th percentile)
- **Failover time**: <1 minute to promote secondary Region
- **Write forwarding**: Secondary Regions can forward writes to primary (adds latency)

## Aurora I/O-Optimized

Traditionally, Aurora charged per I/O request ($0.20 per million), which made costs unpredictable for write-heavy workloads. Aurora I/O-Optimized (introduced 2023) eliminates I/O charges in exchange for higher instance costs.

**Pricing Comparison** (db.r6g.xlarge in us-east-1):

| Configuration | Instance Cost | I/O Cost | Total (1B I/Os/month) |
|---------------|---------------|----------|-----------------------|
| **Standard** | $0.29/hour ($213/month) | $0.20/million I/Os | $213 + $200 = $413 |
| **I/O-Optimized** | $0.348/hour ($255/month) | $0 | $255 |

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Aurora I/O-Optimized</h4>
<p><strong>When to use:</strong></p>
<ul>
<li>I/O costs exceed 25% of total Aurora spend</li>
<li>Write-heavy workloads with unpredictable I/O patterns</li>
<li>Simplified cost forecasting (instance cost only)</li>
</ul>
<p><strong>Pricing:</strong> Higher instance cost, $0 I/O charges</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Aurora Standard</h4>
<p><strong>When to use:</strong></p>
<ul>
<li>Read-heavy workloads with low I/O</li>
<li>I/O costs &lt;25% of total spend</li>
<li>Predictable I/O patterns</li>
</ul>
<p><strong>Pricing:</strong> Lower instance cost, $0.20 per million I/Os</p>
</div>
</div>

**Migration**: You can switch between Standard and I/O-Optimized configurations without downtime.

## Blue/Green Deployments

Blue/Green deployments allow you to create a staging environment (green) that's a clone of production (blue), test changes safely, and switch traffic with <1 minute downtime.

**How it works**:
1. Create green environment (clone of blue production database)
2. Apply changes to green: major version upgrades, schema changes, parameter changes
3. Test changes in green environment
4. Switch traffic from blue to green (<1 minute switchover)
5. Blue environment remains available as rollback option

<div class="callout callout--tip">
<p class="callout__title">Blue/Green Deployment Advantage</p>
<p>Blue/Green deployments reduce major version upgrade downtime from hours to less than 1 minute. The blue environment remains available as a rollback option, making upgrades much safer.</p>
</div>

**Use cases**:
- **Major version upgrades**: PostgreSQL 12 → 15, MySQL 5.7 → 8.0
- **Schema changes**: Test DDL changes before applying to production
- **Parameter tuning**: Validate configuration changes
- **Disaster recovery drills**: Practice failover without affecting production

**Cost**: You pay for both environments during testing period (typically hours to days)

**Supported Engines**: RDS MySQL, RDS PostgreSQL, Aurora MySQL, Aurora PostgreSQL

## Cost Optimization

### Reserved Instances and Savings Plans

**Reserved Instances** (1-year or 3-year commitment):
- **1-year partial upfront**: 37% savings
- **3-year all upfront**: 69% savings
- Applies to specific instance class and engine

**Savings Plans** (more flexible):
- Commit to consistent spend ($/hour) for 1 or 3 years
- Applies across instance families, sizes, and Regions
- Up to 72% savings for Aurora

**Strategy**:
- Use Reserved Instances for stable baseline capacity
- Use on-demand or Savings Plans for variable capacity
- Combine with Aurora Serverless v2 for cost-effective auto-scaling

### Storage Cost Management

**RDS Storage**:
- **gp3 default**: $0.115/GB/month
- **Snapshot storage**: $0.095/GB/month (incremental)
- Delete old snapshots (retention >35 days typically unnecessary)
- Automated backups: Free (equal to database size), manual snapshots billed separately

**Aurora Storage**:
- **Standard**: $0.10/GB/month + I/O charges ($0.20/million)
- **I/O-Optimized**: $0.25/GB/month, no I/O charges
- **Snapshot storage**: $0.021/GB/month (90% cheaper than RDS snapshots)
- **Backup storage**: Free (equal to sum of database cluster storage)

**Cost Reduction Tactics**:
- Enable automated snapshots (free for retention period)
- Delete manual snapshots older than compliance requirements
- Use I/O-Optimized for write-heavy workloads (breakeven at 25% I/O cost)
- Right-size instances (use CloudWatch metrics: CPUUtilization, DatabaseConnections, ReadIOPS, WriteIOPS)

### Right-Sizing Instances

**Metrics to monitor** (CloudWatch):
- **CPUUtilization**: Sustained >80% = upsize, <20% = downsize
- **DatabaseConnections**: High connection count = increase instance size or use connection pooling (RDS Proxy)
- **FreeableMemory**: <10% free memory = upsize to memory-optimized instance
- **ReadIOPS / WriteIOPS**: Consistent max IOPS = upgrade to Provisioned IOPS or larger gp3 volume

**Example Downsize Scenario**:
- db.r6g.xlarge (4 vCPUs, 32 GB, $0.504/hour) with 15% CPU, 40% connections
- Downsize to db.r6g.large (2 vCPUs, 16 GB, $0.252/hour)
- **Savings**: 50% reduction = $181/month

**Performance Testing**: Always test in staging before resizing production instances.

## Security Best Practices

### Encryption

**Encryption at rest**:
- Enable during creation (cannot be enabled later without migration)
- Uses AWS KMS (customer-managed or AWS-managed keys)
- Encrypts database storage, snapshots, backups, and read replicas
- No performance impact

**Encryption in transit**:
- SSL/TLS connections enforced via parameter group (`rds.force_ssl=1`)
- Use SSL certificates provided by RDS (download from AWS)

**Snapshots**:
- Encrypted snapshots from encrypted databases (automatic)
- Cannot restore encrypted snapshot to unencrypted instance
- Share encrypted snapshots by sharing KMS key access

### Network Isolation

**VPC Best Practices**:
- Deploy RDS instances in private subnets (no Internet Gateway route)
- Use security groups to restrict access (allow 3306/MySQL, 5432/PostgreSQL only from application subnets)
- Never expose RDS instances to public internet (`PubliclyAccessible: false`)

**VPC Peering and PrivateLink**:
- Use VPC Peering for cross-VPC access within same Region
- Use AWS PrivateLink for cross-Region or cross-account access

### IAM Database Authentication

Replace database passwords with IAM credentials for short-lived tokens (15 minutes).

**How it works**:
1. Application requests authentication token from IAM
2. Token is signed with AWS credentials
3. Database validates token against IAM permissions
4. Connection established without storing passwords

**Benefits**:
- No password management or rotation
- Centralized access control via IAM policies
- Audit trail in CloudTrail

**Supported Engines**: MySQL, PostgreSQL, Aurora MySQL, Aurora PostgreSQL

**Limitations**: 256 connections/second per database (use connection pooling for high-concurrency apps)

### RDS Proxy

RDS Proxy manages database connections, improving application scalability and security.

**What RDS Proxy solves**:
- **Connection overhead**: Opening new database connections is expensive (100-200ms); Proxy maintains connection pools
- **IAM authentication**: Proxy handles IAM authentication, reducing token requests
- **Failover resilience**: Proxy maintains connections during failover, reducing errors

**Cost**: $0.015/hour per vCPU of target RDS instance (~$11/month for db.r6g.large)

**Use cases**:
- Serverless applications (Lambda) with frequent connections
- Applications with connection spikes
- Multi-tenant SaaS with variable load

**Performance**: Reduces connection overhead by 50-80% for Lambda-based applications.

## Performance Optimization

### Query Performance Insights

Performance Insights is a built-in database performance monitoring tool that identifies slow queries and resource bottlenecks.

**How to use it**:
1. Enable Performance Insights (free for 7 days retention, $0.18/vCPU/month for longer)
2. View top SQL queries consuming CPU, I/O, locks, or memory
3. Identify inefficient queries and optimize (add indexes, rewrite queries)
4. Monitor wait events (I/O waits, lock waits, CPU waits)

**Common Optimization Patterns**:
- **High I/O waits**: Add indexes to reduce full table scans
- **High CPU**: Optimize query logic, reduce data processing in database
- **Lock waits**: Reduce transaction duration, optimize locking strategy

### Enhanced Monitoring

Enhanced Monitoring provides OS-level metrics (CPU, memory, disk I/O, network) at 1-second granularity.

**Key Metrics**:
- **CPU utilization**: Identify CPU bottlenecks
- **Memory usage**: Track buffer pool efficiency
- **Disk I/O**: Monitor read/write throughput and latency
- **Network throughput**: Identify network bottlenecks

**Cost**: $0.30/instance/month for 1-second granularity

### Parameter Groups

Parameter groups control database engine configuration (e.g., buffer pool size, query cache, timeouts).

**Key Parameters**:
- **max_connections**: Maximum concurrent connections (default varies by instance size)
- **innodb_buffer_pool_size** (MySQL): 70-80% of instance memory for InnoDB cache
- **shared_buffers** (PostgreSQL): 25% of instance memory
- **log_min_duration_statement** (PostgreSQL): Log slow queries (e.g., >1000ms)

**Best Practice**: Create custom parameter groups (don't modify default); test changes in staging before production.

## Backup and Recovery

### Automated Backups

RDS automatically creates daily snapshots and transaction logs for point-in-time recovery.

**Retention**:
- Default: 7 days
- Maximum: 35 days
- Free storage equal to database size

**Point-in-Time Recovery (PITR)**:
- Restore to any point within retention period (accurate to 5 minutes)
- Creates new RDS instance (does not overwrite existing)
- **Recovery Time**: 10-30 minutes depending on database size

### Manual Snapshots

Manual snapshots are user-initiated backups stored indefinitely until deleted.

**Use cases**:
- Pre-upgrade snapshots
- Compliance retention (>35 days)
- Disaster recovery snapshots

**Cost**: $0.095/GB/month (RDS), $0.021/GB/month (Aurora)

**Restore Time**: 10-30 minutes for RDS, 5-15 minutes for Aurora

### Cross-Region Snapshots

Automate snapshot replication to secondary Region for disaster recovery.

**Cost**: Cross-Region data transfer ($0.02/GB) + snapshot storage in secondary Region

**Use case**: Disaster recovery with RPO = backup frequency (daily, hourly)

## Common Pitfalls

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **1. Enabling public accessibility** | Security risk: database exposed to internet | Deploy in private subnets, set `PubliclyAccessible: false` |
| **2. Not enabling encryption at creation** | Cannot encrypt later without migration | Always enable encryption for production databases |
| **3. Using default parameter groups** | Cannot modify; changes affect all databases | Create custom parameter groups |
| **4. Ignoring CloudWatch alarms** | Performance degradation, outages unnoticed | Set alarms: CPUUtilization >80%, FreeableMemory <10%, DatabaseConnections near max |
| **5. Oversizing instances** | 50%+ wasted cost | Right-size using CloudWatch metrics (target 50-70% CPU utilization) |
| **6. Not using gp3 storage** | 20% higher cost vs gp3 | Migrate gp2 to gp3 for immediate savings |
| **7. Skipping Multi-AZ for production** | Downtime during failures = $10K-$100K+/hour | Enable Multi-AZ for 99.95%+ availability |
| **8. Not monitoring replication lag** | Stale reads, data inconsistency | Monitor `ReplicaLag` metric; alert if >5 seconds |
| **9. Using Standard Aurora for write-heavy workloads** | Unpredictable I/O costs (30-50% of total spend) | Switch to I/O-Optimized when I/O costs >25% |
| **10. Not testing Blue/Green deployments** | Failed upgrades, extended downtime | Test major upgrades in green environment before switchover |
| **11. Ignoring Performance Insights** | Slow queries waste resources | Enable Performance Insights, optimize top queries |
| **12. Not using RDS Proxy for Lambda** | Connection overhead (100-200ms), connection exhaustion | Use RDS Proxy for serverless applications |
| **13. Manual snapshot sprawl** | Unnecessary storage costs ($0.095/GB/month) | Delete snapshots >35 days (unless compliance required) |
| **14. Not using Reserved Instances** | Paying 37-69% more than necessary | Purchase RIs for stable baseline capacity (1-year or 3-year) |
| **15. Mixing Standard and I/O-Optimized clusters** | Confusion, suboptimal costs | Standardize on I/O-Optimized for write-heavy, Standard for read-heavy |

**Cost Impact Examples**:
- **Pitfall #5** (oversizing): db.r6g.2xlarge ($1,008/month) → db.r6g.xlarge ($504/month) = **$504/month savings**
- **Pitfall #6** (gp2 vs gp3): 1 TB gp2 ($115/month) → 1 TB gp3 ($115/month but better IOPS) = **20% performance improvement, same cost**
- **Pitfall #9** (Standard Aurora with high I/O): $213/month instance + $200/month I/O = $413/month → I/O-Optimized $255/month = **$158/month savings**
- **Pitfall #14** (on-demand vs Reserved): db.r6g.xlarge on-demand ($504/month) → 3-year RI ($156/month) = **$348/month savings (69%)**

## Key Takeaways

**Use RDS when**:
- You need specific database engines (Oracle, SQL Server, Db2, MariaDB)
- You have predictable workloads with lower performance requirements
- You want lower baseline costs compared to Aurora

**Use Aurora when**:
- You need superior performance (5x MySQL, 3x PostgreSQL)
- You require up to 15 read replicas or <100ms replication lag
- You want auto-scaling storage (10 GB to 128 TB)
- You need global database replication (<1 second cross-Region lag)

**High Availability**:
- Multi-AZ deployments provide 99.95%+ availability with 60-120 second failover
- Multi-AZ DB Clusters provide <35 second failover + readable standbys
- Aurora read replicas fail over in <30 seconds

**Aurora Serverless v2**:
- Auto-scales from 0.5 to 256 ACUs based on demand
- 66% cost reduction for workloads idle 50%+ of the time
- Minimum 8 ACUs required for Global Database secondary regions

**Cost Optimization**:
- Use gp3 storage for 20% savings vs gp2
- Purchase Reserved Instances for 37-69% savings on stable workloads
- Switch to Aurora I/O-Optimized when I/O costs exceed 25% of total spend
- Right-size instances using CloudWatch metrics (target 50-70% CPU)

**Security**:
- Enable encryption at rest during creation (cannot enable later)
- Deploy in private subnets with restrictive security groups
- Use IAM database authentication for short-lived credentials
- Enable SSL/TLS for encryption in transit

**Performance**:
- Enable Performance Insights to identify slow queries
- Use RDS Proxy for serverless applications to reduce connection overhead
- Monitor replication lag (<1 second acceptable, >5 seconds problematic)
- Optimize parameter groups for workload characteristics

**Blue/Green Deployments**:
- Test major version upgrades safely with <1 minute switchover
- Reduces upgrade downtime from hours to <1 minute
- Keeps blue environment as rollback option
