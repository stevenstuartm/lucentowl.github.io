---
title: "Azure Cosmos DB for System Architects"
layout: guide
category: Azure
subcategory: Database Services
description: "Architecture patterns, consistency models, partitioning strategies, and multi-model API selection for Azure Cosmos DB, including global distribution and cost optimization."
tags: [cosmos-db, consistency-levels, partition-keys, request-units, change-feed, global-distribution, fundamentals]
---

## What Is Azure Cosmos DB

[Azure Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/introduction){:target="_blank" rel="noopener noreferrer"} is a fully managed, distributed database service that stores data in JSON-like documents (and other formats depending on the API chosen). Unlike traditional relational databases, data in Cosmos DB is schemaless, distributed across regions, and accessed through API models (NoSQL, MongoDB, Cassandra, Gremlin, Table) rather than SQL.

Cosmos DB addresses the problem of building systems that are both globally distributed and highly available. Rather than forcing you to build custom sharding layers, replicate data to multiple regions manually, or choose between consistency and availability, Cosmos DB manages these concerns at the platform level.

### What Problems Cosmos DB Solves

**Without Cosmos DB:**
- Replicating data across regions requires custom code and operational complexity
- Consistency between replicas must be managed manually
- Choosing a single region creates availability and latency concerns
- Scaling to millions of requests per second requires application-level sharding
- Managing failover between data centers is a complex operational burden
- Different applications need different data models but no single platform supports them

**With Cosmos DB:**
- Automatic multi-region replication and failover at the platform level
- Configurable consistency levels allow trading off latency against consistency guarantees
- Single database can serve globally distributed users with low latency from any region
- Throughput scales from hundreds to millions of requests per second transparently
- Application code doesn't need to handle replication, failover, or sharding logic
- Single platform supports multiple data models through different APIs

### How Cosmos DB Differs from AWS DynamoDB

Architects familiar with AWS should note several important differences:

| Aspect | AWS DynamoDB | Azure Cosmos DB |
|--------|--------------|-----------------|
| **Consistency models** | Eventually consistent by default; strongly consistent reads available per request (single-Region only) | Five configurable levels (Strong, Bounded Staleness, Session, Consistent Prefix, Eventual) |
| **Multi-region** | Global Tables (separate management) | Native multi-region built into the database |
| **Global writes** | Supported via global tables; last-writer-wins only | Supported natively; last-writer-wins or custom conflict resolution |
| **APIs supported** | Only key-value and DynamoDB API | NoSQL/Core SQL, MongoDB, Cassandra, Gremlin, Table |
| **Throughput pricing** | Per-table; separate for global tables | Single provisioned throughput across all regions |
| **Query language** | DynamoDB Query/Scan limited | SQL (Core API) with rich relational-like queries |
| **Multi-model** | Key-value only | Documents, key-value, graph, column-family |

---

## Core Concepts

### What Cosmos DB Is, Architecturally

Cosmos DB is a write-optimized, distributed document store. Unlike relational databases that optimize for joins and normalized schemas, Cosmos DB optimizes for:

1. **Fast writes at scale.** Writes are acknowledged to the client after committing to the local region, not after replicating everywhere.
2. **Configurable consistency.** You choose how strongly consistent data needs to be in exchange for throughput and latency.
3. **Schemaless data.** No schema enforcement; documents in the same container can have different structures.
4. **Transparent distribution.** The database handles multi-region replication; applications see a single logical database.
5. **Request-based throughput.** Capacity is measured in Request Units (RUs), not CPU cores or storage.

### Request Units (RUs)

A Request Unit is Cosmos DB's currency for throughput. Every operation (read, write, query) consumes a number of RUs based on the operation's complexity.

**RU consumption examples:**
- A small document read: 1 RU
- A small document write: 5 RUs
- A query scanning 100 documents: 50-200 RUs (depends on filtering and projection)
- A write with complex triggers or stored procedures: 10-50+ RUs

You provision throughput in RUs per second (RU/s). If you provision 1,000 RU/s, the database allows 1,000 RUs of operations per second. Operations exceeding the provisioned throughput are rate-limited (with exponential backoff retries available to clients).

**Provisioned vs serverless vs autoscale:**

| Model | Cost | Best For |
|-------|------|----------|
| **Provisioned** | Per RU/s per hour | Predictable workloads; development/testing |
| **Autoscale** | Per max RU/s provisioned; scales from 10% automatically | Workloads with variable throughput; production workloads with spiky traffic |
| **Serverless** | Per RU consumed (no hourly charge) | Sporadic usage; development; workloads that rarely exceed a few RU/s |

Provisioned throughput is set at one of two scopes (there is no account-level throughput). **Database-level** throughput is shared across every container in that database, which is economical for many small, low-traffic containers. **Container-level** throughput is dedicated to a single container, guaranteeing it its own RU/s. Autoscale automatically scales between 10% and 100% of the max RU/s you specify.

---

## Consistency Levels

Cosmos DB offers five consistency levels that trade off between data freshness and throughput. This is the core architectural lever for application design.

### Strong Consistency

**Guarantee:** All reads return the most recently committed write.

The client never sees stale data. Every read sees the committed state at the time of the request. This is the default consistency of traditional relational databases.

**Trade-offs:**
- Reads must wait for replication to all regions (if multi-region replicas exist) or for local durability confirmation
- Highest latency
- Lowest throughput (fewer concurrent operations can be served)
- Write availability is affected if regions disconnect

**When to use:**
- Financial systems where reading stale data is unacceptable
- Authorization systems where permissions must be checked against the latest state
- Inventory systems where overselling is not acceptable

---

### Bounded Staleness Consistency

**Guarantee:** Reads lag behind writes by a bounded amount. You specify either a time bound (e.g., 5 seconds) or a write count bound (e.g., 100 operations).

A read will return data that is at most the specified amount behind the latest committed write. If replication is caught up, the read is as fresh as strong consistency. If replication is lagging, the read returns data no older than your specified bound.

**Trade-offs:**
- Latency between strong and session consistency
- Throughput between strong and session consistency
- Predictable freshness guarantees (useful for SLAs)

**When to use:**
- Systems requiring freshness guarantees (e.g., stock quotes must be no older than 10 seconds)
- Applications that need freshness without paying the full cost of strong consistency
- Financial dashboards where slightly stale data is acceptable if you know the maximum staleness

---

### Session Consistency

**Guarantee:** Within a session (single client), reads see writes executed by the same client. Across different clients, reads are eventually consistent.

A client sees its own writes immediately. However, another client reading the same data might see stale data until the updates replicate. This matches how traditional web applications often work (client sees updates immediately, other users see them eventually). Session is the **default** consistency level for a new account, and the most widely used, delivering read-your-writes within a client while keeping latency and throughput close to eventual consistency.

**Trade-offs:**
- Lower latency than bounded staleness
- Better throughput than bounded staleness
- Reads are not guaranteed to be fresh for other clients
- No freshness guarantees across clients

**When to use:**
- Web applications where you cache data per user (user sees their updates, other users see eventual consistency)
- Multi-player games where each player sees their own updates immediately
- Content management systems where editors see updates immediately but readers tolerate slight delays

---

### Consistent Prefix Consistency

**Guarantee:** Reads never see writes out of order. If write A happened before write B, reads never see B without seeing A first.

Updates are causally ordered but not necessarily up-to-date. This prevents the strange situation where you read a response to a question before seeing the question itself.

**Trade-offs:**
- Better latency and throughput than session consistency
- Order guarantees but not freshness guarantees
- Useful for applications with causal relationships between writes

**When to use:**
- Conversation threads where responses must appear after the original message
- Database change logs or audit trails where order matters
- Distributed counter implementations where increments must appear in order

---

### Eventual Consistency

**Guarantee:** Reads will eventually reflect all writes, but there are no freshness or ordering guarantees. A read may return stale data indefinitely (in the absence of new writes).

This is the cheapest consistency model in terms of latency and throughput, and the most permissive.

**Trade-offs:**
- Lowest latency
- Highest throughput
- No freshness guarantees
- No ordering guarantees

**When to use:**
- Counters and analytics where approximate values are acceptable
- Page view counts or social media engagement metrics
- Recommendation systems where slightly stale data is acceptable
- Caches where staleness is inherent

---

## Partitioning and Partition Keys

Cosmos DB scales by distributing data across **physical partitions**, the internal storage-and-compute units it manages for you. A **partition key** is the document property whose value determines which *logical* partition a document belongs to. Cosmos DB hashes that value and maps each logical partition onto a physical partition.

- **Logical partition:** every document sharing a partition key value. A single logical partition caps at **20 GB** of storage and **10,000 RU/s**, a hard ceiling you can't provision past, so a key value that attracts unbounded data or traffic eventually wedges.
- **Physical partition:** the internal unit that storage and throughput are actually spread across. Each holds up to **50 GB** and serves up to **10,000 RU/s**, and one physical partition backs one or more logical partitions. Cosmos DB splits physical partitions automatically as data or throughput grows.

```
        partition key value ──hash──▶ logical partition ──map──▶ physical partition

  Even distribution (high-cardinality key)      Hot partition (low-cardinality key)
  30,000 RU/s over 3 physical partitions        30,000 RU/s over 3 physical partitions
  ┌──────────┐┌──────────┐┌──────────┐          ┌──────────┐┌──────────┐┌──────────┐
  │ Phys P0  ││ Phys P1  ││ Phys P2  │          │ Phys P0  ││ Phys P1  ││ Phys P2  │
  │ 10k used ││ 10k used ││ 10k used │          │ 10k CAP  ││   idle   ││   idle   │
  └──────────┘└──────────┘└──────────┘          │ 429s ◀── │└──────────┘└──────────┘
  full 30k RU/s usable                          └──────────┘
                                                only 10k usable; 20k stranded
```

### Choosing a Partition Key

The partition key is the single most important architectural decision, because provisioned throughput divides evenly across physical partitions. A key that funnels most traffic to one partition starves the rest even when the account has spare capacity.

**Good partition keys distribute writes evenly:**

| Scenario | Partition Key | Why It Works |
|----------|---------------|-------------|
| Multi-tenant SaaS | `tenantId` | Each tenant's data goes to a different partition; requests are isolated by tenant |
| Time-series metrics | `deviceId` | Each device's metrics go to the same partition; writes are spread across devices |
| User activity log | `userId` | Each user's activity goes to the same partition; writes are spread across many users |

**Bad partition keys concentrate writes on a few partitions (hot partitions):**

| Scenario | Bad Key | Why It's Bad | Better Choice |
|----------|---------|-------------|----------------|
| User activity log | `isActive` (true/false) | Nearly all writes go to two partitions (true/false); rest of the cluster is idle | `userId` |
| Time-series metrics | `metricType` | All events of a type go to one partition; other partitions stay idle | `deviceId` + `metricType` |
| Blog posts | `isPublished` | All published posts concentrated on one partition | `authorId` or `blogId` |
| Orders | `status` (pending/completed) | Most writes concentrate on pending; completed orders don't scale | `customerId` or `orderId` |

Hot partitions are the most common Cosmos DB performance issue. Requests hitting a partition exceeding its 10,000 RU/s limit are rate-limited, causing client backoff and poor latency even if the database has unused capacity.

### Hierarchical Partition Keys

[Hierarchical partition keys](https://learn.microsoft.com/en-us/azure/cosmos-db/hierarchical-partition-keys){:target="_blank" rel="noopener noreferrer"} allow you to specify multiple levels of partitioning, improving distribution for scenarios where a single key creates hot partitions.

With hierarchical keys, you specify a path like `/tenantId/userId`. This creates a two-level hierarchy: first partition by tenant, then by user within each tenant. This approach provides better isolation and allows different throughput management at each level.

---

## Multi-Model APIs

Cosmos DB supports multiple APIs, each optimized for different access patterns and migration scenarios. The API you choose affects the query language, consistency options, and default indexing.

### Core API (NoSQL)

The Core API stores and queries data using JSON documents with a SQL-like query language.

**Use Core API when:**
- Building new applications that need flexible queries
- Migrating from other document databases
- Needing rich SQL-like queries with joins
- Working with hierarchical or nested documents

**Advantages:**
- Rich SQL query language similar to relational databases
- Full indexing flexibility
- Best analytics and reporting capabilities
- Native JSON support

---

### MongoDB API

[MongoDB API](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/mongodb-introduction){:target="_blank" rel="noopener noreferrer"} provides MongoDB wire-protocol compatibility, allowing applications written for MongoDB to connect with minimal code changes.

**Use MongoDB API when:**
- Migrating from MongoDB to Azure
- Team expertise is in MongoDB
- Existing MongoDB clients/drivers are used

**Advantages:**
- MongoDB driver compatibility
- Smooth migration path from MongoDB
- Team familiarity if using MongoDB in other projects

**Limitations:**
- Smaller feature set than MongoDB (some MongoDB features not supported)
- Slightly different consistency semantics
- Less rich querying than Core API

---

### Cassandra API

[Cassandra API](https://learn.microsoft.com/en-us/azure/cosmos-db/cassandra/cassandra-introduction){:target="_blank" rel="noopener noreferrer"} provides Apache Cassandra wire-protocol compatibility for applications using Cassandra drivers.

**Use Cassandra API when:**
- Migrating from Apache Cassandra
- High-volume write scenarios where Cassandra excels
- Team has Cassandra expertise

**Advantages:**
- Cassandra driver compatibility
- Wide-column model good for time-series data
- Designed for extremely high write throughput

---

### Gremlin API

[Gremlin API](https://learn.microsoft.com/en-us/azure/cosmos-db/gremlin/graph-introduction){:target="_blank" rel="noopener noreferrer"} supports graph queries using Apache Tinkerpop's Gremlin language for traversing relationships.

**Use Gremlin API when:**
- Data has complex relationships (social networks, knowledge graphs)
- Queries involve traversing relationships (shortest path, recommendations)
- Building recommendation engines

**Advantages:**
- Native graph traversal queries
- Efficient relationship queries
- Good for knowledge graphs and social networks

---

### Table API

Table API provides a key-value store compatible with Azure Table Storage and AWS DynamoDB.

**Use Table API when:**
- Migrating from Azure Table Storage
- Legacy DynamoDB-compatible code
- Simple key-value access patterns

**Advantages:**
- Compatibility with existing Table Storage code
- Simple key-value model

**Limitations:**
- Most limited querying (no joins, no complex filters)
- Least flexible of the APIs

---

### Choosing an API

The API choice is driven mostly by migration source. Pick the NoSQL (Core) API for anything greenfield, since it receives new Cosmos DB features first and best. The compatibility APIs exist primarily to preserve existing drivers and skills during a migration, not to enable new development.

```
Migrating from an existing datastore?
├─ From MongoDB ──────────────────▶ MongoDB API
├─ From Apache Cassandra ─────────▶ Cassandra API
├─ From Azure Table Storage ─────▶ Table API
└─ No / greenfield
   ├─ Graph traversals (relationships, shortest path)? ─▶ Gremlin API
   └─ Everything else (rich queries, new app) ─────────▶ NoSQL (Core) API  ◀ default
```

---

## Global Distribution

Cosmos DB automatically replicates data to multiple regions you specify. You configure which regions hold replicas, and Cosmos DB manages replication automatically.

### Single-Region Writes vs Multi-Region Writes

**Single-Region Writes (more common):**
- One region is designated as the write region
- All writes go to the write region; reads can use any region
- Other regions are read-only replicas
- Reduces write complexity and consistency concerns
- Failover to another write region is possible but requires configuration

**Multi-Region Writes:**
- Any region can accept writes
- Cosmos DB merges writes from different regions automatically
- Requires conflict resolution policies
- More complex but eliminates write-region bottleneck
- Useful for globally distributed teams that need local write latency

**Conflict resolution policies (for multi-region writes):**
- **Last Write Wins:** Latest timestamp wins; earlier writes are discarded
- **Custom Procedure:** Application-defined JavaScript function determines which version persists
- **Custom Async:** Application code outside Cosmos DB resolves conflicts asynchronously

---

## Change Feed

The [Change Feed](https://learn.microsoft.com/en-us/azure/cosmos-db/change-feed){:target="_blank" rel="noopener noreferrer"} is a persistent, ordered record of changes applied to documents in a container. Applications subscribe to it to react to changes. In its default **latest-version** mode the feed surfaces inserts and updates only. A deleted item simply disappears from the feed, with no delete event. Capturing deletes (along with intermediate versions and TTL expirations) requires **all-versions-and-deletes** mode, which depends on continuous backup being enabled on the account.

**Use cases:**
- Event-driven architectures: Subscribe to changes and trigger downstream processes
- Cache invalidation: Update caches when source documents change
- Search index updates: Keep Elasticsearch or other search indices in sync with Cosmos DB
- Audit logging: Capture all changes for compliance
- Notifications: Notify users when data they follow changes

**Change feed patterns:**
- **Push model:** Cosmos DB change feed processor automatically pushes changes to your code
- **Pull model:** Application explicitly reads from a checkpoint and processes changes
- **Azure Functions trigger:** Automatically invoke a function when documents change

---

## Integrated Cache

The [Integrated Cache](https://learn.microsoft.com/en-us/azure/cosmos-db/integrated-cache){:target="_blank" rel="noopener noreferrer"} is an in-memory, **server-side** cache that drives the RU cost of repeated reads to zero. It is not a client-side or automatic feature. It lives on a **dedicated gateway** (a separately provisioned, separately billed set of gateway nodes), and only requests that connect through the dedicated gateway connection string in **gateway mode** use it.

**How the cache works:**
- It has two parts: an *item cache* for point reads and a *query cache* keyed on query text.
- The cache is hosted on the dedicated gateway nodes and is **shared across all clients** routed through a given node, not per client. Each node keeps an independent cache, so a hit on one node isn't necessarily a hit on another.
- A cache hit costs **0 RUs**; the first read of an item (or a cache miss) pays normal RUs and populates the cache.
- Only **session** and **eventual** consistency reads can be served from the cache. Strong, bounded-staleness, and consistent-prefix reads bypass it and always hit the backend.
- Freshness is governed by `MaxIntegratedCacheStaleness` (default **5 minutes**). A cached entry older than this bound is re-read from the backend. The item cache also refreshes on updates routed through the same node, but query-cache results don't reflect underlying writes until the staleness window elapses.

Because the dedicated gateway is billed per node-hour regardless of hit rate, the integrated cache pays off only for genuinely read-heavy, repeat-read workloads. It's a cost-reduction lever, not a latency trick (Cosmos DB is already low-latency without it).

---

## Backup and Restore

Every Cosmos DB account is backed up automatically. There is no "backups disabled" state. Two modes exist, and the choice determines how fast and how independently you can recover.

| | Periodic (default) | Continuous (point-in-time restore) |
|---|---|---|
| **Restore granularity** | Latest snapshots only | Any second within the retention window |
| **Retention** | Configurable, up to 30 days | 7-day tier or 30-day tier |
| **How to restore** | Open a support request | Self-service (portal / CLI / PowerShell) |
| **Cost** | Two copies free; extra copies billed | 7-day tier free; 30-day tier billed |

Periodic mode takes a full backup every 4 hours and keeps the latest two by default; a restore always lands in a **new** account and goes through support, so periodic mode is a safety net rather than an operational recovery tool.

Continuous backup enables self-service point-in-time restore and is also the prerequisite for the change feed's all-versions-and-deletes mode. You can migrate an account from periodic to continuous, but not back. A restore can't target an account with fewer partitions or lower throughput than the source, and TTL-expired documents, stored procedures, RBAC assignments, and analytical-store data aren't restored.

---

## DocumentDB Comparison

[Amazon DocumentDB](https://aws.amazon.com/documentdb/){:target="_blank" rel="noopener noreferrer"} is AWS's MongoDB-compatible database. Architects comparing the two should understand these differences:

| Aspect | Cosmos DB | DocumentDB |
|--------|-----------|-----------|
| **Multi-region** | Native multi-region built-in | Regional, requires read replicas |
| **Global writes** | Supported | Not supported; single write region |
| **Consistency levels** | Five configurable levels | MongoDB consistency only |
| **APIs** | Core SQL, MongoDB, Cassandra, Gremlin, Table | MongoDB only |
| **Throughput model** | Request Units (RU/s) | Instance-based (vCPU) |
| **Scaling** | Transparent; configure RU/s | Manual scaling; instance changes |

DocumentDB is MongoDB-compatible but lacks Cosmos DB's flexibility around consistency models, multi-model support, and global write capabilities.

---

## Architectural Patterns

### Pattern 1: Single-Region, Single-API Application

**Use case:** New application with users in a single region, using Core API.

**Architecture:**
- Single Cosmos DB account in one region
- Core API for JSON documents
- Session consistency for web application behavior
- Autoscale provisioning (10%-100% of max RU/s)

**Components:**
- Single region reduces data transfer costs and latency concerns
- Core API provides rich querying
- Session consistency matches typical web app user experience (user sees their updates, others see eventual consistency)
- Autoscale handles traffic spikes without manual intervention

**Trade-offs:**
- No geographic redundancy (region failure causes outage)
- No multi-region read latency optimization
- Suitable for applications serving a single geographic area

---

### Pattern 2: Multi-Region Global Application

**Use case:** Application serving users globally with read-heavy workloads.

**Architecture:**
```
Write Region (East US)
   ↓
   Cosmos DB Container
   ↓
Replicate to →  Read Region 1 (Europe West)
             →  Read Region 2 (Asia Southeast)
             →  Read Region 3 (Australia East)
```

**Components:**
- Primary write region where all writes occur
- Read replicas in regions near users for local read latency
- Configured multi-region failover (if primary fails, secondary becomes write region)
- Strong or bounded staleness consistency for read-freshness guarantees
- Private endpoints in each region for network isolation

**Trade-offs:**
- Cross-region replication latency (eventual consistency for remote replicas)
- Higher cost (provisioned throughput applies to all regions)
- Suitable for read-heavy applications where write latency is local and read latency must be global

---

### Pattern 3: Multi-Region Writes with Conflict Resolution

**Use case:** Globally distributed system where different regions need to accept writes independently.

**Architecture:**
```
Region 1 (East US)     Region 2 (Europe West)     Region 3 (Asia Southeast)
   Accept writes       →   Cosmos DB Replication   ←   Accept writes
   ↓                          ↓ Merge conflicts       ↓
   App                   using last-write-wins      App
```

**Components:**
- All regions configured as write regions
- Automatic conflict resolution (last-write-wins or custom procedure)
- Multi-region writes enabled
- Higher provisioned throughput (each region's writes count separately)

**Trade-offs:**
- Conflict resolution adds complexity (which version wins?)
- Higher cost (write throughput needed in every region)
- Lost updates possible depending on conflict resolution strategy
- Useful only when write-region latency is critical problem

---

### Pattern 4: Event-Driven Architecture with Change Feed

**Use case:** Data changes in Cosmos DB trigger downstream processes.

**Architecture:**
```
Cosmos DB Container (Orders)
   ↓ Change Feed
   Document inserted/updated
   ↓
Change Feed Processor
   ↓
Event Handler (Azure Function / Custom App)
   ↓
Downstream Systems (Elasticsearch, Cache, Email Service, etc.)
```

**Components:**
- Cosmos DB as the system of record
- Change feed processor (managed by Azure Functions or custom code) subscribes to changes
- Event handlers react to changes and update downstream systems
- Guarantees at-least-once delivery (handlers must be idempotent)

**Trade-offs:**
- Handlers must be idempotent (same event processed multiple times must be safe)
- Change feed ordering is guaranteed within a partition, not globally
- Eventual consistency in downstream systems (lag between source and derived data)
- Decouples Cosmos DB from downstream services (changes trigger workflows independently)

---

## Common Pitfalls

### Pitfall 1: Hot Partition from Poor Partition Key

**Problem:** Choosing a partition key that concentrates writes on a small number of partitions (e.g., `status` field with only two values).

**Result:** Rate limiting on hot partitions while other partitions stay idle. Requests hitting the hot partition are rate-limited and fail with 429 errors. The database appears throughput-constrained even with low overall RU utilization.

**Solution:** Choose partition keys with high cardinality (many distinct values) that distribute writes evenly. Use hierarchical partition keys if a single key creates hotness. Monitor partition usage with Azure Monitor metrics to detect hot partitions early.

---

### Pitfall 2: Forgetting Consistency Model Impact

**Problem:** Using strong consistency everywhere, paying the latency and throughput cost of waiting for global replication.

**Result:** Unnecessary latency on reads that don't need freshness guarantees. Reduced throughput because fewer concurrent operations can complete while waiting for replication.

**Solution:** Use strong consistency only where required (authorization, critical updates). Use session consistency for typical application reads (user sees their updates, others see eventual consistency). Use eventual consistency for analytics and non-critical data.

---

### Pitfall 3: Underestimating RU Consumption for Complex Queries

**Problem:** Assuming simple reads cost 1 RU, writing queries that scan entire containers without proper filtering.

**Result:** Queries cost far more RUs than expected. Autoscale provisions much higher than anticipated. Bills spike unexpectedly.

**Solution:** Test queries in development environment to understand RU consumption. Use query metrics in the Azure portal to see estimated and actual RU cost. Use composite indexes for common filter/order combinations. Avoid unbounded scans.

---

### Pitfall 4: Not Understanding Multi-Region Write Costs

**Problem:** Enabling multi-region writes assuming similar costs to single-region setup.

**Result:** Provisioned throughput is reserved in *every* region you add. A 10,000 RU/s container across three regions bills 30,000 RU/s, whether those regions are read replicas or write regions. Multi-region writes stack a second cost on top, because writable regions bill at a higher per-RU rate than a single-write-region account. So switching "one write region plus two read replicas" to "three write regions" raises the bill even though the region count is unchanged.

**Solution:** Multi-region writes are expensive. Use only if write-region latency is truly critical. For most applications, single write region + read replicas provides better cost/benefit.

---

### Pitfall 5: Ignoring Partition Throughput Limits

**Problem:** Provisioning 100,000 RU/s but not realizing throughput is distributed across partitions, each capped at 10,000 RU/s.

**Result:** If all requests target one partition, that partition's 10,000 RU/s limit is hit first, rate-limiting requests even though 90,000 RU/s of database capacity is unused.

**Solution:** Partition key distribution matters as much as provisioned throughput. Ensure partition keys distribute evenly. Monitor partition metrics to detect hot partitions. Each physical partition can handle 10,000 RU/s; distributing to 10 partitions allows 100,000 RU/s across diverse partition keys.

---

### Pitfall 6: Change Feed Handlers Not Idempotent

**Problem:** Change feed handlers that fail if the same change is processed twice.

**Result:** If a handler crashes mid-processing, the change feed processor restarts and replays the change. Non-idempotent handlers duplicate work or corrupt state.

**Solution:** Change feed guarantees at-least-once delivery, not exactly-once. All handlers must be idempotent: processing the same change multiple times produces the same result as processing it once. Use idempotency keys or check for duplicates before applying changes.

---

## Key Takeaways

1. **Cosmos DB differs significantly from relational databases.** It's a globally distributed, schema-free document store designed for scale. Understanding the distributed nature and eventual consistency implications is critical to using it effectively.

2. **Partition key selection is the most important architectural decision.** A good partition key distributes writes evenly across physical partitions. A bad one creates hot partitions that limit throughput. This cannot be changed after container creation without migration.

3. **Consistency levels are the primary architectural lever.** Five levels allow trading latency against freshness. Most applications should use session consistency for typical reads and strong consistency only where required.

4. **Request Units (RUs) are the throughput currency.** Every operation consumes RUs based on complexity. Understanding RU consumption for your queries drives capacity planning and cost management.

5. **Autoscale is usually better than provisioned for variable workloads.** It automatically scales from 10% to 100% of max RU/s, handling spikes without manual intervention. Provisioned throughput is better for predictable, steady workloads.

6. **Multi-region replication is transparent but not free.** Replicating to additional regions increases costs and introduces replication latency. Use read replicas for scale, but understand the cost implications.

7. **Multi-region writes are powerful but expensive.** Any region can write, and Cosmos DB merges conflicts automatically. This eliminates write-region bottlenecks but costs more and requires careful conflict resolution.

8. **The change feed enables event-driven architectures.** Subscribe to document changes to trigger workflows, cache invalidation, or search index updates. Handlers must be idempotent because change feed guarantees at-least-once delivery.

9. **Choose the right API for your access patterns.** Core API for new applications with rich queries, MongoDB API for migrations, Cassandra API for time-series workloads, Gremlin for graphs. The API determines query language, indexing, and consistency options.

10. **Monitor and optimize partition key distribution continuously.** Hot partitions are the most common performance issue. Use Azure Monitor metrics to identify skew and consider hierarchical partition keys if distribution is uneven.
