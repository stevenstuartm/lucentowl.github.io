---
layout: guide
title: "Disaster Recovery Patterns"
category: Infrastructure & Cloud
subcategory: Cloud Operations
description: "How to plan for losing a whole site or region, or the data itself: business impact analysis, RTO and RPO, the four standard strategies from backup and restore to multi-site active/active, why replication is not a backup, failing over and back, and testing that recovery works."
tags: [practical, disaster-recovery, rto-rpo, backup, multi-region, business-continuity]
---

## Disaster Recovery Is Not High Availability

**High availability** keeps a workload running through the failures it expects: an instance dying, a disk failing, one data center in a cloud region going dark. It works by running redundant copies across availability zones, the separate data centers within a region, so a failure removes capacity without stopping service.

**Disaster recovery** (DR) is the plan for failures high availability can't absorb. The events it covers fall into two groups:

- **Losing a site.** A whole cloud region becomes unavailable, or a data center outage takes down a single-site deployment.
- **Losing the data.** Someone deletes a table, a bug corrupts records, ransomware encrypts storage, or an attacker with stolen credentials destroys an account's resources.

The second group is easy to underestimate, because it defeats high availability outright. A replica in another zone or region copies a deletion or a corruption as faithfully as it copies a valid write, usually within seconds. Replication protects against losing a site. Only point-in-time backups, kept where the same mistake or attacker cannot reach them, protect against losing the data.

For many workloads, AWS's disaster recovery guidance notes, a well-built multi-zone deployment in one region already covers most physical disasters, and backups cover the data. Recovery into a second region is for when the definition of a disaster includes losing a whole region, or when regulation requires it.

---

## Setting Recovery Objectives

### Business Impact Analysis

A **business impact analysis** works out what a disruption to each workload would cost: lost revenue, customers unable to act, contractual penalties, regulatory exposure, and damage to reputation. Impact can depend on timing. A payroll system that is down the day before payday costs far more than the same outage the day after.

The analysis sets how quickly each workload must come back and how much data it can lose. It is weighed against the probability of each kind of disaster and the cost of protecting against it. If a recovery strategy costs more than the loss it prevents, and no regulation requires it, the better decision may be to accept the risk. Some workloads rightly have no disaster recovery beyond backups. The DR plan also belongs inside the organization's wider business continuity plan, since recovering a system helps little if the business around it can't operate.

### RTO and RPO

Two objectives come out of the analysis. AWS defines them this way:

- **Recovery time objective (RTO):** the maximum acceptable delay between the interruption of service and its restoration.
- **Recovery point objective (RPO):** the maximum acceptable time since the last data recovery point, which sets how much recent data may be lost.

{% include figure.html id="infra-rto-rpo-timeline" %}

Both are maximums the business accepts, not measurements, and each strategy below is a way to meet them at a particular cost. Two things push the real numbers past the targets. A workload's recovery cannot finish before its dependencies recover, such as its identity provider, its DNS, or a shared database, so objectives have to be set with the dependency chain in view. And for a data disaster, the usable recovery point is the last one taken *before the corruption began*, which may be far older than the replication lag suggests if the corruption went unnoticed for days.

---

## The Four Strategies

AWS's disaster recovery whitepaper groups strategies into four, from cheapest and slowest to most expensive and fastest. The first three are *active/passive*: one region serves traffic and the recovery region waits. The fourth runs more than one region at once.

| Strategy | Running in the recovery region | Work at failover | Recovery time and data loss, as AWS characterizes them | Ongoing cost |
|---|---|---|---|---|
| **Backup and restore** | Backups only | Deploy the infrastructure, restore the data, switch traffic | Hours | Lowest |
| **Pilot light** | Live replicated data and core infrastructure. Application servers not running | Deploy or start the application servers, scale out, promote the replica database to accept writes, switch traffic | Tens of minutes | Low |
| **Warm standby** | The whole stack, running at reduced capacity | Scale up, promote the database, switch traffic | Minutes | Medium |
| **Multi-site active/active** | The whole stack at full capacity, serving users | Route traffic away from the failed region | Near zero for losing a region | Highest |

### Backup and Restore

Data is backed up on a schedule, or continuously where the service supports *point-in-time recovery*, restoring to any chosen moment within a retention window, and the backups are copied to the recovery region. At failover, the infrastructure is recreated there and the data restored. The infrastructure has to be defined as code for this to work within any sensible RTO, and the backup has to include everything the rebuild needs, such as machine images and configuration, not just the data.

Restoring a backup is itself a *control plane* operation, the kind of management API call that is less available than the services' everyday *data plane*, the path that actually serves requests. AWS suggests restoring backups into the recovery region on a schedule. That leaves a recent, usable data store in place even if restore calls fail during a disaster, and it tests the backups at the same time.

### Pilot Light

The data is replicated continuously into live databases and storage in the recovery region, and the core infrastructure, such as networking, is provisioned. Application servers are defined but not running. AWS's recommended form of "switched off" is not deployed at all, with everything ready to deploy on failover. Recovery means deploying and scaling out the application tier, promoting the replica database to accept writes, and switching traffic.

The cost is mostly the replicated data, but every release now has to reach both regions, or the recovery region falls behind the primary. How fast the database takes over matters too. Promoting an RDS read replica in another region takes several minutes or longer and includes a reboot. An Aurora global database replicates with lag typically measured in seconds or less, and a secondary cluster typically takes over as primary within a few minutes. AWS Elastic Disaster Recovery applies the pilot light pattern to servers, whether in AWS, on-premises, or in another cloud, replicating their disks continuously and launching full-size copies on failover.

### Warm Standby

A complete copy of the workload runs in the recovery region at reduced size, so it can serve traffic immediately, just not all of it. That is the difference from pilot light: pilot light cannot handle a request until something is started, while warm standby only has to scale up. Because the standby is live, it can also be tested continuously with synthetic requests.

Scaling up is a control plane operation too, and it depends on the recovery region's service quotas being high enough for production capacity. A team that doesn't want to depend on scaling at the worst moment can run the standby at full capacity, which AWS calls *hot standby*. At that point, many teams choose to serve traffic from both regions instead, since the capacity is already paid for.

### Multi-Site Active/Active

Every region serves users all the time, each able to carry the full load. Losing a region means routing its users to the others, so there is no failover in the usual sense, and recovery from a regional outage can be close to immediate.

The hard part is writes. AWS describes three designs:

- **Write global.** All writes go to one region and reads are served locally. Losing the write region means promoting another, as an Aurora global database does.
- **Write local.** Each region accepts writes, and the database reconciles conflicts. DynamoDB global tables do this by default with *last writer wins*, so one of two concurrent updates to the same item is silently discarded. Their newer strongly consistent mode instead replicates writes synchronously and rejects the conflicting one.
- **Write partitioned.** Each user or record belongs to one region, chosen by a key such as user ID, so two regions never write the same data.

Active/active is the most complex and expensive strategy, and like every other strategy it still needs the backups covered below.

---

## Failing Over and Back

A failover can start automatically on health checks or be started by a person. AWS's guidance leans toward a person deciding and automation doing the work. Every failover costs some availability and some data, so failing over on a false alarm causes the loss it was meant to prevent, but once the decision is made, the steps should be one command, not a runbook to follow by hand at 3 a.m.

The steps themselves should avoid control plane operations wherever possible, since AWS designs data planes for higher availability than control planes. Two more steps come before any traffic moves. Detection counts against the RTO, since the clock starts when service is interrupted, not when someone notices, so monitoring that catches a regional failure quickly is part of the recovery design. And writes have to stop reaching the old primary before the replica is promoted, which in a real outage usually means taking the application offline or pointing it at a writer endpoint that moves with the promotion. Otherwise both regions accept writes at once, a *split brain*, and the two diverging copies of the data have to be reconciled by hand.

For moving traffic between regions, the reliable options run on the data plane:

- **DNS failover on health checks**, such as Amazon Route 53's, runs on the data plane. Amazon Application Recovery Controller adds health checks that act as manual on/off switches, so a person can trigger the failover through the same highly available path.
- **Anycast addresses**, static IP addresses announced from many locations at once, such as AWS Global Accelerator's, move traffic on health checks without waiting for DNS caches to expire.

Changing routing weights by editing DNS records, or turning Global Accelerator's traffic dials by hand, are control plane operations, and less dependable during an event.

Failing back is its own project and is often harder than failing over. The original region's data is now stale, so it has to be resynchronized from the recovery region before traffic returns, and the move back usually carries its own brief outage. It needs the same planning and testing as the failover.

---

## Keeping Backups Out of Reach

A backup that the same mistake or attacker can delete is not a disaster recovery measure. The protections that matter:

- **Versioning and point-in-time recovery**, so an overwritten or corrupted object can be rolled back to a moment before the damage. Amazon S3 replication, by default, does not replicate deletions from the source, which keeps the recovery region's copy intact when objects are deleted in the primary.
- **A separate account**, so credentials stolen from the production account cannot reach the backups. AWS Backup can copy backups across accounts and regions.
- **Immutability**, where even an administrator cannot delete a backup before its retention period ends. AWS Backup Vault Lock and S3 Object Lock provide this in *compliance mode*. Their governance mode can be lifted by anyone with the right permissions, so it guards against accidents but not against a compromised administrator.

---

## Testing Recovery

A recovery plan that has never been exercised is a guess. Testing turns the RTO and RPO from targets into measured numbers, and it finds the steps that no longer work because the architecture moved on.

- **Restore tests** prove backups can be restored and that the restored data is complete and usable. Scheduled automatic restores do this continuously.
- **Failover drills** run the real procedure, first in a non-production environment and eventually in production during a planned window, and time each step against the RTO.
- **Region evacuation tests** for active/active confirm that the remaining regions can carry the full load when one is drained.
- **Failback** gets tested too, since a failover that can't be reversed leaves the workload in its recovery region indefinitely.

Tests belong on a schedule and after any significant architecture change. Deliberately injecting failures into production systems goes further, into chaos engineering, and complements rather than replaces these drills. [AWS Resilience Hub](https://aws.amazon.com/resilience-hub/){:target="_blank" rel="noopener noreferrer"} can assess a workload against its RTO and RPO targets between tests.

---

## Choosing per Workload

Most organizations don't pick one strategy. They tier their workloads by the business impact analysis and give each tier the cheapest strategy that meets its objectives:

| Tier | Typical strategy |
|---|---|
| Revenue- or safety-critical, where minutes of downtime matter | Warm standby, or multi-site active/active |
| Important, where an outage of under an hour is tolerable | Pilot light |
| Everything else | Backup and restore |

A workload's tier also constrains its dependencies. A critical service on warm standby that relies on a shared database on backup and restore will recover at the database's pace, so tiering has to follow the dependency chain, not just each service on its own.
