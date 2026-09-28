---
title: "AWS Migration Services: Transform MGN, DMS, and DataSync"
layout: guide
category: AWS
subcategory: Migration & Hybrid Cloud
description: "How servers, databases, and files are copied to AWS and cut over with little downtime: AWS Transform MGN's block replication, staging area, and test and cutover lifecycle; AWS DMS full load and change data capture, schema conversion, and DMS Serverless; AWS DataSync agents and task modes; and what each one costs."
tags: [aws-transform-mgn, aws-dms, aws-datasync, change-data-capture, rehost, cutover, practical]
---

## One Pattern, Three Services

A migration copies three kinds of thing: whole servers, the contents of databases, and files. AWS has a service for each, and all three follow the same pattern. They make a full copy while the source keeps running, keep the copy current with ongoing changes, and let the team switch over, or cut over, once the copy has caught up. Downtime shrinks to the minutes needed to stop the source, let the last changes land, and point users at the copy.

| Service | Copies | How it keeps up | What the target is |
|---|---|---|---|
| **AWS Transform MGN** | Whole servers, disk by disk | Continuous replication of changed disk blocks | An EC2 instance booting the same operating system and application |
| **AWS Database Migration Service** (DMS) | Rows in database tables | Change data capture (CDC) from the source database's transaction log | A database on the same or a different engine |
| **AWS DataSync** | Files and objects | Repeated incremental runs that copy only what changed | S3, EFS, or an FSx file system |

The three overlap. A database server can be rehosted, moved as is, with MGN, keeping its engine, version, and configuration. It can also be migrated with DMS into Amazon RDS or Aurora, which replatforms it onto a managed service or, across engines, changes the engine too. The first moves the server, and the second moves only the data.

---

## AWS Transform MGN: Rehosting Servers

AWS Transform MGN, called AWS Application Migration Service until June 8, 2026, when AWS renamed it to match AWS Transform, its agentic migration service, rehosts physical servers, virtual machines, and servers in other clouds onto EC2. The APIs, CLI commands, and IAM actions still use `mgn`. MGN is a Regional service. Servers replicate into one account and Region, and the replicated data stays in that account's VPC.

### How Replication Works

{% include figure.html id="aws-mgn-replication" %}

The **AWS Replication Agent** runs on each source server and reads its disks at the block level, below the file system. It sends the blocks, encrypted and compressed, over TCP 1500 to a **replication server**, a small EC2 instance that MGN launches in a **staging area subnet** you designate, usually a dedicated one. The replication server writes them to **staging EBS volumes**, one per source disk. The agent and the replication server also talk to the MGN service endpoint over TCP 443, and the staging subnet needs outbound access to the Regional EC2 endpoint and to several AWS-owned S3 buckets that hold the replication software and its Amazon Linux packages. In a private staging subnet that reaches S3 through a gateway endpoint, the endpoint policy has to allow those buckets, or replication and conversion servers fail to start. After an initial sync copies every block, the agent sends each change as it happens, so the staging volumes stay close behind the source.

Launching a test or cutover instance takes a snapshot of the staging volumes. A **conversion server** then adjusts the copies so they boot on EC2, installing the drivers and boot configuration the hypervisor on the source never needed, and MGN starts the instance in the launch subnet. The source server never stops during any of this.

The agent installer needs AWS credentials. MGN recommends temporary credentials from an IAM role carrying the `AWSApplicationMigrationAgentInstallationPolicy` managed policy, rather than an IAM user's access keys pasted into an install command.

### Agentless Replication for vCenter

When policy forbids installing an agent on every server, MGN can replicate VMware vCenter VMs without one. An **MGN vCenter Client** installed on a dedicated VM discovers VMs and replicates them by shipping snapshots, using VMware's changed block tracking to send only the changes since the last snapshot. MGN recommends the agent where possible, because agentless replication is periodic rather than continuous and so leaves a longer cutover window.

### Templates, Applications, and Waves

Three templates set the defaults for every server added: a **replication template** (staging subnet, replication server type, encryption, whether data travels over a private IP), a **launch template** (subnet, instance type, security groups, licensing), and a **post-launch template**. Each server can override them. With instance type right-sizing on, MGN launches the EC2 type that best matches the source's operating system, CPU, and memory, overriding the launch template. With it off, it launches the type the template sets. **Post-launch actions** run AWS Systems Manager documents on the launched instance, for example to convert the operating system or licenses, upgrade Windows on a clone of the instance, set up disaster recovery replication, or run your own scripts.

Servers can be grouped into **applications** and applications into **waves**, and launch, cutover, and archive actions apply to a whole group at once. Default quotas shape how large a wave can be: 150 actively replicating servers per Region, 20 concurrent jobs, and 200 servers in a single launch job. Larger migrations ask Support for more.

### The Test and Cutover Lifecycle

Each source server moves through a fixed sequence of states, and the sequence is where the safety of a rehost comes from.

1. **Not ready** while the initial sync copies every block.
2. **Ready for testing** once replication is healthy.
3. **Test in progress** after a test instance launches. Check the application on it, and launch fresh test instances as often as needed, since replication continues underneath.
4. **Ready for cutover** once testing is marked complete, which is also when MGN offers to terminate the test instances.
5. **Cutover in progress** after the cutover instance launches from the latest replicated state. The team stops the application on the source, waits for the last changes to replicate, and switches DNS or load balancer targets to the new instance.
6. **Cutover complete** after **finalize cutover**, which stops replication, discards the replicated data, and terminates the replication resources. The server can then be archived.

Until the cutover is finalized, the way back is short. The source server is untouched, replication is still running, and a cutover can be reverted to ready for cutover. Finalizing removes that path, and MGN has no way to replicate changes from EC2 back to the source. AWS Elastic Disaster Recovery, which shares MGN's replication technology, adds failback when that direction matters.

Test instances deserve an isolated subnet. A server that is a domain controller, or that talks to one, can join or disrupt the production directory if its test copy has a route back to it. AWS warns specifically against launching domain controllers into a test VPC with connectivity to production.

### What MGN Costs

Each source server gets 2,160 hours of MGN use free, which is 90 days of continuous replication, starting when the agent is installed. After that, MGN charges per hour for each server still replicating. The AWS resources MGN creates are billed from the first hour, free period or not: replication servers, staging EBS volumes, snapshots, conversion servers during launches, and the test and cutover instances themselves. A server replicating for months before its wave arrives pays for its staging volumes the whole time, so install agents for a wave shortly before the wave, not for the whole portfolio at once.

---

## AWS DMS: Migrating Databases

AWS DMS copies data between a source and a target database, which can run on the same engine or on different ones. It runs inside your VPC, typically reaches on-premises sources over a VPN or Direct Connect link, and stores source and target credentials in AWS Secrets Manager if you choose.

### Replication Instances and DMS Serverless

Both kinds of DMS copy data between a source and a target **endpoint**, which hold the connection details for each database. They differ in who sizes the compute.

| | Replication instance | DMS Serverless |
|---|---|---|
| **Unit of work** | **Tasks** on an instance, each copying a set of tables | A **replication**, which provisions its own compute |
| **Sizing** | You choose an instance class and storage | You set minimum and maximum DMS capacity units (DCUs, 2 GB of memory each), and DMS scales between them |
| **Billing** | Per instance-hour while the instance exists, whether or not a task runs | Per DCU-hour used |
| **Engines** | Every source and target DMS supports | A subset, including Oracle, SQL Server, MySQL, PostgreSQL, MongoDB, and Db2 as sources |
| **Limits to know** | Several busy tasks can overload one instance | No views, no custom CDC start points, and resources released if a stopped replication isn't resumed within 48 hours |

Data transferred into DMS is free, and Database Savings Plans cover DMS usage.

### Full Load, CDC, or Both

A task or replication runs in one of three modes. **Full load** copies the tables as they are at the start and stops, which suits data that can be frozen for the copy. **Full load and CDC** copies the tables and then applies every change captured from the source's transaction log while and after the load ran, which is the mode for a migration with a short cutover. **CDC only** applies changes from a chosen point, for example after a native backup and restore has done the bulk copy.

CDC needs the source to log changes in a form DMS can read, such as row-based binary logging on MySQL or supplemental logging on Oracle. Those are settings to change and test on the source well before migration day. AWS is explicit that CDC isn't real-time replication. Latency is normally low but has no service level agreement, and it can climb to minutes during batch jobs, index rebuilds, or other bursts of log volume.

For ongoing replication, AWS recommends Multi-AZ, which keeps a standby replication instance or serverless capacity in a second Availability Zone and bills at a higher hourly rate. The standby protects CDC. A failover during a full load still fails the load, and the task then restarts the tables it hadn't finished.

### What DMS Doesn't Copy

DMS creates tables and primary keys on the target if they don't exist, and nothing more. Secondary indexes, foreign keys, triggers, users, stored procedures, and most other schema objects have to come from somewhere else. The usual order is:

1. **Create the schema on the target first.** On the same engine, use the engine's own tools (a schema-only dump, MySQL Workbench, pgAdmin, Oracle SQL Developer). Across engines, use DMS Schema Conversion, described below.
2. **Hold back what slows or breaks the load.** Drop or delay secondary indexes, foreign keys, and triggers during the full load, because DMS loads eight tables at a time by default and doesn't load them in dependency order.
3. **Add secondary indexes before CDC starts.** Change data capture applies updates and deletes by key, and without indexes each one can scan the table. A task can pause between the full load and CDC for this step.
4. **Enable foreign keys and triggers at cutover,** after the last changes have been applied.

Large objects need a decision too. **Limited LOB mode**, the default, copies values up to a maximum size (32 KB unless changed) and truncates larger ones. **Full LOB mode** copies any size but slowly. **Inline LOB mode** sends small values inline and looks up large ones. Set the limit from the largest value actually in the data, and remember that DMS treats some types, such as JSON on PostgreSQL, as LOBs.

### Validation and Cutover

**Data validation**, turned on in the task settings, compares source and target rows after the full load and keeps comparing as changes apply, recording mismatches in a table on the target. It works for the common relational engines, including Oracle, SQL Server, MySQL, PostgreSQL, their Aurora forms, Db2 for Linux, Unix, and Windows, and Redshift. Data truncations and rows rejected for foreign key violations appear only in the task log, so send the log to CloudWatch and read it.

A database cutover then follows a short sequence. Stop writes to the source, wait until the task's CDC latency reaches zero and validation shows no pending records, enable constraints and triggers on the target, and point the application's connection string at the target. The source stays intact, so a failed cutover can switch back as long as nothing has written to the target yet.

### Schema Conversion Across Engines

**DMS Schema Conversion** converts schemas and code objects, such as tables, views, stored procedures, and functions, from one engine to another. It is managed and runs in the DMS console, built on the same conversion engine as the downloadable AWS Schema Conversion Tool (AWS SCT). A **migration project** ties together a source and a target **data provider** (connection details) and an **instance profile** (network and encryption settings). An **assessment report** shows what converts automatically and what needs manual work, which is the best early estimate of a cross-engine migration's effort.

Supported paths include Oracle, SQL Server, Db2, and SAP ASE to Aurora PostgreSQL or RDS for PostgreSQL, Oracle and SQL Server to MySQL targets, and Oracle to Redshift. On several PostgreSQL-target paths, generative AI converts objects the rules can't finish, for someone to review. An **extension pack** emulates source features the target lacks. Schema Conversion itself is free apart from the S3 storage it uses. AWS SCT remains available for paths or features the managed version doesn't cover.

Converting the schema is often the smaller part of a cross-engine move. Application SQL, stored procedure behavior, data type edge cases, and performance under the new engine all need testing, and the assessment report's manual-action list is where that work starts.

### Homogeneous Data Migrations

For MySQL, PostgreSQL, and MongoDB moving to the same engine on Amazon RDS, Aurora, or DocumentDB, DMS offers **homogeneous data migrations**. They run from a DMS migration project in a serverless environment DMS manages, dump and restore the data with the engine's own native tools, and support full load, ongoing replication, or both. Native tools carry over partitions, functions, stored procedures, and other secondary objects that DMS's row-by-row replication leaves behind, and the migration bills for the hours it runs. It has no built-in data validation, though, so the team checks row counts and checksums itself.

DMS Fleet Advisor, which inventoried database servers for planning, ended on May 20, 2026. For database assessment, AWS now recommends Migration Evaluator, its service for sizing and costing a move from discovery data.

---

## AWS DataSync: Moving Files and Objects

AWS DataSync copies files and objects between on-premises storage (NFS, SMB, HDFS, and S3-compatible object storage), other clouds' object and file storage, and AWS storage (S3, EFS, and the FSx file systems). It encrypts data in transit and, by default, verifies integrity at the end of each run.

### When an Agent Is Needed

A **DataSync agent** is a VM appliance deployed next to storage that AWS can't reach directly. It runs on VMware ESXi, Hyper-V, or KVM on premises, or as an EC2 instance from an AWS image. Transfers from on-premises file servers need one, as do transfers between EFS or FSx and another cloud. Transfers between AWS storage services, and between S3 and other clouds' object storage, don't. Agents come in Basic mode and Enhanced mode versions, matching the task mode they serve. For very large datasets, several tasks each with their own agent run in parallel. Up to four agents can serve one location, but they add throughput, not availability, since all of them must be online for the task to run.

### Task Modes

Each **task** copies from a source **location** to a destination location, and its mode is fixed at creation.

| | Enhanced mode | Basic mode |
|---|---|---|
| **Locations** | S3, EFS, and FSx for Lustre, with each other, with NFS, SMB, or HDFS through an Enhanced mode agent, or with Azure Blob and object storage (no agent needed to or from S3) | Every location DataSync supports, including FSx for Windows File Server, OpenZFS, and ONTAP |
| **Dataset size** | Virtually unlimited files or objects | Subject to per-task quotas on files and directories |
| **Performance** | Lists, prepares, transfers, and verifies in parallel | Runs those steps one after another |
| **Verification** | Verifies only what was transferred | Verifies all data by default |
| **Price** | $0.015 per GB copied plus $0.55 per task execution | $0.0125 per GB copied |

S3 request charges and destination storage are billed on top. Tasks can filter paths, run on a schedule, and cap their bandwidth so a transfer doesn't saturate the link it shares with production traffic.

### Cutting Over a File Share

A task set to copy only changed data turns a file migration into a series of shrinking runs. The first run copies everything, later runs copy what changed since the one before, and the final run, after the share is made read-only, copies the last changes. Clients then remount from the new file system. The final run's length, not the share's size, sets the downtime.

For datasets too large for the network, physical transfer is the alternative. Snowball Edge devices closed to new customers on November 7, 2025, and AWS now points new customers to **AWS Data Transfer Terminal**, a facility where a team brings its own storage devices and uploads over high-speed connections to the AWS network, or to partner solutions.

---

## Network and Security

All three services move data over whatever path you provide. A Direct Connect link or Site-to-Site VPN keeps replication traffic off the public internet and gives it predictable bandwidth. MGN can send replication data over private IP addresses, and it, DMS, and DataSync all support interface VPC endpoints for their control traffic. Size the link for the whole wave, not one server. Initial syncs for a wave's servers, databases, and file shares all compete for the same bandwidth, and production traffic still needs its share.

Encryption at rest follows the account's KMS keys. MGN encrypts staging volumes with the EBS default key or a customer managed key set in the replication template. DMS encrypts replication storage and connection information with a KMS key, and DataSync writes to encrypted destinations. Give each service's IAM role access only to the buckets, file systems, and keys it needs, and create a dedicated database user for DMS with read and replication privileges on the source and write privileges on the target.

---

## Common Pitfalls

- **Finalizing an MGN cutover too early.** Finalize discards the replicated data, so keep the server in cutover until the application has run on EC2 long enough to trust it.
- **A staging subnet that can't reach S3.** Replication and conversion servers download their software and packages from AWS-owned buckets. A locked-down subnet or a strict gateway endpoint policy stalls replication before it starts.
- **Installing agents for the whole portfolio on day one.** Staging volumes and replication servers bill from the start, and the 2,160 free hours run out for servers whose wave is months away.
- **Assuming validation everywhere.** DMS tasks validate rows when asked, but homogeneous data migrations don't validate at all. Plan row counts and checksums for those.
- **Cutting over during the source's busiest hours.** A nightly batch job can push CDC latency to minutes and stretch the final catch-up. Schedule cutovers for the source's quiet periods.

---

## Key Takeaways

- All three services copy while the source keeps running, keep the copy current, and cut over once it has caught up, so downtime is the final catch-up and switch.
- AWS Transform MGN replicates disk blocks to a staging subnet and converts them into EC2 instances at launch. Test as often as needed, and finalize only when there is no going back. Each server gets 2,160 free hours, but replication infrastructure bills from the start.
- AWS DMS copies rows with full load and CDC on replication instances or DMS Serverless. It creates only tables and primary keys, so build the schema first and add indexes before CDC. CDC latency is usually low but not guaranteed.
- DMS Schema Conversion converts schemas across engines and estimates the manual work, and homogeneous data migrations use native tools for same-engine moves.
- AWS DataSync copies files and objects, with an agent for on-premises storage. Incremental runs and a final run after writes stop keep file-share downtime short.
