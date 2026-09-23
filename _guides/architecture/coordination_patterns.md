---
layout: guide
title: "Coordination Patterns"
category: Architecture
subcategory: Patterns
description: "How distributed nodes agree on who acts and what is true: leader election with leases, distributed locks and why they need fencing tokens for correctness, and consensus with Raft and Paxos."
tags: [advanced, leader-election, distributed-lock, fencing-token, consensus, raft]
---

Some work only goes right when exactly one node does it: one scheduler assigning jobs, one writer updating a record, one controller deciding partition ownership. On a single machine a mutex settles that. Across a network, nodes crash without saying so, messages arrive late, clocks disagree, and a process can pause for long enough that the world moves on without it. Coordination patterns are the ways systems still get to "exactly one" under those conditions, and each one depends on the one below it.

- **Leader election** picks a single node to act for the group.
- **Distributed locks** grant one node exclusive access to one resource for a while.
- **Consensus** is what makes both of those safe, by getting a majority of nodes to agree on a value even when some of them fail.

## Leader Election

One node in a group is chosen to coordinate. It assigns work, makes decisions, or acts as the single writer for some shared state. When it fails, the remaining nodes choose another.

{% include figure.html id="pat-leader-failover" %}

**Use when**:
- A task such as job scheduling or partition assignment must have one coordinator
- Some work must happen once, and running it on every node would duplicate it
- Shared state needs a single writer

**Election mechanisms**:

| Mechanism | How it works | Safe under network partitions? |
|-----------|--------------|--------------------------------|
| Bully algorithm | The highest-ID reachable node claims leadership | No. Two sides of a partition can each elect their own leader |
| Raft leader election | Nodes vote in numbered terms, and a candidate needs a majority | Yes. Only one side of a partition can hold a majority |
| Coordination service | Nodes race to create a key or ephemeral node in ZooKeeper, etcd, or Consul, and the winner leads | Yes, because the service itself runs consensus underneath |

Using a coordination service is the common choice in application code, since it hands the hard part to a system built for it. The ZooKeeper form looks like this.

```
1. Every node tries to create the ephemeral node /election/leader
   Node 1: CREATE /election/leader → SUCCESS (becomes leader)
   Node 2: CREATE /election/leader → FAIL (node exists)
   Node 3: CREATE /election/leader → FAIL (node exists)

2. Followers watch /election/leader for deletion

3. Leader's session expires → ZooKeeper deletes the ephemeral node

4. Followers are notified and race to create it again
   Node 2: CREATE /election/leader → SUCCESS (new leader)
   Node 3: CREATE /election/leader → FAIL
```

Systems that need election internally increasingly embed Raft instead of depending on an external service. Kafka is the prominent example, having replaced ZooKeeper with its own Raft-based KRaft controller and removed ZooKeeper support entirely in Kafka 4.0.

### Leases Bound How Long a Leader Can Be Wrong

A node that has been voted out doesn't necessarily know it. If it paused or lost connectivity, it may resume still believing it leads, while a new leader is already acting. That is split-brain. A lease limits it: leadership is granted for a fixed period that the leader must keep renewing, and a new leader is only chosen after the old lease has expired.

{% include figure.html id="pat-leader-lease" %}

A lease only works if the old leader checks it before acting, and even then it relies on clocks and on the leader not pausing between the check and the action. A garbage collection pause that starts right after a successful check leaves the old leader acting on a lease that expired while it was paused. Leases shrink the window, but they don't close it. Fencing tokens, covered under distributed locks below, close it.

**Trade-offs**: Every failover leaves a gap with no leader, at least as long as the heartbeat timeout plus the lease. Short timeouts shorten the gap but trigger elections on ordinary network slowness, and each unnecessary election is its own brief outage. Concentrating work on one node also caps throughput at what that node can do.

---

## Distributed Lock

A lock that holds across a cluster, so that only one node at a time works on a given resource. Unlike a local mutex, it has to survive the holder crashing, the network dropping, and the holder pausing without knowing it paused.

{% include figure.html id="pat-lock-lost-update" %}

**Use when**:
- Several nodes may act on the same resource at the same time
- An operation should not run twice concurrently, such as sending a batch of emails
- Shared state is updated through a read-modify-write that the storage can't make atomic itself

### Every Lock Needs an Expiry

A lock with no expiry is held forever by a node that crashed while holding it. So distributed locks carry a time-to-live, and a single Redis instance shows the basic mechanics.

```
Acquire:
  SET lock:order-123 "node-A-7f3c" NX PX 30000
    NX       = only set if the key doesn't exist
    PX 30000 = expire after 30 seconds
  OK  → lock acquired
  nil → someone else holds it; wait or retry

Release, atomically, only if we still own it:
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
```

The release checks ownership because the lock may already have expired and been taken by someone else. Deleting without checking would release another node's lock.

### Expiry Breaks Mutual Exclusion, and Fencing Restores It

The expiry that saves you from a crashed holder creates a new problem with a slow one. The holder can stall for longer than the TTL, whether from a garbage collection pause, a swapped-out process, or a network delay, then wake and carry on writing, unaware its lock expired and a second node now holds it.

{% include figure.html id="pat-lock-expiry" %}

No check inside Node A can prevent this, because the pause can happen after the check. The fix has to live at the resource being protected. A **fencing token** is a number that increases every time the lock is granted. The holder sends its token with every write, and the storage rejects any write carrying a token lower than the highest it has already seen.

{% include figure.html id="pat-fencing-token" %}

That requires two things: a lock service that issues monotonically increasing tokens, and a resource that checks them. ZooKeeper's znode version or transaction id and etcd's revision numbers both serve as tokens. A database can enforce the check with a conditional update on a stored token column.

### Efficiency Locks and Correctness Locks

How much of this applies depends on what happens if two nodes do hold the lock at once. Martin Kleppmann's [analysis of distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html){:target="_blank" rel="noopener noreferrer"} draws the line in two places.

| Purpose | What a lock failure costs | What's adequate |
|---------|---------------------------|-----------------|
| **Efficiency**: avoid doing the same work twice | Some wasted work, or a duplicate notification | A single Redis instance with a TTL |
| **Correctness**: stop concurrent writers corrupting state | Lost updates, or permanently inconsistent data | A consensus-backed lock service issuing fencing tokens, with the resource enforcing them |

Redlock, Redis's multi-instance algorithm, takes a lock on a majority of independent Redis nodes. It survives the loss of individual Redis nodes better than a single instance, but it doesn't make the lock suitable for correctness. It generates no fencing tokens, and its safety depends on bounded network delay, bounded process pauses, and bounded clock drift, all of which real systems violate. It sits in the efficiency row, with more operational cost than a single instance for little gain there.

**Common implementations**:
- **Redis**, single instance or Redlock, for efficiency locks
- **ZooKeeper**, using ephemeral sequential nodes, which also gives fair queuing among waiters
- **etcd**, using leases and its lock API
- **Consul**, using sessions

<div class="callout callout--tip">
<p class="callout__title">Look for a Way Not to Lock</p>
<p>A distributed lock is often standing in for something the storage can already do. A unique constraint prevents duplicate inserts, an optimistic concurrency check on a version column prevents lost updates, and a queue with competing consumers hands each message to one worker. Each of these puts the guarantee where the data is, which is where fencing would have had to put it anyway.</p>
</div>

**Trade-offs**: Every acquisition is a network round trip to the lock service, so a lock on a hot path becomes a throughput limit. The lock service is a dependency whose outage blocks every holder. And a lock that is correct needs cooperation from the resource it protects, which makes it a design change to that resource, not a wrapper around existing code.

---

## Consensus

Consensus gets a group of nodes to agree on a value, such as which node leads, whether a write committed, or the order of entries in a log, in a way that stays agreed even when some nodes fail. It is what leader election and correctness locks rest on, and application code rarely implements it directly. It uses a coordination service or a database that has consensus built in.

The core rule is a majority quorum. A cluster of 2f+1 nodes keeps working with up to f of them failed, because any two majorities overlap in at least one node, and that node carries forward what was decided. Three nodes tolerate one failure, and five tolerate two.

{% include figure.html id="pat-consensus-replication" %}

**Use when**:
- A decision must hold even if some of the nodes that made it are lost
- Replicated state has to be identical across nodes, in the same order
- Building or operating the coordination layer that other services depend on

| | Paxos | Raft |
|---|-------|------|
| Origin | Leslie Lamport, "The Part-Time Parliament", circulated from 1989 and published in 1998 | Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm", 2014 |
| Design goal | Correctness, stated minimally | Understandability, with leader election, log replication, and safety as separate parts |
| Reputation | Notoriously hard to understand and to turn into a working system | Easier to reason about, which is much of why it spread |
| Found in | Google Chubby, and Cassandra's lightweight transactions | etcd, Consul, CockroachDB, and Kafka's KRaft controller |

Both assume nodes fail by crashing or going silent, not by lying. Tolerating nodes that behave arbitrarily or maliciously is the Byzantine fault tolerance problem, which algorithms such as PBFT address at a higher price: 3f+1 nodes to tolerate f faulty ones. That cost is why BFT shows up in blockchains and systems spanning mutually distrustful parties, and rarely inside one organization's infrastructure.

**Trade-offs**: A consensus group stops accepting writes when it loses its majority, so during a partition the minority side is unavailable by design, choosing consistency over availability. Every write waits for a majority to acknowledge it, so latency is set by the slower members of the quorum, and spreading nodes across regions for resilience makes every write pay cross-region latency. Adding nodes improves fault tolerance but not write throughput, which is why consensus clusters stay small, typically three or five nodes.

---

## Quick Reference

| Pattern | What it guarantees | Depends on | Main cost |
|---------|-------------------|------------|-----------|
| **Leader election** | At most one leader at a time, if backed by consensus and leases | Consensus, and fencing for writes the old leader might still make | A leaderless gap on every failover |
| **Distributed lock** | One holder at a time for efficiency, and for correctness only with fencing | A lock service, and a resource that enforces fencing tokens | A round trip per acquisition, and a dependency every holder shares |
| **Consensus** | Agreement that survives the failure of a minority of nodes | A majority of nodes being reachable | Unavailability without a majority, and quorum latency on every write |
