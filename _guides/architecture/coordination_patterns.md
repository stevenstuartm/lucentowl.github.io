---
layout: guide
title: "Coordination Patterns"
category: Architecture
subcategory: Patterns
description: "Distributed coordination patterns including leader election, distributed locks, consensus algorithms, and managing shared resources across multiple nodes."
tags: [architecture, design-patterns, distributed-systems, consensus, coordination, advanced]
---

Coordination patterns enable multiple distributed nodes to work together effectively, ensuring consistency, preventing conflicts, and managing shared resources.

## Leader Election

Selects one node from a group to act as the coordinator. The leader makes decisions, assigns work, or manages shared state on behalf of the group. If the leader fails, the remaining nodes elect a new leader.

**How It Works**:

```
Initial State:                   Leader Failure:                  New Election:
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│ Node 1 (Leader) ★   │         │ Node 1 (Leader) ✗   │         │ Node 1 ✗            │
│ Node 2 (Follower)   │    →    │ Node 2 (Follower)   │    →    │ Node 2 (Leader) ★   │
│ Node 3 (Follower)   │         │ Node 3 (Follower)   │         │ Node 3 (Follower)   │
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
                                 Nodes detect failure            Node 2 elected
                                 via heartbeat timeout           (highest ID wins)
```

**Use When**:
- Need a single coordinator for distributed operations (job scheduling, partition assignment)
- Preventing duplicate processing (only leader processes certain tasks)
- Managing distributed state that requires a single writer

**Election Mechanisms**:

| Mechanism | How It Works | Used By |
|-----------|--------------|---------|
| Bully algorithm | Highest-ID node wins; nodes challenge higher IDs | Simple systems |
| Raft leader election | Term-based voting; majority vote wins | etcd, Consul |
| ZooKeeper ephemeral nodes | First node to create ephemeral node wins | Kafka, HBase |

```
ZooKeeper Election Example:

1. All nodes try to create ephemeral node /election/leader
   Node 1: CREATE /election/leader → SUCCESS (becomes leader)
   Node 2: CREATE /election/leader → FAIL (node exists)
   Node 3: CREATE /election/leader → FAIL (node exists)

2. Followers watch /election/leader for deletion

3. Leader crashes → ZooKeeper deletes ephemeral node

4. Followers get notification → Race to create node
   Node 2: CREATE /election/leader → SUCCESS (new leader)
   Node 3: CREATE /election/leader → FAIL
```

**Leader Lease Pattern**:

To prevent split-brain (two nodes thinking they're leader), leaders hold a time-limited lease they must periodically renew.

```
Leader lease timeline:

T=0:   Node 1 acquires lease (expires T=10)
T=5:   Node 1 renews lease (expires T=15)
T=8:   Node 1 crashes, stops renewing
T=15:  Lease expires
T=16:  Node 2 acquires new lease, becomes leader

During T=8-15: No leader (safer than split-brain)
```

**Common Implementations**: ZooKeeper | etcd | Consul | Raft consensus libraries

---

## Distributed Lock

Ensures only one node can access a shared resource at a time, even across a cluster. Unlike local locks, distributed locks must handle network failures, node crashes, and clock skew.

**How It Works**:

```
Without Lock:                        With Distributed Lock:
┌───────────┐   ┌───────────┐       ┌───────────┐   ┌───────────┐
│  Node A   │   │  Node B   │       │  Node A   │   │  Node B   │
│  Read: 10 │   │  Read: 10 │       │ Acquire ──┼───┼─→ BLOCKED │
│  Add: 5   │   │  Add: 3   │       │  Read: 10 │   │  (waiting)│
│  Write:15 │   │  Write:13 │       │  Add: 5   │   │           │
└───────────┘   └───────────┘       │  Write:15 │   │           │
     ↓               ↓              │  Release ─┼───┼─→ Acquire │
Final value: 13 (wrong!)            │           │   │  Read: 15 │
                                    │           │   │  Add: 3   │
                                    │           │   │  Write:18 │
                                    └───────────┘   └───────────┘
                                    Final value: 18 (correct!)
```

**Use When**:
- Multiple nodes might access same resource concurrently
- Need to prevent duplicate operations (sending duplicate emails, double-charging)
- Coordinating updates to shared state that must be atomic

**Lock Acquisition Process (Redis Example)**:

```
Acquiring a lock:
  1. SET lock:order-123 "node-A" NX PX 30000
     NX = only if not exists
     PX 30000 = expires in 30 seconds

  2. If SET returns OK → Lock acquired
     If SET returns nil → Lock held by someone else, retry or wait

Releasing a lock:
  1. Check if we still own the lock (value == "node-A")
  2. If yes, DELETE lock:order-123
  3. If no, someone else owns it (we took too long, lock expired)

  // Lua script for atomic check-and-delete
  if redis.call("get", key) == owner then
    return redis.call("del", key)
  else
    return 0
  end
```

**Why TTL (Time-To-Live) is Critical**:

```
Without TTL:
  Node A acquires lock → Node A crashes → Lock never released → Deadlock

With TTL:
  Node A acquires lock (TTL=30s) → Node A crashes
  → 30 seconds pass → Lock expires automatically
  → Node B can acquire lock

Danger: Node A might still think it has the lock after expiration
  Solution: Check TTL before critical operations, use fencing tokens
```

<div class="callout callout--warning">
<p class="callout__title">Distributed Lock Challenges</p>
<p><strong>Lock holder failure</strong>: Requires timeout/lease mechanism (lock expires automatically)</p>
<p><strong>Network partitions</strong>: Can cause split-brain scenarios (two nodes think they have lock)</p>
<p><strong>Clock skew</strong>: Different nodes' clocks may disagree on when lock expires</p>
<p><strong>Performance impact</strong>: Distributed coordination adds latency (5-50ms per acquire)</p>
</div>

**Common Implementations**:
- **Redis (single instance)**: Simple SET NX with TTL (not safe for critical data)
- **Redis Redlock**: Acquire lock on N/2+1 of N Redis instances (stronger guarantees)
- **ZooKeeper**: Ephemeral sequential nodes for fair queuing
- **etcd**: Lease-based locks with TTL
- **Consul**: Session-based locks

<blockquote class="pull-quote">
<p>Distributed locks are complex and error-prone. Consider using message queues (only one consumer gets each message) or database constraints (unique indexes, optimistic locking) when possible.</p>
</blockquote>

---

## Consensus

Ensures multiple nodes agree on a value or decision, even in the presence of failures. Fundamental building block for distributed systems requiring strong consistency.

**Use When**:
- Need strong consistency guarantees
- Handling mission-critical decisions
- Implementing distributed databases (etcd, Consul, CockroachDB)
- Building fault-tolerant systems with replicated state

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Paxos (1989)</h4>
<ul>
<li>Classic consensus algorithm by Leslie Lamport</li>
<li>Notoriously difficult to understand</li>
<li>Proven correct, widely studied</li>
<li>Used in Google Chubby, Apache Cassandra (variant)</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Raft (2013)</h4>
<ul>
<li>Designed to be more understandable than Paxos</li>
<li>Leader-based with strong consistency</li>
<li>Clear leader election, log replication, safety guarantees</li>
<li>Used in etcd, Consul, CockroachDB</li>
<li>Majority (quorum) required for decisions</li>
</ul>
</div>
</div>

<div class="callout callout--note">
<p class="callout__title">PBFT (Practical Byzantine Fault Tolerance)</p>
<p>Tolerates Byzantine failures (malicious or arbitrary behavior). Used in blockchain systems. More expensive: 3f+1 nodes needed to tolerate f failures.</p>
</div>

**Example**: Distributed database using Raft consensus to ensure all replicas agree on transaction ordering and committed state.

```
Client → Write request → Leader
Leader → Propose to followers → [Follower 1, Follower 2]
Majority (2 of 3) agrees → Commit to log → Acknowledge client
```

<blockquote class="pull-quote">
<p>Consensus algorithms choose Consistency + Partition Tolerance over Availability during network partitions (CAP Theorem)</p>
</blockquote>

**Trade-offs**:
- **Pros**: Strong consistency, proven correctness, fault tolerance
- **Cons**: Lower availability during network partitions, performance overhead, requires quorum

---

## Quick Reference

### Pattern Comparison

| Pattern | Purpose | Consistency | Complexity |
|---------|---------|-------------|------------|
| **Leader Election** | Designate coordinator | Eventual | Medium |
| **Distributed Lock** | Prevent concurrent access | Strong | Medium |
| **Consensus** | Agree on values | Strong | High |

### When to Choose

| Question | Pattern |
|----------|---------|
| Need coordinator but can tolerate brief periods without one? | Leader Election |
| Need to prevent concurrent access to critical resources? | Distributed Lock |
| Need all nodes to agree on critical decisions? | Consensus |

### Implementation Tools

**ZooKeeper**: All three patterns
**etcd**: All three patterns
**Redis**: Distributed lock (Redlock)
**Consul**: Leader election, distributed lock
**Raft libraries**: Consensus

---
