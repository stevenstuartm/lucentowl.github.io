---
title: "Disaster Recovery on AWS: Backups, Recovery Regions, and Failover Control"
layout: guide
category: AWS
subcategory: Resilience
description: "How to build disaster recovery with AWS services: AWS Backup plans, vaults, cross-Region and cross-account copies, Vault Lock, and logically air-gapped vaults; the AWS services behind each recovery strategy; Elastic Disaster Recovery for servers; failing over on the data plane with Application Recovery Controller; and testing that recovery works."
tags: [disaster-recovery, aws-backup, elastic-disaster-recovery, application-recovery-controller, failover, advanced]
---

## Two Kinds of Disaster

Disaster recovery on AWS has to answer two different losses. The first is losing a place, such as an Availability Zone, a Region, or a service in that Region, which needs the workload to run somewhere else. The second is losing the data itself, through deletion, a bad deployment that corrupts records, or ransomware, which needs a copy from before the damage.

Replication answers the first and not the second. A replica in another Region receives a corrupting update or a malicious delete within seconds, just as it receives every other write. AWS's disaster recovery guidance therefore pairs every strategy with point-in-time backups, even the ones that keep a full copy of the workload running in a second Region. Recovery objectives, recovery time objective (RTO) and recovery point objective (RPO), and the four standard strategies from backup and restore to multi-site active/active are covered as concepts in [Disaster Recovery Patterns](/study-guides/infrastructure/disaster-recovery-patterns.html). This guide covers the AWS services that implement them.

AWS also draws a line on scope. A workload already spread across Availability Zones survives the loss of a data center without a disaster recovery plan, and for that level of disaster, backup and restore may be enough. A second Region, and the more expensive strategies, are for losing a Region or for regulations that require the distance.

---

## Backups with AWS Backup

**AWS Backup** schedules, stores, and copies backups for most AWS data services from one place, including EBS, EC2, S3, RDS and Aurora, DynamoDB, EFS, the FSx file systems, DocumentDB, Neptune, Redshift, and EKS. A **backup plan** sets the schedule, retention, and lifecycle, and resources join it by tag or by ID. Backups land in a **backup vault**, an encrypted container with its own access policy. The contents of each backup, a **recovery point**, can't be edited once written, but without further controls it can be deleted or have its retention shortened. Backup policies in AWS Organizations can push plans to every account in an organizational unit (OU).

Two kinds of backup work together. **Snapshot backups** run as often as hourly, can be kept for up to 100 years, and for supported resource types can move to a cheaper cold storage tier, where each must stay at least 90 days. **Continuous backups**, for S3, RDS, Aurora, and SAP HANA on EC2, record the transaction log so a resource can be restored to any second in the last 35 days, which matters when corruption is discovered hours after it happened. AWS recommends using both. Continuous backups have two limits to plan around. They can't move to cold storage, and a cross-Region or cross-account copy of one is a snapshot, restorable only to the moment it was copied.

### Keeping Backups Out of Reach

A backup in the same account and Region as the data it protects shares the fate of that account and Region. An attacker with administrator access, or an automation bug, can delete both. AWS Backup offers layers of separation:

- **Cross-Region copies** put a recovery point in the recovery Region, ready to restore when the primary Region is impaired.
- **Cross-account copies** put it in an account the workload's administrators can't reach, usually a dedicated backup account. Both accounts must be in the same organization, with cross-account backup turned on in the management account. The destination vault needs an access policy that allows copies in, and it can't be the default vault. Resource types that AWS Backup doesn't fully manage, such as EBS, EC2, and RDS, must be encrypted with a customer managed KMS key, since an AWS managed key can't be shared with another account. Most resource types copy across accounts and Regions in one copy job, and RDS, Aurora, DocumentDB, and Neptune snapshots gained that ability in October 2025.
- **Vault Lock** makes a vault write-once. In governance mode, users with specific IAM permissions can still remove the lock. In compliance mode, once a grace period of at least three days ends, no one, including AWS, can delete backups early or change the lock.
- **Logically air-gapped vaults** are locked in compliance mode from the start and encrypted with an AWS-owned key by default or a customer managed key. The vault lives in a dedicated backup account and is shared through AWS Resource Access Manager with a recovery account, which restores from it directly without first copying the backup into its own account. With multi-party approval, a group of approvers can grant access to the vault's backups even if the account that owns it is compromised or locked out. Since November 2025, backups can be written straight to one, not only copied there.

{% include figure.html id="aws-backup-isolation" %}

Not every resource type can use every layer. Standard RDS databases, as opposed to Aurora, can't go into a logically air-gapped vault, so they rely on a cross-account copy into a vault locked in compliance mode. Aurora continuous backups can't use one either, so Aurora uses snapshot backups for this layer. DynamoDB tables support cross-Region and cross-account copies only with AWS Backup's advanced features for DynamoDB turned on.

A backup nobody has restored is a hope, not a recovery plan. **Restore testing** restores chosen recovery points on a schedule, times how long each restore takes, and can trigger a Lambda function through EventBridge to check that the restored data is usable. **Backup Audit Manager** reports on whether resources are backed up according to the controls you set. AWS Backup charges for backup storage, restores, restore testing, cross-Region transfer, and Audit Manager.

---

## AWS Services Behind Each Strategy

| Strategy | AWS services that keep the recovery Region ready | What failover does on AWS |
|---|---|---|
| **Backup and restore** | AWS Backup cross-Region copies, AMIs copied to both Regions by an EC2 Image Builder pipeline, CloudFormation or CDK templates | Deploy the stacks, restore each data store from its recovery points, move traffic |
| **Pilot light** | Aurora global databases, DynamoDB global tables, S3 replication, RDS cross-Region read replicas, DocumentDB global clusters, ElastiCache Global Datastore, plus compute defined in templates but not deployed | Promote or switch each data store, deploy and scale out compute, move traffic |
| **Warm standby** | The same replication, plus a smaller Auto Scaling group or ECS or EKS service already running | Promote or switch each data store, scale out, move traffic |
| **Multi-site active/active** | Replication across Regions and a full deployment in each | Stop routing to the failed Region, and promote a new writer where writes went to one Region |

Three AWS-specific details shape these builds.

**Infrastructure as code decides whether backup and restore works at all.** A workload built by hand in the console can't be rebuilt quickly or correctly in a Region that has never run it. Keep CloudFormation or CDK templates, application artifacts, and golden AMIs, meaning images built by a pipeline and copied to both Regions, ready in the recovery Region alongside the backups. Because restoring is a control plane operation, the part of a service that creates and configures resources, AWS suggests restoring the latest backups into the recovery Region on a schedule, so usable data stores already exist if the restore APIs struggle during a Regional event.

**Scaling out is a control plane dependency.** Pilot light and warm standby both rely on Auto Scaling or a deployment to reach full capacity, at the moment other customers of an impaired Region may be doing the same. Provisioning enough standing capacity for the full load removes the dependency, a statically stable setup AWS calls **hot standby**. Many teams run enough for the first wave of traffic and let Auto Scaling add the rest. Raise the recovery Region's service quotas ahead of time either way, since most quotas are set per Region.

**Replicated data still needs backups.** The replica in the recovery Region carries the same corruption as the primary, so it needs point-in-time backups of its own. How each replication service fails over and what it can lose is part of multi-Region data design.

### Elastic Disaster Recovery for Servers

**AWS Elastic Disaster Recovery** (DRS) applies pilot light to whole servers, on premises, in another cloud, or on EC2 in another Availability Zone or Region. An agent on each source server replicates its disks continuously at the block level into a staging area subnet in the recovery account, using low-cost storage and small replication servers. When you launch recovery instances, DRS converts the replicated disks to boot on EC2, from the latest state or an earlier point-in-time snapshot, which is how it recovers from ransomware that encrypted the source. AWS describes the result as recovery point objectives of seconds and recovery time objectives of minutes.

**Drills** launch recovery instances without stopping replication or touching the source, so a recovery can be rehearsed without cost to the RPO. After an event, DRS can replicate the recovered servers back and **fail back** to the original site. DRS charges $0.028 per replicating source server per hour, plus the staging storage and replication servers, and the recovery instances only while they run. One target account can recover up to 3,000 servers by using several staging accounts of up to 300 servers each.

DRS protects servers, not managed services. A workload whose database runs on RDS or DynamoDB still needs that service's own replication or backups.

---

## Failing Over with Application Recovery Controller

A failover mechanism fails when it depends on the Region it's leaving, so AWS's guidance is to fail over with data plane operations, the ones that route and serve traffic, rather than control plane changes such as editing DNS records or Global Accelerator traffic dials. **Amazon Application Recovery Controller (ARC)** is AWS's set of tools for that.

### Region Switch

**Region switch**, generally available since August 2025, orchestrates a whole application's failover. A **plan** contains workflows made of steps, and each step runs one or more **execution blocks** in sequence or in parallel. Blocks handle tasks such as promoting an Aurora global database, scaling EC2, ECS, or EKS capacity, running a Lambda function, waiting for manual approval, or shifting Route 53 traffic, and a parent plan can run child plans to recover several applications in order.

Plans run manually or from CloudWatch alarms. They support failover and failback for active/passive setups, and shifting away from and back to a Region for active/active ones. Each Region has its own Region switch data plane, so a plan doesn't depend on the Region it's deactivating. Each execution produces a report with a timeline and the recovery time actually achieved. A plan costs $70 a month.

### Routing Controls and Zonal Shift

**Routing controls** are on/off switches, exposed to Route 53 as health checks you set yourself, that move traffic between Regions through a highly available data plane API. They run on a cluster that costs $2.50 an hour, with at most two clusters per account.

**Zonal shift** moves traffic away from an impaired Availability Zone within a Region, for supported load balancers and other resources, when you start it. **Zonal autoshift** lets AWS start that shift itself when it detects an impairment in the zone. Both are free.

ARC's readiness check, which audited whether recovery resources matched production, closed to new customers on April 30, 2026, and AWS points new users to Region switch instead.

---

## Proving Recovery Works

Recovery that hasn't been exercised tends to fail on details, such as a secret missing from the recovery Region, an AMI that was never copied, a quota left at its default, or a runbook step that no longer matches the console. Each layer has an AWS tool for exercising it. AWS Backup restore testing covers backups, and DRS drills cover replicated servers. ARC Region switch executions cover a whole application's failover, with the recovery time measured. **AWS Fault Injection Service** injects failures, for example pausing DynamoDB global table replication to test how the workload handles a lagging replica. **AWS Resilience Hub** assesses a workload against the RTO and RPO you set and flags where its architecture can't meet them.

The measure that matters is the recovery time and data loss observed in a test, compared with the objectives. Until a test has measured them, the objectives are targets rather than capabilities.

---

## Common Pitfalls

- **Treating replication as a backup.** A delete or a corrupting write replicates within seconds. Keep point-in-time backups in every Region that holds data.
- **Backups in the account they protect.** One compromised administrator can delete production and its backups together. Copy to a separate account, and lock the vault.
- **Cross-account copies that fail silently.** A resource encrypted with an AWS managed key, or a destination vault without a policy allowing copies in, stops the copy. Check copy jobs, not just backup jobs.
- **A recovery Region that can't be built.** Without infrastructure as code, copied AMIs, and raised quotas, restored data has nothing to run on.
- **Assuming PITR survives the copy.** Cross-Region and cross-account copies of continuous backups are snapshots, restorable only to the moment each was copied.
- **Never measuring recovery.** Until a test has timed the restore or failover, the RTO is a guess.

---

## Key Takeaways

- Disaster recovery has to handle losing a place and losing the data. Replication handles the first, and only point-in-time backups handle the second.
- AWS Backup centralizes backup plans, vaults, and copies. Continuous backups restore to any second within 35 days, but their cross-Region and cross-account copies are snapshots.
- Keep backups out of reach with cross-account copies into a dedicated backup account, Vault Lock in compliance mode, and logically air-gapped vaults shared to a recovery account. Check which layers each resource type supports.
- Each strategy maps to AWS services, from backup copies, golden AMIs, and templates (backup and restore) to live replicated data (pilot light), a smaller running copy (warm standby), and a full deployment in each Region (multi-site). Scaling out during failover is a control plane dependency that standing capacity removes.
- Elastic Disaster Recovery replicates whole servers with drills and failback, at $0.028 per source server per hour plus staging resources.
- Fail over with data plane controls. ARC Region switch orchestrates the steps from a data plane in each Region and reports the recovery time achieved, and restore tests, drills, and fault injection prove the plan before it's needed.
