---
layout: guide
title: "Replication and Consistency"
category: Databases
subcategory: Database Foundations
description: "How databases keep copies of data in sync across nodes: single-leader, multi-leader, leaderless, and consensus replication, the anomalies replication lag causes, and what CAP, PACELC, and BASE actually say."
tags: [replication, consistency, cap-theorem, eventual-consistency, quorum, consensus, advanced]
---

## Why Replicate

Replication keeps a copy of the same data on several nodes. It serves four goals, and which one matters most decides the design:

- **Availability.** If one node fails, another can serve requests.
- **Durability.** A committed write survives the loss of a whole server, not just a crash.
- **Read scaling.** Read traffic spreads across copies.
- **Latency.** A copy in each region serves nearby users.

Splitting a dataset that's too large for one node into pieces is a separate technique called sharding, and most distributed databases do both, replicating each shard. Many databases call shards partitions, but this guide says shard throughout and reserves "partition" for a network partition, where nodes can't reach each other.

The hard part is keeping the copies in agreement while writes keep arriving and nodes and networks fail. Every design below makes a different trade between how current a read is guaranteed to be and how available and fast the system stays.

---

## Replication Topologies

{% include figure.html id="db-replication-topologies" %}

### Single-Leader Replication

One node, the **leader** (or primary), accepts all writes. It records each change in its log and ships the log to **followers** (replicas), which apply the changes in the same order. Reads can go to the leader or to followers. PostgreSQL streaming replication, MySQL replication, SQL Server availability groups, and MongoDB replica sets all work this way.

The key setting is when the leader confirms a write to the client:

- **Asynchronous** replication confirms as soon as the leader has the write. It's fast, and a slow follower doesn't slow writes, but if the leader fails before a follower receives the write, the write is lost even though the client was told it succeeded. This is the default in PostgreSQL and MySQL.
- **Synchronous** replication waits for one or more followers to confirm. No confirmed write is lost when the leader fails, but every write pays a network round trip. What happens when the synchronous follower is unavailable differs. PostgreSQL, configured through `synchronous_standby_names`, makes commits wait until a synchronous follower is back. MySQL's semi-synchronous replication waits for a follower to acknowledge receipt, and if none does before a timeout, it falls back to asynchronous replication, so the no-loss guarantee lapses exactly when a follower is down.

When the leader fails, a follower is promoted in a **failover**. Failover is where single-leader systems get hurt. Asynchronous replication can lose the writes the old leader never shipped. If the old leader comes back still believing it's the leader, two nodes accept writes at once, a situation called **split brain**, and the data diverges. Failover tooling guards against this by fencing the old leader, cutting off its access before promoting a new one.

### Multi-Leader Replication

Several nodes accept writes, typically one per region, and each replicates its writes to the others. Users write to a nearby leader, so write latency stays low and each region keeps working if the link between regions fails. Offline-capable apps follow the same pattern, with each device acting as a leader that syncs when it reconnects.

The cost is **write conflicts**. Two leaders can accept conflicting changes to the same record at the same time, and the conflict is only discovered when they sync. Some rule has to resolve it. **Last write wins** keeps the version with the later timestamp and silently discards the other, which loses data and depends on clocks agreeing. Merging the changes needs data types designed for it, such as CRDTs (conflict-free replicated data types) like counters and sets that merge deterministically, or application code that resolves conflicts itself. Multi-leader setups are worth their complexity mostly when writes genuinely must be accepted in several places. DynamoDB global tables are a managed example. In their default mode, multi-Region eventual consistency, they resolve conflicting writes with last write wins. A strongly consistent mode instead replicates each write synchronously to at least one other region and rejects a write that conflicts with one in progress in another region.

### Leaderless Replication

In leaderless replication, the design described in Amazon's 2007 Dynamo paper, any replica accepts writes. The client, or a coordinator node acting for it, sends each write to all N replicas of a key and treats it as successful once W of them confirm. A read asks R replicas. Cassandra and ScyllaDB work this way. Amazon's DynamoDB service, despite the name, does not. It uses a leader for each shard of a table.

If W + R > N, the set of replicas written and the set read must overlap in at least one node, so a read normally sees the latest successful write. With N = 3, writing to 2 and reading from 2 is the common **quorum** configuration. Cassandra exposes this per request as consistency levels such as `ONE`, `QUORUM`, and `ALL`, trading latency and availability against how current a read is.

When replicas return different versions, the store has to pick one, and there are two approaches. Cassandra keeps the value with the latest timestamp for each column, which is last write wins. It's simple, but of two concurrent writes, one is silently discarded. The original Dynamo design instead returned all concurrent versions to the application to merge.

Replicas that missed a write catch up in the background. **Read repair** fixes a stale replica when a read notices it, **hinted handoff** holds writes for a down node and delivers them when it returns, and **anti-entropy** repair compares replicas and copies the differences. Even with W + R > N, a leaderless store isn't guaranteed to behave like a single copy. Concurrent writes to the same key, or a write that reached fewer than W replicas before failing, can still produce reads that go backward or disagree. Some Dynamo-style stores also use a **sloppy quorum**. When a key's usual replicas are unreachable, other nodes accept the write and hand it off later. That keeps writes available but breaks the overlap guarantee, because the W nodes that took the write may not be among the R nodes a read asks. Cassandra doesn't count hinted writes toward the consistency level, except at its `ANY` level.

### Consensus Replication

Consensus protocols like **Raft** and **Paxos** replicate a log so that a write commits only once a majority of replicas have it, and a new leader can only be elected by a majority. Because any two majorities overlap, a committed write survives failover, and split brain can't happen. etcd, CockroachDB, TiKV, and Google Spanner replicate this way, and ZooKeeper uses a similar protocol of its own, Zab.

Consensus fixes the two weaknesses of single-leader failover, lost writes and split brain. It costs a majority round trip on every write, so a cluster spread across distant regions pays cross-region latency on each one, and a partition that leaves no majority stops writes entirely. Reads need care too. Only a read confirmed through the current leader is guaranteed current, so these systems route linearizable reads through the leader, or through a lease or check that proves the leader is still in charge. etcd does this by default. A read served by a follower, or ZooKeeper's default reads, can be stale.

---

## Consistency Models

"Consistency" in replication means how closely the replicated system behaves like a single copy, which is unrelated to the C in ACID. The models form a spectrum from strong to weak:

| Model | Guarantee | Cost |
| --- | --- | --- |
| **Linearizable** (strong) | Once a write completes, every later read anywhere returns it or something newer. The system behaves like one copy | Coordination on every operation. Unavailable to nodes cut off from the majority or leader |
| **Causal** | Operations that depend on each other, such as a reply and the message it answers, are seen in the same order everywhere; unrelated ones may be seen in any order | Tracking dependencies. Can stay available during partitions |
| **Session guarantees** | Read-your-writes and monotonic reads, for each client's own session | Routing or version tracking per client |
| **Eventual** | If writes stop, all replicas eventually converge. Nothing is promised about any single read | Cheapest and most available. The application copes with staleness |

A database's claim of "strong consistency" usually refers to linearizability, sometimes only for reads served by the leader. Check which operations it covers. DynamoDB, for instance, defaults to eventually consistent reads and offers strongly consistent reads on request for tables and local secondary indexes, but not for global secondary indexes or streams.

---

## Replication Lag and What Readers See

With asynchronous replication, followers run behind the leader, usually by milliseconds and sometimes, under load or after a network problem, by seconds or more. Reads from a follower can return stale data, and that produces specific anomalies that users notice.

{% include figure.html id="db-replication-lag" %}

| Anomaly | What the user sees | Usual fix |
| --- | --- | --- |
| **Read-your-writes violation** | A user saves a change, reloads, and the change isn't there, because the reload hit a lagging follower | Read from the leader for a short time after a user writes, or until the follower has caught up to the user's last write |
| **Non-monotonic reads** | A user sees a comment, refreshes, and it's gone, because the second read hit a follower further behind than the first | Pin each user's reads to the same replica |
| **Inconsistent prefix** | A reader sees an answer before the question it replies to, because the question and answer live on different shards whose followers lag by different amounts | Keep causally related writes on the same shard, or use a database that provides causal consistency |

These fixes are guarantees the application layers over an eventually consistent store. Some databases provide them directly. MongoDB, for example, offers causally consistent sessions.

---

## The CAP Theorem

The CAP theorem, conjectured by Eric Brewer in 2000 and proved by Seth Gilbert and Nancy Lynch in 2002, concerns three properties of a replicated system:

- **Consistency**, which in CAP means linearizability: every read sees the most recent write.
- **Availability**: every request to a node that hasn't failed gets a response, rather than an error or a timeout.
- **Partition tolerance**: the system keeps operating when the network drops messages between nodes.

The theorem says that during a network partition, a system must give up either consistency or availability. Partitions aren't optional in a distributed system, so the real choice is what happens when one occurs. A **CP** choice refuses some requests, typically on the minority side of the partition, rather than risk returning stale data. An **AP** choice keeps answering on both sides and accepts that the answers can diverge until the partition heals.

CAP is narrower than it's often presented. It says nothing about behavior when the network is healthy, which is almost always. Its "consistency" is the strictest model, so a system that isn't linearizable isn't CAP-consistent even if it's strongly consistent in a looser sense. And CP and AP describe how a system is configured to respond, not fixed properties of a product. Cassandra at consistency level `ONE` keeps answering during a partition, while at `QUORUM` on both reads and writes it rejects requests that can't reach a quorum. That's CP-style behavior, but it still isn't linearizable, because concurrent writes are resolved by timestamp. etcd, which serves linearizable reads through its leader, is a clear CP system. A single-node database isn't distributed, so CAP doesn't apply to it at all, and a relational database with asynchronous read replicas serves stale reads from those replicas whatever label it's given.

### PACELC: The Trade-Off That Never Goes Away

Daniel Abadi's PACELC formulation (2012) adds the part CAP leaves out. If there's a **P**artition, choose between **A**vailability and **C**onsistency, **E**lse, when the network is healthy, choose between **L**atency and **C**onsistency. Keeping replicas in agreement costs round trips even when nothing is failing, so the everyday trade-off is between fast responses and guaranteed-current ones. That's the choice behind synchronous versus asynchronous replication and behind consistency levels like `ONE` versus `QUORUM`, and teams face it on every request, not only during failures.

---

## BASE and When Eventual Consistency Is Acceptable

BASE, an acronym from Eric Brewer and colleagues in the late 1990s that Dan Pritchett popularized in a 2008 ACM Queue article, describes the design philosophy of systems that choose availability over immediate consistency. It stands for **B**asically **A**vailable, **S**oft state, and **E**ventually consistent. Where ACID is pessimistic and forces consistency at the end of every operation, BASE accepts that the data is briefly in flux and designs the application to tolerate it. It's a stance on how to build the system, not a formal guarantee like CAP's properties.

Eventual consistency works when:

- A stale read costs little, such as a follower count that's a few seconds behind.
- The application can hide the inconsistency, such as showing a user their own change optimistically in the UI.
- Showing slightly old data is better than showing nothing.

It fails when:

- A decision based on a read commits real resources, such as inventory or money.
- Users compare values across requests and notice disagreement, such as two customers seeing different prices.

---

## Choosing a Replication Design

| If you need | Consider | Accept |
| --- | --- | --- |
| Read scaling and failover for one primary region | Single-leader, asynchronous | Stale follower reads, possible loss of the last writes on failover |
| No lost writes on failover in one region | Single-leader with one synchronous follower, or consensus | Higher write latency. With a synchronous follower in PostgreSQL, writes block while that follower is down |
| Writes accepted in several regions, low latency everywhere | Multi-leader, or leaderless across regions | Conflict resolution and eventual consistency |
| Very high write availability, tunable per request | Leaderless with quorums | Eventual consistency by default, repair processes to operate |
| Linearizable reads and writes across regions | Distributed SQL, relational databases that shard and replicate with consensus | Cross-region latency on every write |

---
