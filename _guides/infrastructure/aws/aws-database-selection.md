---
title: "AWS Database Service Selection for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "Comprehensive decision framework for selecting the right AWS database service (RDS/Aurora, DynamoDB, ElastiCache, Redshift) based on workload characteristics, performance requirements, and cost constraints"
tags: [aws, database-selection, decision-framework, architecture, rds, dynamodb, elasticache, redshift]
---

## Overview

AWS offers multiple database services optimized for different workload patterns. Choosing the right database is one of the most critical architectural decisions, as migrating between database types later is expensive and complex.

This guide provides decision frameworks to help you select between:
- **RDS/Aurora**: Relational databases (MySQL, PostgreSQL, SQL Server, Oracle)
- **DynamoDB**: NoSQL key-value and document database
- **ElastiCache**: In-memory caching (Redis, Memcached)
- **Redshift**: Data warehouse for analytics

## Quick Decision Tree

```
Start: What type of workload?

├─ OLTP (Transactional) → Relational or NoSQL?
│  ├─ Need SQL, ACID transactions, complex queries → RDS/Aurora
│  │  ├─ Need 5x-3x performance, auto-scaling → Aurora
│  │  └─ Cost-sensitive, predictable workload → RDS
│  │
│  └─ Need horizontal scaling, key-value access → DynamoDB
│     ├─ Unpredictable traffic → On-Demand mode
│     └─ Predictable traffic → Provisioned mode
│
├─ OLAP (Analytical) → Redshift
│  ├─ Variable workload → Serverless
│  └─ Steady workload → Provisioned + Reserved Instances
│
└─ Caching (Performance acceleration) → ElastiCache
   ├─ Need advanced features → Redis/Valkey
   └─ Simple key-value → Memcached
```

## Database Service Comparison Matrix

| Dimension | RDS/Aurora | DynamoDB | ElastiCache | Redshift |
|-----------|------------|----------|-------------|----------|
| **Workload Type** | OLTP (transactional) | OLTP (NoSQL) | Caching | OLAP (analytical) |
| **Data Model** | Relational (SQL) | Key-value, document | Key-value | Relational (SQL) |
| **Query Type** | Complex SQL, joins, aggregations | Key-based lookups, simple queries | Key-based retrieval | Complex aggregations, multi-table joins |
| **Scalability** | Vertical (instance size) | Horizontal (unlimited) | Vertical + horizontal | Horizontal (add nodes) |
| **Latency** | Low milliseconds | Single-digit milliseconds | Sub-millisecond | Sub-second (analytical queries) |
| **Capacity** | Up to 128 TB (Aurora) | Unlimited | Up to 419 GB per node | Petabytes |
| **Consistency** | ACID transactions | Eventual or strongly consistent | Eventual (replica lag) | Strong |
| **Cost** | $0.12-$13/hour (instance-based) | $0.25-$1.25 per million requests | $0.016-$13/hour (node-based) | $0.25-$13/hour (node-based) |
| **Use Case** | Web apps, ERP, CRM | Mobile apps, IoT, gaming | Session storage, query caching | BI, data warehousing, reporting |

## Workload Pattern Analysis

### Transactional Workloads (OLTP)

**Characteristics**:
- Frequent reads and writes
- Low-latency requirements (<100ms)
- Small transactions (individual rows or documents)
- Concurrent users accessing different data

**RDS/Aurora When**:
- Complex queries with joins across multiple tables
- ACID transactions required
- Existing SQL codebase or team expertise
- Relational data model (foreign keys, normalization)

**DynamoDB When**:
- Predictable access patterns (key-based lookups)
- Need unlimited horizontal scaling
- Single-digit millisecond latency required
- Schemaless flexibility beneficial

### Analytical Workloads (OLAP)

**Characteristics**:
- Complex aggregations across large datasets
- Infrequent writes, read-heavy
- Queries scan millions of rows
- BI tools and dashboards

**Redshift When**:
- Need SQL-based analytics
- Large datasets (>100 GB)
- Complex joins and aggregations
- BI tool integration (Tableau, Looker, QuickSight)

**Athena When** (not covered in detail, but worth mentioning):
- Ad-hoc queries on S3 data
- Don't want to manage infrastructure
- Query infrequently (<once per day)

### Caching Workloads

**Characteristics**:
- Read-heavy access to frequently requested data
- Tolerance for eventual consistency
- Performance acceleration goal
- Offload database reads

**ElastiCache When**:
- Database read bottleneck
- Need sub-millisecond latency
- Frequently accessed data fits in memory
- Can tolerate cache misses

**CloudFront When** (CDN, not database):
- Static content caching
- Global user base
- Edge-based caching

## RDS vs Aurora Decision Framework

Both are relational databases, but Aurora offers cloud-native advantages at premium cost.

### Feature Comparison

| Feature | RDS | Aurora |
|---------|-----|--------|
| **Performance** | Standard engine performance | 5x MySQL, 3x PostgreSQL |
| **Storage** | Up to 64 TB | Auto-scales to 128 TB |
| **Read Replicas** | Up to 5 | Up to 15 |
| **Failover Time** | 60-120 seconds | <35 seconds |
| **Replication Lag** | Seconds to minutes | <100ms |
| **Serverless** | No | Aurora Serverless v2 |
| **Global Database** | Manual setup | <1 second cross-Region replication |
| **Cost** | Lower baseline | 20-30% premium |

### Decision Criteria

**Choose RDS When**:
- **Engine compatibility**: Need Oracle, SQL Server, MariaDB, or Db2 (Aurora only supports MySQL/PostgreSQL)
- **Cost-sensitive**: Budget-constrained, predictable workload
- **Workload fits single instance**: <5 read replicas sufficient
- **Development/testing**: Lower-cost environments

**Choose Aurora When**:
- **Performance critical**: Need 5x-3x throughput improvement
- **High availability**: <35 second failover required (99.99% SLA)
- **Read scaling**: Need >5 read replicas (up to 15)
- **Global applications**: Multi-Region replication with <1 second lag
- **Variable workload**: Aurora Serverless v2 auto-scales capacity
- **Write-heavy**: Aurora I/O-Optimized eliminates per-request I/O charges

**Cost Comparison Example** (db.r6g.xlarge, us-east-1):
- **RDS MySQL**: $0.252/hour ($185/month) + storage ($0.115/GB)
- **Aurora MySQL Standard**: $0.29/hour ($213/month) + I/O ($0.20/M requests)
- **Aurora I/O-Optimized**: $0.348/hour ($255/month), no I/O charges

**Breakeven**: Aurora costs 15-20% more but delivers 3-5x performance. If performance improvement reduces infrastructure costs elsewhere (fewer replicas, smaller instances), Aurora is cost-effective.

## DynamoDB vs RDS/Aurora Decision Framework

NoSQL vs relational database choice depends on access patterns and scalability requirements.

### When to Choose DynamoDB Over RDS/Aurora

**1. Scalability Beyond Relational Limits**:
- Need to scale beyond single-instance vertical limits
- Workload requires millions of requests per second
- Unpredictable traffic spikes (DynamoDB on-demand auto-scales)

**2. Predictable Access Patterns**:
- Queries are key-based lookups (no complex joins)
- Access patterns known upfront (can model partition/sort keys)
- Single-table design feasible

**3. Single-Digit Millisecond Latency**:
- Need consistent sub-10ms response times at scale
- Latency more important than query flexibility

**4. Serverless Architecture**:
- Want zero operational overhead
- Pay-per-request pricing preferred
- No server management desired

### When to Choose RDS/Aurora Over DynamoDB

**1. Complex Queries Required**:
- Need joins across multiple tables
- Ad-hoc queries with unpredictable filters
- Complex aggregations (GROUP BY, window functions)

**2. ACID Transactions Across Tables**:
- Multi-table transactions required
- Strong consistency across related entities
- Traditional relational integrity (foreign keys)

**3. Existing SQL Ecosystem**:
- Team expertise in SQL
- Existing SQL-based applications
- BI tools require SQL interface

**4. Unknown Access Patterns**:
- Exploratory analytics
- Access patterns evolving
- Need query flexibility without remodeling data

### Cost Comparison Example

**Scenario**: 10 million requests/month, 50 GB storage, read-heavy (90% reads, 10% writes)

**DynamoDB On-Demand**:
- Reads: 9M × 0.5 RRUs (eventually consistent) = 4.5M RRUs × $0.25/M = $1.13
- Writes: 1M × 1 WRU = 1M WRUs × $1.25/M = $1.25
- Storage: 50 GB × $0.25 = $12.50
- **Total**: $14.88/month

**RDS (db.t4g.micro)**:
- Instance: $0.016/hour = $12/month
- Storage: 50 GB × $0.115 = $5.75
- **Total**: $17.75/month

**RDS (db.r6g.large for performance)**:
- Instance: $0.201/hour = $147/month
- Storage: 50 GB × $0.115 = $5.75
- **Total**: $152.75/month

**Analysis**: For this workload, DynamoDB is cheapest. RDS requires larger instance for comparable performance, making it 10x more expensive. However, RDS provides SQL flexibility that DynamoDB lacks.

## ElastiCache vs DynamoDB vs RDS Decision Framework

When to use caching vs primary database.

### ElastiCache Use Cases

**Use ElastiCache When**:
- **Database read bottleneck**: 50-90% of queries hit same data repeatedly
- **Sub-millisecond latency needed**: DynamoDB (single-digit ms) not fast enough
- **Offload database reads**: Reduce RDS/Aurora load without scaling instance
- **Session storage**: Distributed session management for stateless apps
- **Real-time analytics**: Leaderboards, counters, rate limiting

**Don't Use ElastiCache As Primary Database** because:
- No persistence (Redis snapshots available but not primary design)
- Cache invalidation complexity
- Limited query capabilities (key-based only)

### Decision Matrix

| Need | Primary Database | Caching Layer |
|------|------------------|---------------|
| **Query result caching** | RDS/Aurora | ElastiCache (lazy loading) |
| **Session storage** | DynamoDB or ElastiCache | N/A (use directly) |
| **Real-time leaderboards** | DynamoDB | ElastiCache Redis (sorted sets) |
| **User profiles (read-heavy)** | RDS/Aurora | ElastiCache (write-through) |
| **Product catalog** | RDS/Aurora | ElastiCache (TTL-based) |

**Common Architecture**: RDS/Aurora + ElastiCache
- RDS: Source of truth
- ElastiCache: Read cache (lazy loading or write-through)
- 50-90% database load reduction

**Cost Example**:
- RDS without cache: db.r6g.2xlarge ($0.806/hour = $588/month)
- RDS with cache: db.r6g.large ($0.201/hour = $147/month) + cache.r6g.large ($0.201/hour = $147/month) = $294/month
- **Savings**: $294/month (50% reduction by offloading reads to cache)

## Redshift vs RDS/Aurora Decision Framework

Data warehouse vs transactional database choice depends on query patterns.

### When to Choose Redshift Over RDS/Aurora

**1. Analytical Workload (OLAP)**:
- Complex aggregations across large datasets
- Queries scan millions of rows
- Infrequent writes, read-heavy
- BI dashboards and reports

**2. Large Datasets**:
- >100 GB of analytical data
- Petabyte-scale data warehousing
- Historical data analysis

**3. Columnar Storage Benefits**:
- Queries access subset of columns (not full rows)
- Heavy use of aggregations (SUM, AVG, COUNT)
- Compression benefits from columnar format

### When to Choose RDS/Aurora Over Redshift

**1. Transactional Workload (OLTP)**:
- Frequent writes (inserts, updates, deletes)
- Low-latency point queries (<100ms)
- ACID transactions required

**2. Small Datasets**:
- <100 GB of data
- Redshift overkill for small datasets

**3. Real-Time Requirements**:
- Sub-second write-to-read latency
- Immediate consistency required

### Cost Comparison Example

**Scenario**: 500 GB data, 1,000 complex analytical queries/month

**RDS (db.r6g.2xlarge)**:
- Instance: $0.806/hour = $588/month
- Storage: 500 GB × $0.115 = $57.50
- **Total**: $645.50/month
- **Query Performance**: Slow (not optimized for analytics)

**Redshift Serverless**:
- Compute: 8 RPUs × 50 hours (1,000 queries × 3 min avg) × $0.375/RPU-hour = $150
- Storage: 500 GB × $0.024 = $12
- **Total**: $162/month
- **Query Performance**: 10-100x faster (columnar, MPP)

**Analysis**: Redshift is 75% cheaper and significantly faster for analytical workloads.

## Hybrid Architectures

Real-world systems often combine multiple database services for different use cases.

### Common Patterns

**1. OLTP + OLAP (Transactional + Analytical)**:
- **RDS/Aurora**: Operational database (writes, reads, transactions)
- **Redshift**: Analytics (aggregations, BI dashboards)
- **Data flow**: RDS → S3 (daily export) → Redshift COPY

**Use case**: E-commerce platform with real-time transactions + daily sales reports

**2. OLTP + Caching**:
- **RDS/Aurora**: Primary database
- **ElastiCache**: Read cache (50-90% load reduction)
- **Data flow**: Application → ElastiCache (cache miss) → RDS → ElastiCache (cache write)

**Use case**: High-traffic web application with database read bottleneck

**3. NoSQL + Caching**:
- **DynamoDB**: Primary NoSQL database
- **DAX**: DynamoDB Accelerator (microsecond latency)
- **Data flow**: Application → DAX (cache hit) → DynamoDB (cache miss)

**Use case**: Mobile app with millions of users, need microsecond latency

**4. Data Lake + Data Warehouse**:
- **S3**: Data lake (raw data, Parquet format)
- **Redshift Spectrum**: Query S3 without loading
- **Redshift**: Frequently accessed data (loaded via COPY)
- **Data flow**: S3 (infrequent data) + Redshift (frequent data), joined in queries

**Use case**: Large-scale analytics with hot/cold data separation

**5. Multi-Database (Polyglot Persistence)**:
- **RDS**: User accounts, orders (relational)
- **DynamoDB**: Session storage, real-time data
- **ElastiCache**: Query result caching
- **Redshift**: Analytics and reporting
- **S3**: Object storage (images, documents)

**Use case**: Complex enterprise application with diverse data patterns

## Decision Framework Worksheet

Use this worksheet to systematically evaluate database service selection.

### Step 1: Classify Workload Type

- [ ] **OLTP (Transactional)**: Frequent reads/writes, low latency, small transactions → RDS/Aurora or DynamoDB
- [ ] **OLAP (Analytical)**: Complex aggregations, large scans, BI dashboards → Redshift
- [ ] **Caching**: Performance acceleration, offload database reads → ElastiCache

### Step 2: Evaluate Data Model Requirements

- [ ] **Relational**: SQL, joins, foreign keys, ACID → RDS/Aurora
- [ ] **NoSQL**: Key-value, schemaless, horizontal scaling → DynamoDB
- [ ] **Columnar**: Analytical queries, subset of columns → Redshift

### Step 3: Assess Access Patterns

- [ ] **Complex queries**: Joins, ad-hoc filters, aggregations → RDS/Aurora or Redshift
- [ ] **Key-based lookups**: Partition key + sort key queries → DynamoDB
- [ ] **Frequent repeated queries**: Same data accessed repeatedly → ElastiCache

### Step 4: Determine Scalability Needs

- [ ] **Vertical scaling sufficient**: <128 TB, predictable growth → RDS/Aurora
- [ ] **Horizontal scaling required**: Unlimited growth, millions of requests/sec → DynamoDB
- [ ] **Analytical scaling**: Petabyte-scale data warehouse → Redshift

### Step 5: Performance Requirements

- [ ] **Sub-millisecond**: Caching required → ElastiCache (Redis/Memcached)
- [ ] **Single-digit millisecond**: Key-value access → DynamoDB
- [ ] **Low milliseconds**: Transactional queries → RDS/Aurora
- [ ] **Sub-second**: Analytical queries → Redshift

### Step 6: Cost Optimization

- [ ] **Variable workload**: On-demand or Serverless → DynamoDB On-Demand, Aurora Serverless v2, Redshift Serverless
- [ ] **Steady workload**: Provisioned capacity + Reserved Instances → RDS/Aurora RI, DynamoDB Provisioned, Redshift RI
- [ ] **Cost-sensitive**: Evaluate per-request vs per-hour pricing

### Step 7: Operational Overhead

- [ ] **Zero management**: Serverless options → DynamoDB On-Demand, Aurora Serverless v2, Redshift Serverless
- [ ] **Minimal management**: Managed services → RDS, Aurora, Redshift provisioned
- [ ] **Full control**: Self-managed → EC2 (not recommended)

## Migration Considerations

### Migrating Between Database Services

**RDS to Aurora**:
- **Effort**: Low (same SQL engine)
- **Method**: Create Aurora read replica, promote to primary
- **Downtime**: <5 minutes (with read replica promotion)

**RDS to DynamoDB**:
- **Effort**: High (data model redesign)
- **Method**: AWS Database Migration Service (DMS) + application refactor
- **Downtime**: Can be zero (dual-write during migration)

**On-Premises to RDS/Aurora**:
- **Effort**: Medium (lift-and-shift)
- **Method**: AWS DMS or native replication
- **Downtime**: Minimal (cutover window)

**Transactional to Analytical (RDS to Redshift)**:
- **Effort**: Low (data pipeline setup)
- **Method**: S3 export → Redshift COPY or AWS DMS
- **Downtime**: None (separate systems)

## Key Takeaways

**RDS/Aurora**:
- Use for transactional workloads requiring SQL, joins, ACID transactions
- Aurora provides 3-5x performance, <35s failover, up to 15 read replicas at 20-30% premium
- Choose RDS for cost-sensitive or engine-specific needs (Oracle, SQL Server, Db2)

**DynamoDB**:
- Use for horizontal scaling beyond relational limits, key-based access patterns
- On-demand mode for unpredictable traffic, Provisioned for steady workloads >70% utilization
- Single-digit millisecond latency, unlimited scalability, zero operational overhead

**ElastiCache**:
- Use for caching frequently accessed data, offloading database reads (50-90% reduction)
- Redis for advanced features (data structures, persistence, replication)
- Memcached for simple key-value caching with multi-threading

**Redshift**:
- Use for analytical workloads, BI dashboards, complex aggregations on large datasets
- Serverless for variable workloads (<50% utilization), Provisioned + RI for steady workloads
- Redshift Spectrum queries S3 data lake without loading ($5/TB scanned)

**Hybrid Architectures**:
- Combine services for different use cases (OLTP + OLAP, OLTP + caching)
- Use data pipelines to sync between databases (RDS → Redshift)
- Polyglot persistence: Choose best database for each data pattern

**Cost Optimization**:
- Reserved Instances: 64-69% savings for predictable workloads
- Serverless options: 40-95% savings for variable workloads
- Right-size instances: Monitor utilization, scale based on metrics
- Caching: Reduce database instance size by offloading reads

**Decision Factors**:
1. Workload type (OLTP, OLAP, caching)
2. Data model (relational, NoSQL, columnar)
3. Access patterns (complex queries, key-based, repeated queries)
4. Scalability needs (vertical, horizontal, petabyte-scale)
5. Performance requirements (sub-millisecond to sub-second)
6. Cost constraints (variable vs steady workload)
7. Operational overhead tolerance (serverless vs managed vs self-managed)
