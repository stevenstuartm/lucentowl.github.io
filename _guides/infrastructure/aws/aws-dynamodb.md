---
title: "AWS DynamoDB for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "Comprehensive guide to AWS DynamoDB covering partition key design, capacity modes, indexes, single-table design, DynamoDB Streams, cost optimization, and when to use NoSQL vs relational databases"
tags: [aws, dynamodb, nosql, partition-key, gsi, capacity-modes, cost-optimization, fundamentals]
---

## What Is Amazon DynamoDB?

Amazon DynamoDB is a fully managed, serverless NoSQL database service that delivers single-digit millisecond performance at any scale. DynamoDB automatically scales throughput capacity up or down and handles operational tasks like hardware provisioning, patching, and replication.

**What Problems DynamoDB Solves**:
- **Scalability bottlenecks**: Relational databases struggle to scale beyond vertical limits; DynamoDB scales horizontally to handle millions of requests per second
- **Operational overhead**: Eliminates database administration tasks (no servers to manage, patch, or upgrade)
- **Performance at scale**: Provides consistent single-digit millisecond latency even at petabyte scale
- **Unpredictable workloads**: On-demand capacity mode auto-scales without manual intervention
- **Global availability**: Multi-Region replication with Global Tables for low-latency global access

**When to use DynamoDB**:
- You need horizontal scalability beyond what RDS can handle
- Your access patterns are known and can be modeled with partition/sort keys
- You require single-digit millisecond latency at scale
- You have unpredictable traffic spikes (on-demand mode)
- You need serverless architecture with zero operational overhead

## Core Concepts

### Tables, Items, and Attributes

DynamoDB organizes data into **tables**. Each table contains **items** (similar to rows) composed of **attributes** (similar to columns).

**Schemaless Design**: Unlike relational databases, DynamoDB is schemaless. Items in the same table can have different attributes (except for the required partition key and optional sort key).

**Example**:
```
Table: ProductCatalog

Item 1:
- ProductID: "ABC123" (partition key)
- Name: "Laptop"
- Price: 1200
- Category: "Electronics"

Item 2:
- ProductID: "DEF456" (partition key)
- Name: "Desk"
- Material: "Wood"  (different attribute from Item 1)
- Dimensions: "60x30x29"
```

### Primary Keys

Every DynamoDB table requires a **primary key** that uniquely identifies each item.

**Two Types**:

1. **Partition Key** (Simple Primary Key):
   - Single attribute (e.g., `UserID`)
   - DynamoDB uses the partition key value as input to an internal hash function to determine the physical partition where the item is stored
   - Must be unique for each item

2. **Partition Key + Sort Key** (Composite Primary Key):
   - Two attributes (e.g., `UserID` + `Timestamp`)
   - Items with the same partition key are stored together, sorted by sort key value
   - Partition key does not need to be unique, but the combination of partition key + sort key must be unique

**Example**:
```
Table: Orders (Partition Key: CustomerID, Sort Key: OrderDate)

Item 1: CustomerID="C123", OrderDate="2024-01-15", OrderTotal=250
Item 2: CustomerID="C123", OrderDate="2024-02-20", OrderTotal=180
Item 3: CustomerID="C456", OrderDate="2024-01-10", OrderTotal=320

Query: Get all orders for Customer C123 → Returns Items 1 and 2, sorted by OrderDate
```

### Partition Key Design Best Practices

<div class="callout callout--warning">
<p class="callout__title">The Most Critical Decision</p>
<p>Partition key design determines performance, scalability, and cost. Each partition supports up to 3,000 RCUs and 1,000 WCUs. Hot partitions cause throttling regardless of total table capacity.</p>
</div>

**Design for Uniform Distribution**:
- Avoid "hot partitions" where a few partition keys receive disproportionate traffic
- Each partition supports up to 3,000 read capacity units (RCU) and 1,000 write capacity units (WCU)
- ❌ Bad: `Status` field with only "Active" or "Inactive" (creates 2 hot partitions)
- ✅ Good: `UserID` with millions of unique values (distributes load evenly)

**Avoid Time-Based Partition Keys**:
- ❌ Bad: `Date` as partition key (today's date gets all writes, creating a hot partition)
- ✅ Better: `UserID` as partition key, `Timestamp` as sort key

**Use Write Sharding for High-Write Scenarios**:
- If a partition key receives too many writes (>1,000 WCUs), shard it
- Add a random suffix: `CustomerID="C123#1"`, `CustomerID="C123#2"`, `CustomerID="C123#3"`
- Distribute writes across multiple partitions, then aggregate on read

**Partition Capacity Limits**:
- Maximum 3,000 RCUs per partition
- Maximum 1,000 WCUs per partition
- Maximum 10 GB per partition key value

## Secondary Indexes

Secondary indexes enable queries on attributes other than the primary key.

### Global Secondary Indexes (GSI)

A GSI has a partition key and optional sort key that can be **different from the base table**.

**Key Characteristics**:
- Can be created or deleted at any time (even after table creation)
- Has its own provisioned throughput (separate from base table)
- No size limit per partition key value
- Eventually consistent reads only (not strongly consistent)
- Up to 20 GSIs per table

**Use Cases**:
- Query by different attributes: Base table uses `UserID`, GSI uses `Email` for login queries
- Support multiple access patterns without duplicating data

**Cost Considerations**:
- Writing to base table writes to all GSIs with that attribute (multiplicative cost)
- Updating an indexed attribute requires 2 writes: delete old index entry + add new entry
- GSI storage is billed separately ($0.25/GB/month standard class)

**Example**:
```
Base Table: Users (Partition Key: UserID)
- UserID, Email, Name, CreatedDate

GSI: EmailIndex (Partition Key: Email)
- Enables query: "Find user by email"
```

### Local Secondary Indexes (LSI)

An LSI has the **same partition key as the base table** but a **different sort key**.

**Key Characteristics**:
- Must be created at table creation time (cannot add later)
- Shares provisioned throughput with base table
- Maximum 10 GB per partition key value (combined base table + all LSIs)
- Supports strongly consistent reads
- Up to 5 LSIs per table

**Use Cases**:
- Alternative sort orders for items with the same partition key
- Example: Base table sorts orders by `OrderDate`, LSI sorts by `TotalAmount`

**When to Use LSI vs GSI**:

| Dimension | LSI | GSI |
|-----------|-----|-----|
| **Partition Key** | Same as base table | Different from base table |
| **When Created** | At table creation only | Anytime |
| **Throughput** | Shares with base table | Separate provisioned throughput |
| **Size Limit** | 10 GB per partition | Unlimited |
| **Consistency** | Strongly consistent available | Eventually consistent only |
| **Use Case** | Alternative sort order | Query different attributes |

**Best Practice**: Prefer GSIs over LSIs in most cases for flexibility (can be added/removed anytime).

### Index Projection

**Projection** determines which attributes are copied from the base table to the index.

**Three Options**:

1. **KEYS_ONLY**: Only partition key, sort key, and index keys
   - Smallest index size, lowest cost
   - Requires additional read to base table for other attributes

2. **INCLUDE**: Keys + specified attributes
   - Balance between size and query efficiency
   - Use when you frequently query a specific subset of attributes

3. **ALL**: All attributes
   - Largest index size, highest cost
   - Fastest queries (no additional reads needed)

**Cost Optimization**: Only project attributes you actually query. Updating projected attributes incurs write costs to the index.

## Capacity Modes

DynamoDB offers two capacity modes: **On-Demand** and **Provisioned**.

### On-Demand Capacity Mode

Pay-per-request pricing with automatic scaling.

**How It Works**:
- No capacity planning required
- Scales instantly to handle traffic spikes
- Billed per read request unit (RRU) and write request unit (WRU)
- Default and recommended mode for most workloads

**Pricing (us-east-1, 2024)**:
- **Writes**: $1.25 per million WRUs
- **Reads** (eventually consistent): $0.25 per million RRUs
- **Reads** (strongly consistent): $0.50 per million RRUs (2x RRUs)

**Capacity Units**:
- **1 WRU**: One write of up to 1 KB
- **1 RRU**: One strongly consistent read of up to 4 KB
- **0.5 RRU**: One eventually consistent read of up to 4 KB
- **2 RRU**: One transactional read of up to 4 KB

**Example Cost Calculation**:
- 10 million reads per month (4 KB items, eventually consistent)
- 10 million reads = 10M RRUs × 0.5 = 5M RRUs
- Cost: 5M RRUs × $0.25 / 1M = **$1.25/month**

**When to Use On-Demand**:
- Unpredictable or spiky traffic patterns
- New applications with unknown workload
- Low-traffic applications (idle most of the time)
- Serverless applications (pay only when active)

**November 2024 Price Reduction**: AWS reduced on-demand pricing significantly, making it cost-effective for more workloads than previously.

### Provisioned Capacity Mode

Pre-allocate read and write capacity units with optional auto-scaling.

**How It Works**:
- Specify RCUs and WCUs in advance
- Billed hourly based on provisioned capacity (not actual usage)
- Auto-scaling can adjust capacity based on utilization

**Pricing (us-east-1, 2024)**:
- **1 WCU**: $0.00065/hour ($0.47/month)
- **1 RCU**: $0.00013/hour ($0.09/month)

**Capacity Units**:
- **1 RCU**: One strongly consistent read/second (up to 4 KB) OR two eventually consistent reads/second
- **1 WCU**: One write/second (up to 1 KB)

**Example Cost Calculation**:
- Provision 100 RCUs and 50 WCUs
- RCU cost: 100 × $0.09 = $9/month
- WCU cost: 50 × $0.47 = $23.50/month
- **Total**: $32.50/month (regardless of actual usage)

**When to Use Provisioned**:
- Predictable, steady workload
- High utilization (>70% average)
- Cost-sensitive applications (provisioned is cheaper at high utilization)

**Reserved Capacity**: Purchase 1-year or 3-year commitments for additional savings.

<div class="callout callout--tip">
<p class="callout__title">Default to On-Demand Mode</p>
<p>On-demand mode eliminates capacity planning and auto-scales instantly. Switch to provisioned only when utilization is consistently &gt;70% and workload is predictable.</p>
</div>

### On-Demand vs Provisioned: Decision Framework

| Scenario | On-Demand | Provisioned |
|----------|-----------|-------------|
| **Unpredictable traffic** | ✅ Best choice | ❌ Risk of throttling or over-provisioning |
| **New application** | ✅ No capacity planning | ❌ Hard to estimate |
| **Steady workload (>70% utilization)** | ❌ More expensive | ✅ Cost-effective |
| **Spiky workload (idle >50% of time)** | ✅ Pay only when active | ❌ Pay for idle capacity |
| **Low-traffic (<1M requests/month)** | ✅ Low absolute cost | ✅ Free tier available |

**Rule of Thumb**: Use on-demand by default. Switch to provisioned if utilization is consistently >70% and workload is predictable.

**Switching Modes**: You can switch between on-demand and provisioned once per 24 hours.

## DynamoDB Streams

DynamoDB Streams captures a time-ordered sequence of item-level modifications (inserts, updates, deletes) in a DynamoDB table.

**How It Works**:
- Stream records appear within seconds of the change
- Records remain available for 24 hours
- Each record contains: old image, new image, or both (configurable)
- Guaranteed ordering within a partition key

**Use Cases**:
- **Event-driven architectures**: Trigger Lambda functions on table changes
- **Data replication**: Sync data to other databases, search indexes, or data lakes
- **Audit logging**: Track all changes for compliance
- **Real-time analytics**: Process changes as they occur

**Integration with EventBridge Pipes**:
- EventBridge Pipes provides native integration between DynamoDB Streams and EventBridge
- Enables filtering, enrichment, and routing to multiple targets
- Supports batching (up to 5 minutes or 6 MB) to reduce processing overhead
- Processes up to 10 batches per shard simultaneously while maintaining partition key ordering

**Example Pattern**:
```
DynamoDB Table: Orders
→ DynamoDB Streams (captures inserts)
→ EventBridge Pipe (filters for high-value orders >$1000)
→ EventBridge Rule (routes to appropriate targets)
→ Lambda: Send email notification
→ SQS: Queue for fulfillment processing
→ S3: Archive for analytics
```

**Cost**: DynamoDB Streams is free. You pay only for Lambda invocations or other processing costs.

## Single-Table Design

Single-table design stores multiple entity types in one DynamoDB table using generic partition and sort keys.

**Core Principle**: Model your data around access patterns, not entities.

### How It Works

**Generic Keys**:
- Use generic attribute names: `PK` (partition key), `SK` (sort key)
- Overload keys with multiple entity types

**Example**:
```
Table: AppData (PK, SK)

Entity: User
- PK: "USER#john@example.com"
- SK: "PROFILE"
- Name: "John Doe"
- CreatedDate: "2024-01-15"

Entity: Order (belonging to User)
- PK: "USER#john@example.com"
- SK: "ORDER#2024-02-20"
- OrderTotal: 250
- Status: "Shipped"

Entity: Product
- PK: "PRODUCT#ABC123"
- SK: "METADATA"
- Name: "Laptop"
- Price: 1200

Query: Get user profile and all orders for john@example.com
→ Query PK="USER#john@example.com", SK begins_with "ORDER"
→ Returns all orders in a single request
```

### Benefits

1. **Fewer Requests**: Retrieve related data in a single query (no joins)
2. **Lower Costs**: Fewer round trips, fewer read capacity units consumed
3. **Better Performance**: Single-digit millisecond latency for complex queries
4. **Atomic Transactions**: Update related items atomically (up to 100 items in a transaction)

### Drawbacks

1. **Harder to Evolve**: New access patterns may require significant refactoring
2. **Complex Modeling**: Requires deep understanding of access patterns upfront
3. **Analytics Challenges**: Hard to query across entity types (use DynamoDB Streams + analytics tools)

### When to Use Single-Table Design

**✅ Use single-table design when**:
- Access patterns are well-defined and stable
- You need low latency for complex queries
- You want to minimize costs (fewer requests)
- Your application is mature and access patterns are predictable

**❌ Avoid single-table design when**:
- Application is new and access patterns are evolving rapidly
- You need ad-hoc queries and analytics
- Developer agility is more important than performance optimization

**Alternative**: Use multiple tables for different entity types and accept higher request counts. This is simpler to understand and easier to evolve.

## DynamoDB Accelerator (DAX)

DAX is a fully managed, in-memory cache for DynamoDB that delivers microsecond latency.

**Performance**:
- Reduces read latency from milliseconds to **microseconds**
- Up to **10x faster** for eventually consistent reads
- Can serve **millions of requests per second**

**How It Works**:
- DAX sits between your application and DynamoDB
- Cache hit: Returns data from memory (microseconds)
- Cache miss: Fetches from DynamoDB, caches result, then returns data

**Cache Types**:
1. **Item Cache**: Caches individual items from GetItem/BatchGetItem
2. **Query Cache**: Caches query result sets

**TTL (Time-to-Live)**:
- Default: 5 minutes
- Configurable per cache type
- Longer TTL = better cache hit rate but more stale data

**When to Use DAX**:
- Read-heavy workloads with repeated queries
- Applications requiring microsecond latency
- Eventually consistent reads (DAX doesn't support strongly consistent reads)
- Cost reduction for read-intensive workloads (cache hits don't consume RCUs/RRUs)

**When NOT to Use DAX**:
- Write-heavy workloads (DAX only caches reads)
- Strongly consistent reads required
- Cost-sensitive applications with low read volume (DAX adds instance costs)

**Pricing (us-east-1, 2024)**:
- **dax.t3.small**: $0.04/hour ($29/month)
- **dax.r5.large**: $0.31/hour ($227/month)
- Recommendation: Start with t3.small, scale up if needed

**DAX vs ElastiCache**:

| Dimension | DAX | ElastiCache (Redis) |
|-----------|-----|---------------------|
| **DynamoDB Integration** | Native (drop-in replacement) | Requires manual cache logic |
| **Latency** | Microseconds | Sub-millisecond |
| **Use Case** | DynamoDB-specific caching | General-purpose caching, session storage |
| **Complexity** | Low (automatic cache management) | Higher (manual invalidation) |

## Cost Optimization

### Storage Costs

**Standard Table Class**:
- $0.25/GB/month
- Default for most workloads

**Standard-IA (Infrequent Access) Table Class**:
- $0.10/GB/month (60% savings on storage)
- Higher read/write costs (25% more)
- Use for tables accessed infrequently (<1 query per hour)

**Cost Example**:
- 100 GB table, 10M reads/month (on-demand, eventually consistent)
- **Standard**: (100 GB × $0.25) + (5M RRUs × $0.25/1M) = $25 + $1.25 = **$26.25/month**
- **Standard-IA**: (100 GB × $0.10) + (5M RRUs × $0.3125/1M) = $10 + $1.56 = **$11.56/month**
- **Savings**: $14.69/month (56%)

### Capacity Mode Optimization

**On-Demand Breakeven Analysis**:
- On-demand cost: Requests × ($1.25/M for writes, $0.25/M for reads)
- Provisioned cost: (WCUs × $0.47) + (RCUs × $0.09)
- Switch to provisioned when utilization >70% and workload is predictable

**Example**:
- 1 million writes/month, 10 million reads/month (4 KB, eventually consistent)
- **On-demand**: (1M WRUs × $1.25/M) + (5M RRUs × $0.25/M) = $1.25 + $1.25 = **$2.50/month**
- **Provisioned** (assuming constant load):
  - 0.4 WCUs (1M writes / 2.6M seconds/month) → minimum 1 WCU = $0.47
  - 1.9 RCUs (5M RRUs / 2.6M seconds) → 2 RCUs = $0.18
  - **Total**: $0.65/month
- **Savings**: $1.85/month (74% cheaper with provisioned)

### Index Optimization

**Project Only What You Query**:
- Use KEYS_ONLY or INCLUDE instead of ALL
- Reduces storage costs and write costs

**Sparse Indexes**:
- Only include items in GSI if they have the indexed attribute
- Example: GSI on `ExpirationDate` only includes items with expiration dates
- Reduces index size and write costs

**Delete Unused Indexes**:
- Each GSI adds storage and write costs
- Audit indexes quarterly; delete those rarely queried

### Backup Costs

**Point-in-Time Recovery (PITR)**:
- $0.20/GB/month (us-east-1)
- Continuous backups for 1-35 days
- Cost is based on table size, not recovery window

**On-Demand Backups**:
- $0.10/GB/month (stored until deleted)
- Use for long-term archival (>35 days)

**Cost Comparison** (100 GB table):
- PITR: $20/month (automated, 35-day retention)
- On-Demand: $10/month per snapshot (manual, indefinite retention)

**Best Practice**: Enable PITR for production tables. Use on-demand backups for compliance (long-term retention).

### Free Tier

**25 GB storage** + **25 RCUs** + **25 WCUs** per month (provisioned mode) or **200M requests/month** (on-demand mode).

**What This Covers**:
- Small applications (<1M requests/day)
- Development and testing environments
- Learning and experimentation

## Security Best Practices

### Encryption

**Encryption at Rest**:
- Enabled by default (AWS-owned keys)
- No performance impact
- Options: AWS-owned keys (free), AWS-managed keys (KMS, $1/month), customer-managed keys (full control)

**Encryption in Transit**:
- All API calls use TLS 1.2+
- Automatic (no configuration required)

### IAM Access Control

**Use IAM Policies for Fine-Grained Access**:
- Grant least privilege access (only required tables/actions)
- Use conditions to restrict by partition key (row-level security)

**Example Policy** (restrict to user's own data):
```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:GetItem", "dynamodb:Query"],
  "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Users",
  "Condition": {
    "ForAllValues:StringEquals": {
      "dynamodb:LeadingKeys": ["${aws:userid}"]
    }
  }
}
```

This policy allows users to query only items where the partition key matches their AWS user ID.

### VPC Endpoints

**Use VPC Endpoints for Private Access**:
- DynamoDB traffic stays within AWS network (doesn't traverse internet)
- Reduces latency and improves security
- No additional cost

**Best Practice**: Deploy Lambda functions and applications in VPC with DynamoDB VPC endpoint.

## Performance Optimization

### Batch Operations

**BatchGetItem** and **BatchWriteItem** reduce request overhead.

**Benefits**:
- Retrieve up to 100 items (16 MB) in a single request
- Write up to 25 items in a single request
- Lower latency (fewer round trips)

**Cost Savings**:
- On-demand: Same cost as individual requests (but faster)
- Provisioned: Reduces consumed capacity (batching is more efficient)

### Parallel Scans

**Scan** operations read the entire table sequentially (slow and expensive).

**Parallel Scans**:
- Divide table into segments (e.g., 4 segments)
- Scan each segment in parallel (4 concurrent workers)
- Aggregate results

**Performance**: 4x faster with 4 segments (but consumes 4x read capacity).

**Best Practice**: Use parallel scans only for infrequent operations (backfill, analytics). Prefer Query over Scan whenever possible.

### Query Optimization

**Use Query Instead of Scan**:
- Query reads only items matching partition key (efficient)
- Scan reads entire table (inefficient)

**Example**:
- Table: 1 million items, query 100 items by partition key
- **Query**: Reads 100 items (0.4 KB each) = 10 RCUs
- **Scan**: Reads 1 million items (400 MB) = 100,000 RCUs
- **Savings**: 99.99% fewer RCUs with Query

**Use Sparse Indexes**:
- Query GSI instead of base table when filtering by indexed attribute

**Limit Result Set**:
- Use `Limit` parameter to retrieve only needed items
- Implement pagination for large result sets

## Common Pitfalls

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **1. Hot partition keys** | Throttling, poor performance | Design partition keys for uniform distribution; use write sharding |
| **2. Using Scan instead of Query** | 100-1000x higher costs | Model data for Query access patterns; use GSIs for alternative queries |
| **3. Projecting ALL attributes to GSI** | 2-3x higher storage and write costs | Project only KEYS_ONLY or INCLUDE specific attributes |
| **4. Not enabling PITR for production** | Data loss risk | Enable PITR ($0.20/GB/month) for 35-day recovery window |
| **5. Over-provisioning in provisioned mode** | 50-70% wasted capacity costs | Use auto-scaling or switch to on-demand mode |
| **6. Not using batch operations** | Higher latency, more requests | Use BatchGetItem/BatchWriteItem for bulk operations |
| **7. Creating too many GSIs** | Write amplification, storage costs | Limit to 5-10 GSIs; delete unused indexes |
| **8. Ignoring item size limits** | Write failures, throttling | Item size limit: 400 KB; use S3 for large objects, store reference in DynamoDB |
| **9. Using LSIs instead of GSIs** | Locked in at table creation, 10 GB limit | Prefer GSIs (can add/remove anytime, unlimited size) |
| **10. Not monitoring consumed capacity** | Unexpected throttling or costs | Set CloudWatch alarms: ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits, ThrottledRequests |
| **11. Strongly consistent reads when not needed** | 2x read costs | Use eventually consistent reads (default) unless strong consistency required |
| **12. Not using DAX for read-heavy workloads** | 10x slower, higher read costs | Add DAX for workloads with >50% cache hit rate |
| **13. Time-based partition keys** | Hot partitions (today's date gets all writes) | Use entity ID as partition key, timestamp as sort key |
| **14. Not using Standard-IA for infrequent tables** | 60% higher storage costs | Switch to Standard-IA for tables accessed <1 query/hour |
| **15. Storing large attributes in every item** | Storage costs, slower queries | Store large attributes (descriptions, JSON) in S3, reference in DynamoDB |

**Cost Impact Examples**:
- **Pitfall #2** (Scan vs Query): 1M item table, query 100 items → Scan: 100,000 RCUs ($25 on-demand), Query: 10 RCUs ($0.0025) = **99.99% savings**
- **Pitfall #5** (over-provisioning): 100 RCUs provisioned, 30% utilization → Wasted: $6.30/month
- **Pitfall #7** (5 unused GSIs): 100 GB table, 1M writes/month → Extra cost: (5 GSIs × 100 GB × $0.25) + (5M WRUs × $1.25/M) = $125 + $6.25 = **$131.25/month wasted**
- **Pitfall #14** (not using Standard-IA): 500 GB infrequently accessed table → Savings: 500 GB × ($0.25 - $0.10) = **$75/month**

## When to Use DynamoDB vs RDS

<div class="callout callout--note">
<p class="callout__title">DynamoDB vs RDS Decision</p>
<p>Choose DynamoDB when access patterns are known and key-based. Choose RDS when you need complex SQL queries, joins, and ad-hoc analytics. Many systems use both: DynamoDB for operational data and RDS for reporting.</p>
</div>

| Dimension | DynamoDB | RDS (Relational) |
|-----------|----------|------------------|
| **Data Model** | Key-value, document (schemaless) | Relational (tables, joins, SQL) |
| **Scalability** | Horizontal (unlimited) | Vertical (limited by instance size) |
| **Latency** | Single-digit milliseconds | Low milliseconds |
| **Queries** | Key-based queries, secondary indexes | Complex SQL queries, joins, aggregations |
| **Transactions** | Limited (up to 100 items, same Region) | ACID transactions across tables |
| **Access Patterns** | Must be known upfront | Ad-hoc queries supported |
| **Operational Overhead** | Zero (fully managed, serverless) | Low (managed, but requires instance sizing) |
| **Cost at Scale** | Lower for high-scale workloads | Higher due to vertical scaling limits |
| **Use Case** | Session storage, user profiles, IoT, gaming leaderboards | ERP, CRM, financial transactions, reporting |

**Decision Framework**:

**Choose DynamoDB when**:
- You need horizontal scalability beyond RDS limits
- Access patterns are known and key-based
- You require single-digit millisecond latency
- You want zero operational overhead (serverless)

**Choose RDS when**:
- You need complex SQL queries, joins, and aggregations
- Access patterns are unpredictable or ad-hoc
- You require strong ACID transactions across tables
- Your team is familiar with relational databases

**Hybrid Approach**: Use both: DynamoDB for high-scale operational data, RDS for analytics and reporting (sync via DynamoDB Streams).

## Key Takeaways

**Partition Key Design**:
- The most critical decision for performance and cost
- Design for uniform distribution (avoid hot partitions)
- Each partition supports 3,000 RCUs and 1,000 WCUs
- Use write sharding if a partition key exceeds limits

**Capacity Modes**:
- On-demand is default and recommended (auto-scales, pay-per-request)
- Provisioned is cheaper for steady workloads with >70% utilization
- Switch modes once per 24 hours

**Secondary Indexes**:
- GSIs provide flexibility (different partition/sort keys, add/remove anytime)
- LSIs share partition key with base table (created at table creation only)
- Prefer GSIs in most cases
- Project only attributes you query (KEYS_ONLY or INCLUDE)

**Single-Table Design**:
- Stores multiple entity types in one table
- Benefits: Fewer requests, lower costs, better performance
- Drawbacks: Harder to evolve, complex modeling
- Use when access patterns are stable and well-defined

**DynamoDB Streams**:
- Captures item-level changes for event-driven architectures
- Integrates with EventBridge Pipes for filtering and routing
- Free (pay only for processing costs)

**DAX (DynamoDB Accelerator)**:
- In-memory cache delivering microsecond latency
- 10x faster for read-heavy workloads
- Use for workloads requiring microsecond latency or high cache hit rates

**Cost Optimization**:
- Use Standard-IA for infrequent access (60% storage savings)
- Switch to provisioned mode for predictable, high-utilization workloads
- Project only needed attributes to GSIs
- Delete unused indexes
- Enable PITR for production ($0.20/GB/month)

**Performance**:
- Use Query instead of Scan (100-1000x more efficient)
- Batch operations for bulk reads/writes
- DAX for microsecond latency on repeated queries
- Parallel scans for infrequent full-table operations

**Security**:
- Encryption at rest enabled by default
- Use IAM policies for fine-grained access control
- VPC endpoints for private access
- Row-level security with IAM condition keys
