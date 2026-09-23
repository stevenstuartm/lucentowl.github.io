---
layout: guide
title: "Transactions and Isolation"
category: Databases
subcategory: Database Foundations
description: "What ACID transactions guarantee and what they don't: isolation levels, locking versus MVCC, per-engine defaults, and how to prevent lost updates and write skew in application code."
tags: [transactions, acid, isolation-levels, mvcc, lost-update, write-skew, practical]
---

## What a Transaction Is

A transaction groups several reads and writes into one unit that the database treats as indivisible. Transferring $100 between two accounts is two updates, a debit and a credit, and a transaction makes sure they either both take effect or neither does.

Most databases run in **autocommit** mode unless told otherwise, so each statement is its own transaction. Two statements are only protected as a unit when the application opens a transaction around them with `BEGIN` (or its driver's equivalent) and ends it with `COMMIT` or `ROLLBACK`. A read followed by a write in autocommit mode shares no guarantees at all.

The guarantees a transaction provides are summarized as **ACID**. The four letters are not equally strong or equally automatic, and most bugs in transactional code come from assuming a letter guarantees more than it does.

---

## ACID, Letter by Letter

### Atomicity: All or Nothing

If any part of a transaction fails, or the application rolls it back, every change it made is undone. There's no partial state: money is never debited without being credited. Atomicity is about failure, not concurrency. It says nothing about what other transactions see while this one runs.

### Consistency: Your Rules, Enforced Where Declared

The database moves from one valid state to another, but "valid" means valid according to the rules you declared: foreign keys, unique constraints, check constraints such as `balance >= 0`. The database enforces those and rejects any transaction that would violate one. Invariants that exist only in application code, such as "a customer has at most three active trials," are the application's job. The database can't enforce a rule it was never told about.

### Isolation: How Much Concurrent Transactions See of Each Other

Isolation controls what a transaction observes of other transactions running at the same time. Perfect isolation would make every transaction behave as if it ran alone, one after another. That's expensive, so databases offer weaker **isolation levels**, and the default level in most databases is not the strongest one. Most of this guide is about isolation, because it's the letter that most often surprises people.

### Durability: Committed Means Kept

Once the database confirms a commit, the change survives crashes and power loss. The engine achieves this by writing the change to its write-ahead log and flushing that log to disk before confirming. Some settings trade this away for speed, such as PostgreSQL's `synchronous_commit = off` or MySQL's `innodb_flush_log_at_trx_commit = 2`, and can lose the last moments of committed transactions on a crash. On a single server, durability also only extends as far as that server's disk survives, which is why replication matters.

---

## Isolation Levels and the Anomalies They Allow

### The Anomalies

Each isolation level is described by the concurrency anomalies it permits. These five account for most isolation bugs in application code:

| Anomaly | What happens |
| --- | --- |
| **Dirty read** | A transaction reads another transaction's uncommitted change, which may later be rolled back |
| **Non-repeatable read** | A transaction reads the same row twice and gets different values, because another transaction committed a change in between |
| **Phantom read** | A transaction runs the same query twice and gets a different set of rows, because another transaction inserted or deleted matching rows |
| **Lost update** | Two transactions read the same value, both compute a new value from it, and the second write silently overwrites the first |
| **Write skew** | Two transactions read overlapping data, each makes a decision based on it, and each writes a different row, together producing a state neither would have allowed |

### The Standard Levels

The SQL standard names four levels and says which of the first three anomalies each must prevent:

| Level | Dirty read | Non-repeatable read | Phantom read |
| --- | --- | --- | --- |
| Read Uncommitted | Possible | Possible | Possible |
| Read Committed | Prevented | Possible | Possible |
| Repeatable Read | Prevented | Prevented | Possible |
| Serializable | Prevented | Prevented | Prevented |

The table understates Serializable. The standard also requires Serializable to produce the same result as running the transactions one at a time, and preventing three anomalies doesn't achieve that on its own. A level can block all three and still allow write skew, which is exactly the gap snapshot isolation falls into. The table is also a floor, not a description of any engine: engines may prevent more than a level requires, and the next sections show that they often do.

---

## How Engines Implement Isolation

### Locking

Under lock-based concurrency control, a transaction takes shared locks on what it reads and exclusive locks on what it writes, and conflicting transactions wait. Serializable isolation under locking also locks key ranges, so another transaction can't insert a phantom row into a range this one has read. Locking is simple to reason about, but readers and writers block each other.

A **locking read** is a `SELECT` that locks the rows it returns, so that no one else can change them until this transaction ends. It's written `SELECT ... FOR UPDATE` in PostgreSQL, MySQL, and Oracle, and with a table hint such as `WITH (UPDLOCK, ROWLOCK)` in SQL Server.

### Multi-Version Concurrency Control (MVCC)

Under **MVCC**, also called row versioning, a write creates a new version of a row instead of overwriting it. Each transaction reads from a **snapshot**, the set of row versions that were committed as of a point in time, so readers never wait for writers and writers never wait for readers. Two writers to the same row still conflict, and the engine either makes one wait or aborts it.

**Snapshot isolation** is the isolation level MVCC naturally produces: every read in a transaction comes from one snapshot, taken at the transaction's first statement that touches data. That prevents dirty reads, non-repeatable reads, and phantoms, but it doesn't prevent write skew, because each transaction checks its own snapshot and neither sees the other's write.

The old versions have to be kept somewhere and cleaned up. PostgreSQL keeps them in the table itself and removes them with `VACUUM`, which is why a long-running transaction holding an old snapshot can make tables grow. Oracle and InnoDB instead keep an **undo log**, a record of each row's previous values, and rebuild old versions from it when a snapshot needs them.

### Deadlocks

Whenever transactions wait for each other's locks, they can end up waiting in a circle: each holds a row the other needs. The engine detects this **deadlock** and aborts one transaction. Deadlocks happen under MVCC too, since writers still lock the rows they change.

---

## What Engines Actually Do

| Engine | Default level | How its levels behave |
| --- | --- | --- |
| PostgreSQL | Read Committed | Read Uncommitted behaves as Read Committed. Repeatable Read is snapshot isolation, and it aborts a transaction whose update conflicts with a concurrent one. Serializable adds detection of write skew |
| MySQL (InnoDB) | Repeatable Read | Plain reads come from a snapshot, but updates and locking reads act on the latest committed data, so read-then-write logic can still lose updates |
| SQL Server | Read Committed | Uses locks by default. The database-wide `READ_COMMITTED_SNAPSHOT` option switches Read Committed to row versioning, and Azure SQL Database turns it on by default. A separate Snapshot level aborts on update conflicts. Serializable uses range locks |
| Oracle | Read Committed | Offers only Read Committed and Serializable, plus read-only transactions. Its Serializable level is snapshot isolation, so it doesn't prevent write skew |

Code written and tested against one database can behave differently on another, and code that looks correct in a single-user test can be wrong under concurrency on any of them. Check the [PostgreSQL isolation documentation](https://www.postgresql.org/docs/current/transaction-iso.html){:target="_blank" rel="noopener noreferrer"} or your engine's equivalent before relying on a level's behavior.

`SET TRANSACTION ISOLATION LEVEL` looks the same everywhere but has a different scope in each engine. In PostgreSQL it applies to the current transaction only, and the session default is changed with `SET SESSION CHARACTERISTICS`. In MySQL, without the `SESSION` keyword, it applies only to the next transaction. In SQL Server it stays in effect for the connection until changed, which matters with connection pooling, since the next user of that connection inherits it. SQL Server also has two database-wide options: `READ_COMMITTED_SNAPSHOT` changes how Read Committed works, and `ALLOW_SNAPSHOT_ISOLATION` must be on before any transaction can use the Snapshot level.

---

## The Lost Update: Why Read Committed Isn't Enough

Consider two customers buying the last item in stock at the same moment, with application code that reads the stock level, checks it, and writes the new value.

{% include figure.html id="db-lost-update-rc" %}

Under Read Committed, both transactions read `stock = 1`, both pass the check, and both write `stock = 0`. Neither saw an uncommitted value, so Read Committed did exactly what it promises, and two items were sold with one in stock.

At Read Committed there are three standard fixes, and the first is usually best:

- **Make the update atomic and relative.** `UPDATE products SET stock = stock - 1 WHERE id = 7 AND stock > 0` reads and writes in one statement, and the database serializes concurrent updates to the same row. Check the affected row count: zero means it was already sold out. A check constraint `stock >= 0` adds a backstop, since a relative update that would go negative is rejected. It does nothing for code that writes an absolute value like `stock = 0`.
- **Lock the row when reading it.** A locking read makes the second transaction wait until the first commits, and then read the new value.
- **Use optimistic concurrency.** Add a `version` column, and update with `WHERE id = 7 AND version = 12`. If another transaction changed the row first, no row matches, and the application retries or reports a conflict. This suits cases where the read and write happen in separate requests, such as a user editing a form. Under heavy contention on the same row, retries pile up, and a lock becomes cheaper.

Locking reads protect only the code paths that use them. A write path that skips the lock reintroduces the bug, and every lock adds contention and chances for deadlock.

At a snapshot-based level that detects conflicts, such as PostgreSQL's Repeatable Read or SQL Server's Snapshot, the second transaction's update waits for the first to finish and then, if the first committed, fails with a serialization error instead of re-reading. That prevents the lost update too, but the application has to retry.

---

## Write Skew: The Anomaly Snapshots Miss

Write skew is harder to see because the two transactions write different rows. A hospital requires at least one doctor on call. Two doctors on call each request leave at the same time, and each transaction checks "are at least two doctors on call?" before taking its own doctor off call.

{% include figure.html id="db-write-skew" %}

Each write is valid on its own, and no row was updated by both, so snapshot isolation lets both commit, leaving nobody on call. Only true serializable execution prevents write skew in general: PostgreSQL's Serializable, or the lock-based Serializable of SQL Server and MySQL. Oracle's Serializable does not.

Without Serializable, the fix is to make the conflict visible to the database. When the decision depends on rows that exist, a locking read on those rows makes the second transaction wait for the first. When it depends on rows that **don't** exist yet, such as "no other booking overlaps this time slot," PostgreSQL and Oracle have no row to lock. MySQL's InnoDB does lock the scanned range when a locking read runs at Repeatable Read, blocking inserts into it, and SQL Server can lock the range until the transaction ends by reading with `WITH (UPDLOCK, HOLDLOCK)`. Range locks don't always serialize cleanly, though. In InnoDB, two transactions can both lock the same empty gap, and their inserts then deadlock, so one fails and must retry. The portable options are a unique constraint on the slot, a PostgreSQL exclusion constraint that rejects overlapping ranges, or a row created in advance for every slot so the conflict lands on a single row both transactions must update.

---

## Serializable Costs Retries, Not Just Speed

At Serializable, and at snapshot levels that detect conflicts, the database may abort a transaction rather than let an anomaly happen. That's the correct behavior, but it means the application has to catch the error and retry the whole transaction, from its first read. The errors to catch are SQLSTATE `40001` (serialization failure) and `40P01` (deadlock) in PostgreSQL, errors 1205 (deadlock) and 3960 (snapshot update conflict) in SQL Server, error 1213 (deadlock) in MySQL, and `ORA-08177` (can't serialize access) and `ORA-00060` (deadlock) in Oracle. Oracle resolves a deadlock by rolling back only the failed statement, not the whole transaction, so the application has to roll back and retry the transaction itself. Code that uses a strong isolation level without retry logic turns anomalies into user-visible errors instead of preventing them.

---

## Choosing an Isolation Level

Most applications run at their database's default and handle the specific hazards explicitly: atomic updates and constraints for counters and balances, locking reads or optimistic concurrency for read-then-write logic. That works when the team knows where those hazards are.

Serializable is the safer choice when business rules depend on reads across several rows, where write skew is possible and hard to spot, and when the application can retry. The cost is more aborted transactions under contention and some throughput overhead.

Whatever the level, keep transactions short. A transaction that stays open while it calls an external API or waits for user input holds locks or an old snapshot the whole time, and everything else pays for it.

---

## Transactions Across Services

A transaction covers one database. When a business operation spans several services, each with its own database, no single transaction can make it atomic. Two-phase commit coordinates a commit across several participants, but it blocks if the coordinator fails and is rarely used between services. The usual alternative is a saga, a sequence of local transactions with compensating actions to undo completed steps if a later one fails. Sagas give up isolation, so intermediate states are visible to other operations while the saga runs.

---
