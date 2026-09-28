---
title: "Multi-Region Architecture on AWS: Replication, Consistency, and Regional Independence"
layout: guide
category: AWS
subcategory: Resilience
description: "What running a workload in more than one AWS Region involves: when a second Region is worth it, keeping each Region independent, choosing between single-writer, multi-active, and partitioned data, and how Aurora Global Database, DynamoDB global tables, S3 replication, and ElastiCache Global Datastore replicate, fail over, and bill."
tags: [multi-region, aurora-global-database, dynamodb-global-tables, s3-replication, consistency, multi-active, advanced]
---

## What a Second Region Buys

An AWS Region is a set of Availability Zones in one metro area, and a workload spread across those zones already survives the loss of a data center. A second Region protects against something rarer, an impairment that affects a whole Region or a service within it, and it helps with two other problems: latency for users on other continents, and data that must be stored in a particular jurisdiction.

Each reason asks for something different. Surviving a Regional impairment needs the data in the second Region and a way to move traffic there. Serving distant users needs the application running close to them, reading data locally. Residency often needs the opposite of replication, with each jurisdiction's data kept in its own Region and never copied out.

The cost is more than a second bill. AWS's multi-Region guidance points out that an application designed for one Region is hard to make multi-Region, because the distance between Regions forces a trade between consistency, availability, and write latency that the application has to be written to handle. Most workloads that go multi-Region for resilience don't need both Regions serving writes. The recovery strategies themselves, such as how much standby capacity to keep and how to test a failover, are a disaster recovery decision. This guide covers the architecture those strategies rest on, which is how each Region stays independent and how data crosses between them.

---

## Keep Each Region Independent

A second Region only helps if it keeps working when the first one doesn't. That rules out a Region that calls the other at runtime. AWS's guidance is to avoid cross-Region calls between the services that make up a workload, and to fail over all the services in a user journey together, so no request ends up bouncing between Regions.

Dependencies that are easy to overlook include:

- **Configuration and secrets.** Certificates, KMS keys, secrets, parameters, AMIs, and container images should exist in each Region. Secrets Manager can replicate a secret to other Regions, and ECR can replicate images. AWS recommends Region-specific keys and secrets, so a bad rotation affects one Region, and staggered certificate expiry dates.
- **Quotas and capacity.** Most service quotas apply per account per Region. A standby Region with default quotas may refuse the capacity a failover needs, so raise them ahead of time.
- **Control planes in one Region.** Some global services, such as IAM and Route 53, have their control plane in a single Region (us-east-1) while their data plane runs everywhere. A failover that has to edit DNS records or IAM policies depends on that Region. Health checks that change routing on their own use the data plane, and AWS offers Application Recovery Controller for orchestrating a Region switch.
- **Third parties.** An identity provider, payment API, or SaaS dependency that runs in the same Region as your primary shares its fate.

The same independence applies to deployment. Every Region runs the same stack from the same templates and pipeline, so the standby isn't a slightly different system discovered during an outage.

---

## Choosing How Data Crosses Regions

Every multi-Region data design starts from one constraint. The network between Regions can partition, so during a partition the design either keeps accepting writes in each Region and lets them diverge, or it stops accepting some writes to keep them consistent. Distance also means that any write that has to be confirmed in two Regions takes longer, often by an order of magnitude.

**Asynchronous replication** confirms a write in one Region and copies it to the others afterward, typically within a second for databases and within minutes or longer for object storage. Writes stay fast, but a Region that fails can take its most recent writes with it, and reads elsewhere can return slightly stale data. After a failover, someone has to reconcile the transactions that didn't make it across, and that takes business logic, not a database setting.

**Synchronous replication** confirms a write only once another Region has it. No committed write is lost, but every write pays the round trip, and staying available through a Regional failure needs a quorum, typically two of three Regions.

On top of that choice sits the question of where writes may happen. AWS's guidance names three patterns, read local and write global, write local, and write partitioned. The figure shows the first two, whose writes flow in different directions.

{% include figure.html id="aws-multi-region-write-patterns" %}

- **Single writer (read local, write global).** One Region takes all writes, and the others serve reads from asynchronous replicas. This suits read-heavy workloads and is the simplest to reason about, but writes from the far Region cross the distance, and failover means promoting a replica.
- **Multi-active (write local).** Every Region accepts writes to its own replica, and replicas exchange changes in both directions. Writes are local everywhere, but two Regions can change the same record at once, and the application has to tolerate the resulting conflict resolution, usually last writer wins, where the change with the latest timestamp replaces the other.
- **Partitioned (Regions as cells).** Each user, tenant, or account is homed in one Region, which is its single writer, so each Region acts as an isolated cell. A Regional failure affects only the users homed there. Each partition needs a failover target if it must survive its Region, and when the partition exists for residency, that target has to sit in the same jurisdiction, or the partition gives up cross-Region failover.

---

## How AWS Services Replicate Across Regions

| Service | Writers | Replication | Typical lag | On Regional failure |
|---|---|---|---|---|
| **Aurora Global Database** | One primary Region | Asynchronous, at the storage layer | Under a second | Promote a secondary, accepting loss of unreplicated writes |
| **DynamoDB global tables, eventual (MREC)** | Every Region | Asynchronous, last writer wins | Typically a second or less | Send traffic to another replica, since every replica already accepts writes |
| **DynamoDB global tables, strong (MRSC)** | Every Region | Synchronous to at least one other Region | None for strongly consistent reads | Remaining Regions keep serving with no data loss |
| **S3 Replication** | The source bucket, or both with two-way replication | Asynchronous, object by object | Usually minutes, with no guaranteed bound unless Replication Time Control is on | Read or write the replica bucket |
| **ElastiCache Global Datastore** | One primary cluster | Asynchronous | Typically under a second | Promote a secondary cluster |

### Aurora Global Database

An Aurora global database has one **primary** cluster that takes writes and up to 10 read-only **secondary** clusters in other Regions. Replication happens in the storage layer on dedicated infrastructure rather than through the database engine, so it costs the primary little and usually lands in under a second. Applications that write should connect through the **global writer endpoint**, which follows the primary to whichever Region holds it. Secondary clusters can use **write forwarding** to pass writes to the primary, which saves the application from routing them itself but still pays the cross-Region round trip.

Moving the primary happens two ways, and the difference is data loss.

- A **switchover** is for planned moves, such as rotating Regions for compliance or failing back after an outage. Aurora waits until the target secondary is fully caught up, then swaps roles, so nothing is lost.
- A **failover** (`--allow-data-loss`) is for an unplanned outage. It promotes a secondary without waiting, so writes that hadn't replicated are lost, typically seconds' worth. Aurora tries to fence writes to the old primary and snapshot its storage so the missing transactions can be recovered, but fencing is best effort, and an application still writing to the old Region can split the data in two. Take writers offline before failing over, and keep DNS caching short so clients follow the global endpoint.

Aurora PostgreSQL can bound the loss with the `rds.global_db_rpo` parameter, which blocks commits on the primary whenever every secondary is further behind than the set number of seconds. That trades availability of writes for a guaranteed maximum loss. Watch the `AuroraGlobalDBRPOLag` metric either way. Billing covers the instances and storage in each Region, replicated write I/Os in each secondary Region equal to the primary's write I/Os, and data transfer from the primary to the secondaries.

### DynamoDB Global Tables

A DynamoDB **global table** is a set of replica tables with the same name and key schema, one per Region, every one of which accepts reads and writes. Its consistency mode is chosen at creation and can't be changed later.

**Multi-Region eventual consistency (MREC)**, the default, replicates each change asynchronously, typically within a second. When the same item changes in two Regions at once, the write with the latest timestamp wins for the whole item. Several behaviors follow from that design. A strongly consistent read returns the latest version only if the item was last written in the same Region. A conditional write checks the local copy. A transaction is atomic only in the Region that ran it, so another Region can briefly see part of it.

**Multi-Region strong consistency (MRSC)**, generally available since June 30, 2025, confirms each write in at least one other Region before returning, so strongly consistent reads in any Region see the latest version and a Regional failure loses nothing. It runs in exactly three Regions, as three replicas or two replicas plus a **witness** that stores data but serves no reads or writes, from a fixed list of 15 Regions. A write to an item already being changed in another Region fails with `ReplicatedWriteConflictException` and can be retried. MRSC tables can't use TTL, local secondary indexes, or transactions, and an MRSC table can only be created from an empty table.

Replicated writes are billed in every Region with a replica, at the same price as ordinary writes, and DynamoDB charges no data transfer for replication between the Regions of a global table. A witness adds no replicated-write, storage, or transfer charge. Global tables carry a 99.999% availability SLA, against 99.99% for a single-Region table. AWS Fault Injection Service can pause replication to one replica to rehearse a Region isolation.

### S3 Replication

S3 Cross-Region Replication copies new objects from a source bucket to buckets in other Regions, asynchronously and object by object. Without further settings it has no guaranteed completion time, and S3 Replication Time Control adds an SLA-backed 15-minute bound for designs that need to know how far behind the replica can be. Two-way replication keeps two buckets in step when both accept writes.

An S3 **Multi-Region Access Point** gives one global endpoint over buckets in several Regions and routes each request to the nearest bucket. It doesn't move data itself. A read can reach a bucket that doesn't have the object yet and get a 404, so it's paired with replication, ideally two-way. Its **failover controls** mark each bucket active or passive and shift traffic between them, and AWS recommends setting up two-way replication first, so writes made in the Region traffic moved to flow back once the original Region recovers.

### ElastiCache Global Datastore

A **Global Datastore** links a primary Valkey or Redis OSS cluster to secondary clusters in other Regions, replicated asynchronously. The secondaries serve local reads, and one can be promoted to primary if the primary Region degrades. It works with node-based clusters, not serverless caches.

Other services have their own cross-Region options, among them Aurora DSQL's strongly consistent multi-Region clusters, DocumentDB global clusters, KMS multi-Region keys, Secrets Manager secret replication, and ECR replication. Each has the same questions to answer: who can write, whether replication waits, and what a failover loses.

---

## Routing Users Between Regions

Traffic reaches the right Region through DNS or an edge service. Route 53 latency-based and geolocation routing send each user to the nearest or the jurisdictionally correct Region, and failover routing with health checks moves traffic when a Region stops answering. CloudFront can fail over between origins in different Regions. Whatever does the routing has to decide on its own, from health checks, rather than wait for someone to edit records during an outage, and client DNS caching sets how fast users actually move.

Routing and data have to agree. If users are routed to the nearest Region but the data model is single-writer, the application must send those users' writes to the primary. If the data is partitioned by Region, routing has to send each user to their home Region, not the nearest one.

---

## Cost

A second Region roughly doubles whatever runs in both. A standby that runs at reduced capacity costs less, but it has to scale up during the failover, when other customers of the impaired Region may be trying to do the same. Data transfer between Regions adds a per-GB charge, $0.01 to $0.02 per GB between US Regions and more between some others, on database replication, S3 replication, and any application traffic that crosses. DynamoDB global tables are the exception, with no transfer charge for replication. Replicated writes also cost money in each Region, as replicated write I/Os for Aurora and replicated write units for DynamoDB. S3 adds replication requests at the destination, a per-GB fee for Replication Time Control, and a per-GB data routing charge for requests through a Multi-Region Access Point. An ElastiCache Global Datastore bills its nodes in every Region plus the transfer between them.

---

## Common Pitfalls

- **Routing that ignores the data model.** Sending every user to the nearest Region breaks a partitioned design, whose users must reach their home Region, and adds a cross-Region hop to every write in a single-writer design.
- **A standby that has never taken traffic.** Configuration drift, missing secrets, and low quotas surface only when the Region is used. Shift real traffic to it on a schedule, for example with an Aurora switchover or a DynamoDB Region-isolation experiment.
- **Unplanned failover with the old primary still writing.** Aurora's write fencing is best effort. Stop writers first, or plan to reconcile two diverged copies.
- **Choosing MREC for data that can't tolerate conflicts.** Account balances or inventory counts written in two Regions silently lose one update under last writer wins. Route those writes to one Region, or use MRSC.
- **Replication lag nobody watches.** Alarm on `AuroraGlobalDBRPOLag`, DynamoDB `ReplicationLatency`, and S3 replication metrics, since the lag at the moment of failure is the data a failover loses.

---

## Key Takeaways

- A second Region protects against Regional impairment, brings the application closer to distant users, or satisfies residency, and each asks for a different design. Most resilience-driven workloads don't need two Regions accepting writes.
- Each Region must run without calling the other, with its own keys, secrets, images, quotas, and a failover that doesn't depend on the failing Region.
- Asynchronous replication keeps writes fast but can lose recent writes in a failover. Synchronous replication loses nothing but slows every write, and staying writable through a Regional failure typically needs a quorum of three Regions, as DynamoDB MRSC does.
- Single-writer designs promote a replica on failure. Multi-active designs accept conflicts, usually resolved by last writer wins. Partitioned designs home each user in one Region and limit the blast radius.
- Aurora Global Database uses a primary with up to 10 secondaries, a lossless switchover for planned moves, and a failover that can lose seconds of writes. DynamoDB global tables choose eventual (MREC) or strong (MRSC) consistency at creation. S3 replicates objects asynchronously and fails over through Multi-Region Access Point controls.
