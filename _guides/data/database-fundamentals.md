---
layout: guide
title: "Database Fundamentals"
category: Databases
subcategory: Database Fundamentals
description: "Core database concepts including the CAP theorem, ACID vs BASE consistency models, data modeling, and database selection criteria."
tags: [databases, fundamentals, cap-theorem, acid, data-modeling, architecture]
redirect_from:
  - /study-guides/database-types.html
---

## Why Databases Exist

Applications need to persist data beyond the lifetime of a single process. They need to share data across multiple processes, servers, and users. They need to query data in flexible ways, ensure data isn't lost during failures, and prevent concurrent modifications from corrupting state.

A database is software that solves these problems. It provides durable storage (data survives crashes), concurrent access (multiple users can read and write safely), query capabilities (find data matching specific criteria), and often transactions (group multiple operations into atomic units).

Without databases, applications would need to implement all of these features themselves, and they'd do it poorly. Databases represent decades of engineering effort to solve these problems correctly.

---

## Why So Many Database Types Exist

For decades, relational databases were the default choice for nearly every application. They worked well enough for most use cases, but "well enough" started breaking down as applications scaled and data patterns diversified.

Relational databases make certain trade-offs: they enforce schemas, maintain ACID transactions, and optimize for complex queries across related tables. These trade-offs work beautifully for some workloads and terribly for others.

Consider write throughput. A relational database must maintain indexes, enforce constraints, and coordinate transactions. Every write involves multiple disk operations. For an e-commerce order system processing hundreds of transactions per second, this overhead is negligible. For a telemetry system ingesting millions of sensor readings per second, it's a bottleneck.

Or consider data structure. Relational databases force data into rows with fixed columns. A user profile with varying attributes requires either nullable columns (wasting space and complicating queries) or multiple tables with joins (adding complexity and latency). Some users have phone numbers while others don't; some have multiple addresses while others have none.

Specialized databases emerged because different problems have different optimal solutions. The database that excels at finding the shortest path between two nodes in a social graph is architecturally incapable of efficiently aggregating time-series metrics.

---

## The CAP Theorem

Every distributed database confronts an impossible choice. The CAP theorem, proven mathematically in 2002, states that a distributed system can provide at most two of three guarantees:

**Consistency** means every read returns the most recent write. If you update your profile, everyone immediately sees the update.

**Availability** means every request receives a response. The system never refuses to answer.

**Partition tolerance** means the system continues operating when network failures prevent some nodes from communicating with others.

Networks fail and partitions happen, so every distributed database must choose partition tolerance, leaving a choice between consistency and availability during failures.

### CP Systems (Consistency + Partition Tolerance)

These systems choose consistency over availability. During a network partition, they'll refuse to serve requests rather than risk returning stale data.

Examples include traditional relational databases, etcd, ZooKeeper, and HBase.

**Trade-off**: During network issues, some requests will fail. Better for financial systems where stale data causes real problems.

### AP Systems (Availability + Partition Tolerance)

These systems choose availability over consistency. During a network partition, they'll continue serving requests but may return stale data.

Examples include Cassandra, DynamoDB, CouchDB, and most eventually consistent systems.

**Trade-off**: Reads might return outdated data. Better for systems where availability matters more than perfect accuracy (social media feeds, product catalogs).

### Understanding the Practical Implications

CAP doesn't mean you have exactly two properties all the time. During normal operation, when no partitions exist, you can have all three. The theorem constrains behavior during failures.

Modern databases often let you tune this trade-off per operation. Cassandra lets you specify consistency levels: write to one node (fast, less durable), write to a quorum (slower, more durable), or write to all nodes (slowest, most durable).

---

## ACID Properties

ACID defines the guarantees that traditional relational databases provide for transactions. Each letter represents a specific guarantee:

### Atomicity

A transaction is an atomic unit of work. All operations within a transaction either complete successfully or have no effect. There's no partial state.

If you transfer $100 from account A to account B, atomicity guarantees that either both the debit from A and credit to B happen, or neither happens. You won't end up with money debited but not credited.

### Consistency

The database moves from one valid state to another valid state. Constraints like foreign keys, unique constraints, and check constraints are always enforced.

If you have a constraint that account balances must be non-negative, the database will reject any transaction that would violate this constraint, even if atomicity would technically allow it.

### Isolation

Concurrent transactions don't interfere with each other. Each transaction behaves as if it's the only one running, even when thousands run simultaneously.

Isolation levels control how much transactions can see of each other's uncommitted changes:
- **Read Uncommitted**: Can see uncommitted changes (dirty reads)
- **Read Committed**: Only sees committed changes
- **Repeatable Read**: Same rows return same values throughout transaction
- **Serializable**: Transactions appear to run one at a time

Higher isolation levels provide stronger guarantees but reduce concurrency.

### Durability

Once a transaction commits, the changes survive any subsequent failure including power loss, crashes, and hardware failures. The database uses write-ahead logging to ensure committed data can be recovered.

### The Cost of ACID

ACID guarantees aren't free. They require:
- Locking or multi-version concurrency control for isolation
- Write-ahead logging for durability
- Constraint checking for consistency
- Coordination for distributed transactions

This overhead limits throughput and adds latency. Many NoSQL databases trade ACID guarantees for performance.

---

## BASE: The Alternative to ACID

BASE describes the properties of many distributed NoSQL systems. It stands for:

**Basically Available**: The system guarantees availability (in the CAP sense). Requests receive responses, though responses may be stale.

**Soft state**: The system's state may change over time even without input, as updates propagate through replicas.

**Eventual consistency**: Given enough time without new updates, all replicas will converge to the same state. Reads will eventually return the most recent write.

### ACID vs BASE

| Property | ACID | BASE |
|----------|------|------|
| Consistency | Strong, immediate | Eventual |
| Availability during failures | May be unavailable | Highly available |
| Latency | Higher (coordination overhead) | Lower |
| Complexity | Simpler for developers | Requires handling stale data |
| Use cases | Financial, healthcare, inventory | Social, content, analytics |

### When BASE Is Acceptable

Eventual consistency works when:
- Stale reads have low cost (showing a slightly outdated follower count)
- The application can handle or hide inconsistency (UI optimistic updates)
- Availability matters more than accuracy (better to show old data than nothing)

Eventual consistency fails when:
- Decisions based on reads affect real resources (inventory, money)
- Users directly compare values across requests (two users seeing different prices)
- Regulatory requirements mandate consistency

---

## Data Modeling Fundamentals

### Normalization

Normalization organizes relational data to reduce redundancy. Instead of storing a customer's address with every order, you store it once in a customers table and reference it by ID.

**Benefits**:
- Updates happen in one place
- Less storage waste
- Consistent data

**Costs**:
- Joins required to reassemble data
- More complex queries
- Potential performance overhead

**Normal forms** (1NF through 5NF) define increasing levels of normalization. Most applications use third normal form (3NF) as a practical balance.

### Denormalization

Denormalization intentionally introduces redundancy for read performance. Store the customer's name directly in the order record so you don't need to join.

**When to denormalize**:
- Read-heavy workloads with known access patterns
- Performance requirements that joins can't meet
- Distributed systems where joins are expensive or impossible

**Costs**:
- Updates must happen in multiple places
- Risk of inconsistent data
- More storage required

### Schema-on-Write vs Schema-on-Read

**Schema-on-write** (relational databases): Define the schema before inserting data. The database enforces structure.

**Schema-on-read** (document databases, data lakes): Store data without enforcing structure. The application interprets structure when reading.

Schema-on-write catches errors early but requires migrations. Schema-on-read provides flexibility but can lead to data quality issues.

---

## Database Selection Framework

### Start With Access Patterns

Database selection should flow from access patterns, not the other way around. Ask:

- **How will data be written?** High-volume streams? Transactional batches? User-driven updates?
- **How will data be read?** By primary key? By arbitrary attributes? By time range? By relationship traversal?
- **What are the consistency requirements?** Financial accuracy? Eventual consistency acceptable?
- **What's the expected scale?** Hundreds of gigabytes? Petabytes? Millions of reads per second?

### Decision Matrix

| Primary Access Pattern | Database Category |
|------------------------|-------------------|
| Transactions across related entities | Relational or NewSQL |
| Simple key-based lookups at massive scale | Key-Value |
| Flexible documents with varied schemas | Document |
| Time-range queries on metrics/events | Time-Series |
| Relationship traversal (friends-of-friends) | Graph |
| Semantic similarity search | Vector |
| Full-text search with relevance ranking | Search Engine |
| Sub-millisecond caching | In-Memory |
| Massive write throughput, sparse columns | Wide-Column |

### The PostgreSQL Default

**Start with relational unless you have a specific reason not to.** PostgreSQL handles more use cases than most teams realize:
- JSON columns provide document flexibility
- The pgvector extension enables vector search
- Full-text search is built in
- Extensions like TimescaleDB add time-series capabilities

If you're not sure what you need, PostgreSQL is the safe default. You can always add specialized databases later when specific needs emerge.

### Operational Considerations

A database you can operate well beats a theoretically superior database you operate poorly. Consider:

- **Team expertise**: Do you have experience with this technology?
- **Managed services**: Is a managed option available to reduce operational burden?
- **Tooling**: Are there good backup, monitoring, and debugging tools?
- **Community**: Can you find help when things go wrong?

---

## Polyglot Persistence

Most non-trivial applications use multiple databases, each optimized for its specific use case. This pattern is called polyglot persistence.

### Common Combinations

**Web application**: PostgreSQL (primary data) + Redis (sessions, caching) + Elasticsearch (search)

**IoT platform**: TimescaleDB (metrics) + PostgreSQL (device metadata) + Redis (real-time state)

**E-commerce**: PostgreSQL (orders, customers) + Elasticsearch (product search) + Redis (cart, sessions)

**AI application**: PostgreSQL (application data) + Pinecone or pgvector (embeddings) + Redis (caching)

**Social platform**: PostgreSQL (user data) + Neo4j (social graph) + Redis (feeds, caching)

### Managing Data Synchronization

The challenge with polyglot persistence is keeping data synchronized across systems. Common approaches:

**Change data capture (CDC)**: Capture changes from the primary database and apply them to secondary systems. Tools like Debezium stream changes from database transaction logs.

**Dual writes**: Write to multiple systems from the application. Simple but risks inconsistency if one write fails.

**Event sourcing**: Use an event log as the source of truth. Each database builds its view from events.

**Scheduled sync**: Periodically copy data from primary to secondary systems. Simple but introduces latency.

---

## Migration Considerations

### Don't Migrate Prematurely

The operational cost of running a second database type often exceeds the performance benefit until you've truly hit limits. PostgreSQL can handle more than most teams expect.

Signs you might actually need a specialized database:
- You've optimized queries and still can't meet requirements
- You're spending significant effort working around the current database's limitations
- The access pattern clearly doesn't match the database model

### Consider Hybrid Approaches First

Before a full migration, consider:
- PostgreSQL with TimescaleDB extension for time-series
- PostgreSQL with pgvector for vector search
- Redis alongside PostgreSQL for caching
- Elasticsearch alongside PostgreSQL for search

These hybrid approaches often provide 80% of the benefit with 20% of the migration effort.

### Migration Is Never Just Moving Data

When you do migrate, budget for more than data transfer. Query patterns differ between database types:
- Application code that worked with implicit joins needs restructuring for document databases
- Code that relied on transactions needs compensation logic for eventually consistent stores
- ORMs may not support the new database, requiring significant code changes

Plan for:
- Schema redesign for the new data model
- Application code changes
- Testing for behavioral differences
- Rollback strategy if issues emerge

---
