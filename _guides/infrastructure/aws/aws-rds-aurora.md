---
title: "Amazon RDS and Aurora for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "How AWS runs relational databases: what RDS manages and what you still own, how Aurora's shared storage changes availability and scaling, choosing between them, Multi-AZ options, read scaling, Aurora serverless, backups, blue/green changes, security, connections, and cost."
tags: [rds, aurora, aurora-serverless, multi-az, read-replicas, relational-databases, fundamentals]
---

## What RDS Manages

**Amazon RDS** (Relational Database Service) runs a database engine for you on instances AWS operates. It supports six engines: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, and Db2. RDS provisions the instance and storage, installs and patches the engine, takes backups, replaces failed hosts, and handles failover. What stays yours is everything inside the database: schema, indexes, queries, users, engine parameters, the instance size, and when to upgrade to a new major version.

A few pieces make up an RDS database:

- A **DB instance** is the compute, sized by an instance class such as `db.r8g.large`. Classes come in burstable (`db.t`), general purpose (`db.m`), and memory optimized (`db.r`, `db.x`) families, mostly on Graviton processors, which usually give the best price-performance. Most production databases are memory-bound, so `db.r` is the common choice.
- **Storage** is EBS volumes attached to the instance (see Storage below).
- A **DB subnet group** names the subnets, in at least two Availability Zones, that RDS may place instances in. The database lives inside your VPC, and a **security group** decides who can reach its port.
- An **endpoint** is the DNS name clients connect to. It points at whichever instance is the current primary, which is how failover works without configuration changes in the application.
- **Parameter groups** hold engine settings, and **option groups** hold engine features such as Oracle's or SQL Server's add-ons. Clusters of several instances, which Aurora and one of the Multi-AZ options below both use, also have a **cluster parameter group** whose settings apply to every instance in the cluster. The default groups can't be edited, so create your own before you need to change a setting.
- A weekly **maintenance window**, 30 minutes by default, is when RDS applies patches and pending changes, and a daily **backup window** is when it takes automated backups. Minor engine versions can be upgraded automatically in the maintenance window if you allow it. Major version upgrades are yours to schedule, until a version runs out of support entirely.

Databases are Regional resources, and quotas are per account per Region: 40 DB instances by default, shared with Aurora, Neptune, and DocumentDB instances.

### Engine Versions and Extended Support

RDS supports each major engine version for a set period. When a version reaches the end of standard support, a database still running it is enrolled in **RDS Extended Support**, which keeps security patches coming for up to three more years for an extra hourly charge, unless you opted out when creating it. After that, RDS upgrades it automatically. Extended Support is easy to miss on a bill, because nothing about the database changes on the day the charges start. Plan major version upgrades before the end of standard support, and use blue/green deployments (below) to do them with little downtime.

### Storage

RDS stores data on EBS volumes, AWS's network-attached block storage. Their performance is measured in IOPS, the number of reads and writes per second, and throughput in MiB/s. The options follow EBS with a few RDS-specific twists:

| Type | Size | Performance | Price (Single-AZ, us-east-1) |
|---|---|---|---|
| **gp3** (default) | 20 GiB–64 TiB | 3,000 IOPS and 125 MiB/s included below 400 GiB; 12,000 IOPS and 500 MiB/s at 400 GiB and above; up to 64,000 IOPS and 4,000 MiB/s | $0.115 per GB-month, plus $0.02 per extra IOPS and $0.08 per extra MiB/s |
| **io2 Block Express** | 100 GiB–64 TiB (20 GiB minimum for SQL Server) | Up to 256,000 IOPS, sub-millisecond latency | $0.125 per GB-month plus $0.10 per provisioned IOPS |

The jump at 400 GiB (200 GiB for Oracle) happens because RDS stripes larger volumes across four EBS volumes. SQL Server doesn't stripe, so its gp3 baseline stays at 3,000 IOPS at any size, with up to 80,000 IOPS and 2,000 MiB/s provisionable. Oracle and SQL Server can add up to three extra volumes for a total of 256 TiB. The previous-generation gp2 and io1 types still exist for older databases, and magnetic storage is retired.

Storage can grow but not shrink, except that Oracle and SQL Server can remove an additional volume. **Storage autoscaling** raises the allocation automatically when free space runs low, up to a maximum you set, which guards against a database stopping because its disk filled up. The instance class also caps performance. A volume provisioned with more IOPS than the instance can drive only costs more.

**RDS Custom**, for Oracle and SQL Server, gives you operating-system access to the underlying host for software that needs it, at the cost of taking back some of the management RDS normally does.

---

## How Aurora Differs

**Amazon Aurora** is a MySQL- and PostgreSQL-compatible engine that AWS rebuilt around a distributed storage layer. Applications use the same drivers and SQL, but the database underneath works differently in three ways.

**Storage is shared and separate from compute.** An Aurora **DB cluster** keeps its data in one **cluster volume** that stores six copies across three Availability Zones, whether the cluster has one instance or sixteen. A write is acknowledged once four of the six copies have it, so the cluster keeps working through the loss of a zone. The volume grows automatically up to 256 TiB for current engine versions, and it shrinks when you drop tables or data, which RDS storage never does. You pay only for what's stored.

**Readers don't copy the data.** A cluster has one writer instance and up to 15 **Aurora Replicas** (reader instances), all attached to the same volume. Adding a reader doesn't copy the database, so it's ready in minutes, and replicas typically lag the writer by less than 100 milliseconds because they only need to catch up their memory caches, not replay changes onto their own storage.

**Failover promotes a reader.** When the writer fails, Aurora promotes a replica, usually in under 60 seconds and often under 30. A cluster with no replicas recreates the writer instead, which typically takes under 10 minutes, so production clusters keep at least one replica in another zone. Each replica has a **promotion tier** from 0 to 15 that decides the order.

Clients connect through **endpoints** rather than instance addresses. The **cluster endpoint** always points at the current writer. The **reader endpoint** spreads connections across the replicas. **Custom endpoints** group chosen instances, for example to send reporting queries to two large replicas and keep them away from the rest.

A few other capabilities come from the shared storage:

- **Clones** create a new cluster that shares the source's storage and copies pages only as either side changes them, so a full-size copy of production for testing is ready in minutes and costs little until it diverges.
- **Aurora Global Database** replicates a cluster to up to 10 other Regions through the storage layer, with lag typically under a second, for disaster recovery and local reads.
- **Aurora PostgreSQL Limitless Database** shards tables, splitting their rows across many instances by a key, behind one endpoint, for write volumes beyond a single writer.
- **Babelfish for Aurora PostgreSQL** accepts SQL Server's T-SQL dialect and wire protocol, which can let some SQL Server applications move to Aurora with few code changes.

Aurora's documentation claims up to six times the throughput of standard MySQL and of standard PostgreSQL on similar hardware. Treat that as AWS's benchmark result, not a promise for any particular workload. **Aurora DSQL** shares the name but is a different, serverless distributed database with PostgreSQL compatibility and active-active writes across Regions, suited to a different set of trade-offs.

### Aurora Standard and I/O-Optimized

Aurora bills storage in one of two configurations, chosen per cluster:

| Configuration | Storage | I/O | Instance or ACU price |
|---|---|---|---|
| **Aurora Standard** | $0.10 per GB-month | $0.20 per million read and write I/Os | Base price |
| **Aurora I/O-Optimized** | $0.225 per GB-month | None | About 30% higher |

AWS's rule of thumb is to choose I/O-Optimized when I/O makes up 25% or more of the cluster's Aurora bill. Standard is cheaper for clusters that mostly read from memory. A write-heavy cluster on Standard can find its I/O line larger than its instances. You can switch from Standard to I/O-Optimized once every 30 days, and back at any time.

---

## High Availability

A production database needs a copy in a second Availability Zone that can take over automatically. RDS and Aurora offer three designs, which differ in where the copy is made and whether it can serve reads.

{% include figure.html id="aws-rds-ha-topologies" %}

| | Multi-AZ DB instance | Multi-AZ DB cluster | Aurora cluster |
|---|---|---|---|
| **Copies** | Primary plus one standby | Writer plus two readers in three zones | Writer plus up to 15 readers sharing one volume |
| **Replication** | Synchronous, at the storage level (SQL Server instead uses Database Mirroring, Always On availability groups, or block-level replication, depending on version) | Semisynchronous engine replication: each commit waits for one reader | Shared storage, six copies |
| **Standby serves reads** | No | Yes | Yes |
| **Typical failover** | 60–120 s | Under 35 s | Under 60 s, often under 30 |
| **Engines** | All six | MySQL and PostgreSQL, on instance classes with local NVMe storage | Aurora MySQL and PostgreSQL |

The **Multi-AZ DB instance** deployment is the classic design. The standby receives every write before the primary acknowledges it, so no committed data is lost in a failover, but it can't serve queries, and synchronous replication can add some write latency. It roughly doubles the instance and storage cost (Multi-AZ gp3 is $0.23 per GB-month). The **Multi-AZ DB cluster** trades the standby for two readable instances and faster failover, with lower write latency than the instance deployment. It runs three instances, with storage billed at about three times the Single-AZ rate. A commit needs only one reader's acknowledgement, so the other can lag, and failover waits for the promoted reader to apply what it's missing.

In all three, failover moves the endpoint's DNS record to the new primary, and existing connections drop. Applications need retry logic and a short DNS cache. AWS recommends a DNS time-to-live of no more than 60 seconds in the JVM, whose default can cache forever. **RDS Proxy** (see Connections below) hides much of this by holding client connections open and redirecting them itself, and AWS reports it cuts Aurora failover time by up to 66%.

Failover also happens during maintenance, such as operating-system patching and some instance modifications, which is one more reason even a modest production database runs Multi-AZ.

---

## Read Scaling

**RDS read replicas** are copies of a DB instance kept up to date through the engine's own asynchronous replication. A primary can have up to 15 (AWS suggests no more than 5 for Oracle), in the same Region or in others. Applications must send read queries to a replica's own endpoint, and because replication is asynchronous, a replica can serve data that's seconds or more out of date. The `ReplicaLag` metric shows how far behind it is. A replica can be promoted to a standalone database, which is a common disaster-recovery and migration step, but promotion breaks replication for good. RDS doesn't add or remove replicas automatically.

Aurora readers are added the same way but share the cluster's storage, and **Aurora Auto Scaling** can add and remove them based on CPU or connections. Applications reach them through the reader endpoint.

A replica only helps if the application can tolerate reading slightly old data. A user who saves a change and immediately reloads the page from a replica may not see it, so read-your-own-writes paths go to the writer.

---

## Aurora Serverless

**Aurora Serverless v2**, which AWS's documentation now simply calls Aurora serverless, replaces fixed instance classes with capacity that scales continuously. Capacity is measured in **Aurora Capacity Units (ACUs)**, each about 2 GiB of memory with matching CPU and networking, and you set a minimum and maximum between 0 and 256 ACUs for the cluster. Each serverless writer or reader scales within that range, in steps as small as 0.5 ACU, without dropping connections or waiting for a quiet moment. Billing is per second at $0.12 per ACU-hour for Aurora Standard in US East (N. Virginia), or $0.156 on I/O-Optimized.

Since late 2024, recent engine versions accept a minimum of **0 ACUs**. An instance with no connections for a set period, 5 minutes to a day, **pauses** and costs nothing for compute, then resumes when a connection arrives. Resuming typically takes about 15 seconds, or 30 seconds or more after a day paused, so client connection timeouts need to be longer than that. That suits development environments and rarely used internal tools, not user-facing paths. Anything that holds a connection open prevents pausing, including an RDS Proxy attached to the cluster, and the writer of a Global Database primary never pauses.

A cluster can mix provisioned and serverless instances, for example a large provisioned writer with serverless readers. Readers in promotion tiers 0 and 1 scale with the writer so they're ready to take over, while readers in lower tiers scale on their own load.

Aurora serverless isn't automatically cheaper. An ACU-hour costs more than the equivalent memory in a provisioned instance, so a database that runs near a steady load all day is cheaper provisioned. It pays off for spiky or intermittent load, and for avoiding the capacity planning a new application can't do yet. Set the minimum high enough to keep the working set, the data queries touch regularly, in the database's memory cache. A database that scales down to a few ACUs evicts that cache and is slow for a while after load returns.

---

## Choosing RDS or Aurora

| Question | Points to RDS | Points to Aurora |
|---|---|---|
| **Engine** | Oracle, SQL Server, Db2, or MariaDB | MySQL or PostgreSQL (or SQL Server code through Babelfish) |
| **Read scaling** | A few replicas that can lag | Up to 15 readers with little lag, added in minutes |
| **Failover** | A standby or a Multi-AZ DB cluster is fast enough | Readers as failover targets |
| **Storage** | Predictable size, and shrinking isn't needed | Grows and shrinks automatically, up to 256 TiB |
| **Load shape** | Steady | Variable or idle for long periods (Aurora serverless) |
| **Features** | Engine features Aurora doesn't support | Clones, Global Database, fast readers |
| **Cost** | Small or steady databases, where RDS instances and gp3 storage cost less | I/O-heavy or read-scaled workloads, where shared storage avoids paying for a copy per replica |

For MySQL or PostgreSQL there's no single right answer. A small application database with one standby is usually cheaper on RDS. A database that needs several readers is often cheaper on Aurora, because each RDS replica carries a full copy of the storage and Aurora's readers share one.

---

## Backups and Restores

**Automated backups** let you restore to any second within the retention period, up to 35 days. RDS takes a daily snapshot of the storage volume during the backup window and keeps transaction logs in between. Aurora backs up its cluster volume continuously and incrementally, with no backup window. The latest restorable time is typically within five minutes of the present. A restore always creates a **new** database with a new endpoint. It never overwrites the existing one, so the application has to be pointed at it. Backup storage up to the size of the database is free, and beyond that costs $0.095 per GB-month for RDS and $0.021 for Aurora.

**Manual snapshots** last until you delete them, survive deletion of the database, and can be copied to another Region or shared with another account. Automated backups are deleted with the database unless you choose to retain them. When deleting a production database, take a final snapshot.

Aurora adds two faster ways back:

- **Backtrack** (Aurora MySQL only, in some Regions) rewinds a cluster in place to a point up to 72 hours back, in minutes, which undoes a bad `DELETE` without a restore. It has to be turned on when the cluster is created or restored, it closes all connections while it runs, and it bills hourly for the change records it keeps.
- **Clones** give a point-in-time copy for investigation without touching production.

AWS Backup can manage RDS and Aurora backups alongside other services, with cross-account copies and longer retention.

---

## Changing a Database with Blue/Green Deployments

A **blue/green deployment** copies the production database (blue) into a staging copy (green) that RDS keeps in sync through replication. You make the change on green, such as a major version upgrade, a parameter change, or a different instance class, and test it. Then a **switchover** promotes green. RDS briefly blocks writes, waits for green to catch up, and swaps the names and endpoints so the application connects to green without configuration changes. The switchover typically takes under a minute, and built-in guardrails cancel it if replication isn't healthy.

Blue/green works for RDS for MySQL, MariaDB, and PostgreSQL, and for Aurora MySQL and Aurora PostgreSQL. Keep green read-only while testing. Writes made there can conflict with replication or end up in production after switchover.

After switchover, the old blue environment is renamed and kept, but replication to it stops. It's a copy of production as of the switchover, useful for comparison, not a live fallback that keeps receiving new writes. Rolling back after new writes have landed on green means another migration, so test on green thoroughly before switching.

---

## Security

**Network.** Put databases in private subnets and keep them from being publicly accessible. Allow the database port (3306 for MySQL, 5432 for PostgreSQL, 1433 for SQL Server) only from the security groups of the applications that use it.

**Encryption at rest** is chosen when a database is created and can't be turned on or off afterward. It covers storage, logs, backups, snapshots, and replicas, using a KMS key in the database's Region. To encrypt an existing database, snapshot it, copy the snapshot with encryption on, and restore from the copy, which means a new database and a cutover. The key can't be changed either, except through the same copy. Disabling or losing access to the key stops the database. RDS moves it to an inaccessible state and, if the key isn't restored within seven days, it can only be recovered from a backup. Snapshots encrypted with the default AWS managed key can't be shared with other accounts, so databases that need cross-account copies use a customer managed key.

**Encryption in transit** uses TLS with certificates from RDS's certificate authority. To require it, set `rds.force_ssl` for PostgreSQL (on by default from version 15) or `require_secure_transport` for MySQL and MariaDB.

**Credentials.** RDS can create the master password in AWS Secrets Manager and rotate it for you, so it never appears in templates. For MySQL, MariaDB, and PostgreSQL, **IAM database authentication** lets applications connect with a token generated from their IAM role instead of a password. Each token lasts 15 minutes, and only the connection is checked, not the session afterward. It needs between 300 and 1,000 MiB of spare memory on the instance, and connection attempts with it aren't logged in CloudTrail. Applications that open connections at a high rate usually pair it with RDS Proxy.

---

## Connections and RDS Proxy

Every database connection holds memory on the server, so each instance class has a maximum. On RDS for MySQL the default is roughly one connection per 12 MB of instance memory, so an instance with 8 GiB allows about 630. Applications that keep a pool of connections per server usually stay well under that. Serverless and heavily scaled-out applications don't. A burst of Lambda invocations can each open a connection at once and exhaust the database.

**RDS Proxy** sits between the application and the database, keeps a pool of database connections, and shares them among many client connections, lending a database connection to a client only for the length of a transaction. It queues or rejects clients beyond the limits you set instead of letting them overwhelm the database. It also keeps client connections open across a failover. Some session features, such as temporary tables or session variables set outside the proxy's configuration, **pin** a client to one database connection for the rest of the session, which removes the sharing, so watch the proxy's pinning metrics.

RDS Proxy works with Aurora and with RDS for MySQL, PostgreSQL, MariaDB, and SQL Server, but not Oracle or Db2, and on RDS it attaches to the primary, not to read replicas. The proxy runs in the database's VPC, can't be publicly reachable, and connects to the database with credentials from Secrets Manager or IAM authentication. It costs $0.015 per vCPU-hour of the database instance in US East (N. Virginia), or per ACU-hour for Aurora serverless.

---

## Monitoring

A handful of CloudWatch metrics catch most problems: `CPUUtilization`, `FreeableMemory`, `DatabaseConnections`, `FreeStorageSpace` for RDS, read and write latency and IOPS, `ReplicaLag` or `AuroraReplicaLag`, and for Aurora Standard, the I/O counts that drive the bill. **CloudWatch Database Insights**, which now includes what was Performance Insights, shows database load broken down by wait event, SQL statement, host, and user, which is usually the fastest way from "the database is slow" to the query responsible. **Enhanced Monitoring** adds operating-system metrics such as per-process memory, at intervals down to one second.

---

## Where the Money Goes

- **Instances** are usually the largest line. A Multi-AZ DB instance roughly doubles it, a Multi-AZ DB cluster triples it, and each read replica is another full instance. Development databases can be stopped for up to seven days at a time, after which RDS starts them again.
- **Storage** is billed as allocated for RDS, and multiplied by the number of copies for Multi-AZ. Aurora bills what's stored once, plus I/O on the Standard configuration.
- **Backups** beyond the free allowance, and manual snapshots that nobody deletes.
- **Extended Support** charges for engine versions past their standard support date.
- **Data transfer** between zones for cross-AZ application traffic, and between Regions for cross-Region replicas and Global Database.

Reserved instances and Savings Plans can cut the instance line for databases that run all the time.

---

## Key Takeaways

1. **RDS runs the engine; you still own the database.** Schema, queries, parameters, sizing, and major version upgrades stay your job, and a version left past standard support starts paying Extended Support.
2. **Aurora's shared storage is what makes it different.** Six copies across three zones, readers without their own copy, fast failover, clones, and storage that grows and shrinks.
3. **Choose by engine, read scaling, and load shape.** Oracle, SQL Server, Db2, and MariaDB mean RDS. For MySQL and PostgreSQL, Aurora pays off with several readers, variable load, or heavy I/O.
4. **Run production Multi-AZ.** A Multi-AZ DB instance gives a synchronous standby; a Multi-AZ DB cluster or Aurora gives readable standbys and faster failover. All of them move DNS, so applications must reconnect.
5. **Replicas are asynchronous.** Send only reads that tolerate lag to them, and keep read-your-own-writes on the writer.
6. **Aurora serverless is for variable load.** It scales from 0 to 256 ACUs without dropping connections, but steady workloads cost less provisioned.
7. **Restores create new databases.** Point-in-time recovery, snapshots, and clones all produce a new endpoint, so plan the cutover, not just the backup.
8. **Blue/green makes upgrades short, not reversible.** Switchover takes about a minute, but the old environment stops receiving writes.
9. **Decide encryption and connections early.** Encryption can't be added in place, and connection-hungry applications need RDS Proxy.
