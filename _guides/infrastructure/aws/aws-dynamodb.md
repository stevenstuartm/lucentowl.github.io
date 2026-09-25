---
title: "Amazon DynamoDB for System Architects"
layout: guide
category: AWS
subcategory: Database Services
description: "How DynamoDB stores and serves data, and how to design for it: keys, partitions, and hot keys; queries, transactions, and consistency; secondary indexes; modeling around access patterns; on-demand and provisioned capacity; Streams and TTL; DAX; backups; security; and what drives the bill."
tags: [dynamodb, partition-keys, secondary-indexes, single-table-design, dynamodb-streams, capacity-modes, fundamentals]
---

## What DynamoDB Is

**Amazon DynamoDB** is a serverless key-value and document database. You create a **table**, write **items** into it, and DynamoDB handles the servers, storage, replication, and scaling. There's no instance to size, no engine to patch, and no connection limit to manage, which is why it pairs naturally with Lambda and other short-lived compute. A table is a Regional resource, and DynamoDB stores its data across three Availability Zones. Requests go over HTTPS to the DynamoDB API, typically with single-digit-millisecond latency at any table size.

An item is a set of named **attributes**, up to 400 KB in total, including the attribute names. Only the key attributes are fixed. Every other attribute can differ from item to item, and values can be strings, numbers, binary, sets, lists, or nested maps up to 32 levels deep.

The trade for that scale and simplicity is the query model. DynamoDB can only retrieve items efficiently by their key or by the key of an index you defined in advance. It has no joins and no ad-hoc SQL over arbitrary columns, so you design the table around the questions the application will ask, before it asks them. When those questions aren't known yet, or change often, a relational database is usually the better fit.

DynamoDB also stores vector embeddings in **vector indexes** and searches them by similarity (since August 2026), so an application can keep embeddings next to the operational data they describe.

---

## Keys and Partitions

### The Primary Key

Every table has a **primary key** that uniquely identifies each item, in one of two forms:

- A **partition key** alone, such as `UserId`. Each value identifies one item.
- A **partition key and sort key**, such as `CustomerId` and `OrderDate`. Many items can share a partition key value as long as their sort keys differ.

Items that share a partition key value form an **item collection**. DynamoDB stores a collection's items together, ordered by sort key, so one request can return all of a customer's orders, or only those in a date range, already sorted.

### How DynamoDB Spreads Data

DynamoDB stores a table on **partitions**, units of storage and throughput that it adds automatically as the table grows or its traffic rises. It hashes each item's partition key to choose the partition. A **global secondary index** (covered below) is a second copy of the items, organized by a different key on partitions of its own.

{% include figure.html id="aws-ddb-partitions-gsi" %}

Each partition serves up to 3,000 read units and 1,000 write units per second, where a read unit is one strongly consistent read of up to 4 KB and a write unit is one write of up to 1 KB (Capacity Modes below covers units in full). The table's total capacity is the sum across partitions, so it scales without limit as long as requests spread across many partition key values. A single item can never get more than one partition's throughput. A partition key value with many items can spread across several partitions, because DynamoDB splits a large or busy item collection by sort key when the table has no local secondary indexes (covered below), but only when requests spread across the sort key range. Traffic that keeps landing on the newest sort key, as time-ordered keys do, stays on one partition and is throttled when it exceeds that partition's limits.

That's the **hot key** problem, and it comes from choosing a partition key with few values or skewed traffic:

- A `Status` key with values like `ACTIVE` and `INACTIVE` puts most of the table on a handful of keys.
- A date key such as `2026-09-25` sends every write today to one key.
- A tenant key in a multi-tenant system concentrates load on the largest tenant.

A good partition key has many distinct values that requests hit roughly evenly, such as a user, device, or order ID. DynamoDB softens moderate skew on its own. **Burst capacity** keeps up to five minutes of unused capacity on a table with capacity set in advance, for short spikes, and **adaptive capacity** shifts throughput toward busy partitions and can move an especially hot item onto a partition of its own. Neither lets a single item exceed a partition's limits, and neither can split traffic that always lands on the newest sort key. CloudWatch throttling metrics show that a table is being throttled, and **CloudWatch Contributor Insights** for DynamoDB shows which keys are most accessed and most throttled. When one key has to take more writes than a partition allows, **write sharding** spreads it across several keys, such as `EVENT#2026-09-25#0` through `#9`, with readers querying all ten and merging the results.

---

## Reading and Writing

### Operations

| Operation | What it reads | Cost |
|---|---|---|
| **GetItem** | One item by its full primary key | One read unit per 4 KB, half that for the default eventually consistent read |
| **Query** | Items in one item collection, optionally narrowed by a sort key condition such as `begins_with` or `between` | Read units for the data read, at most 1 MB per page |
| **Scan** | Every item in the table or index | Read units for the whole table |

A Query or Scan returns up to 1 MB per call, with a key to continue from for the next page. A **filter expression** removes items from the results after they're read, so it saves network transfer but not capacity. A Scan that filters a million items down to ten still pays for a million. Parallel scans split the work into segments for exports and one-off jobs, but a regular application path that needs a Scan usually means the table is missing an index.

**BatchGetItem** reads up to 100 items (16 MB) and **BatchWriteItem** writes or deletes up to 25 items (16 MB) in one request. They save round trips, not capacity, and each item succeeds or fails on its own, so the response lists any unprocessed items to retry.

### Consistency

Reads are **eventually consistent** by default. A read immediately after a write might not see it, and it costs half a read unit per 4 KB. A **strongly consistent** read always returns the latest committed write and costs a full unit. It's available on the table and on local secondary indexes, but not on global secondary indexes, which are always eventually consistent (both index types are covered below).

### Conditions and Transactions

A **condition expression** makes a write succeed only if the item is in an expected state, for example `attribute_not_exists(OrderId)` to prevent overwriting an existing order, or a version number check for optimistic locking. It's the basic tool for correctness under concurrency. A write that fails its condition still consumes write capacity for the item's size, so conditions protect correctness, not cost.

**Transactions** (`TransactWriteItems` and `TransactGetItems`) apply up to 100 actions across one or more tables in the same account and Region atomically, up to 4 MB in total. Each item in a transaction costs twice the usual read or write units, and the capacity is consumed even when the transaction is cancelled because a condition failed. Transactions are for invariants that span items, such as debiting one account and crediting another, not for every write.

---

## Secondary Indexes

An index gives the table a second way to be queried. There are two kinds:

| | Global secondary index (GSI) | Local secondary index (LSI) |
|---|---|---|
| **Key** | Any partition key and sort key, each built from up to four attributes | Same partition key as the table, different sort key |
| **When created** | Any time | Only when the table is created |
| **Per table** | 20 by default | 5 |
| **Consistency** | Eventually consistent only | Strongly consistent reads available |
| **Capacity** | Its own, separate from the table's | Shares the table's |
| **Size effect** | None on the table | Each item collection, table plus LSIs, is limited to 10 GB |

A GSI is effectively a second table that DynamoDB keeps up to date asynchronously. Every write to the base table that touches indexed attributes also writes to each affected GSI, and those writes are billed. Changing an indexed attribute's value costs two index writes, one to remove the old entry and one to add the new. In provisioned mode, where capacity is set in advance (see Capacity Modes), a GSI without enough write capacity throttles writes to the base table, so an index's capacity has to keep up with the table's.

**Projection** decides which attributes the index copies: only the keys (`KEYS_ONLY`), the keys plus named attributes (`INCLUDE`), or everything (`ALL`). Smaller projections cost less storage and write capacity, but a query that needs an attribute the index doesn't hold must fetch it from the table separately.

A GSI is **sparse** when only some items have its key attribute. Only those items appear in the index, so a GSI on an `OpenTicketPriority` attribute that's removed when a ticket closes holds just the open tickets, and queries against it stay small however large the table grows.

Because an LSI can only be added at creation and brings the 10 GB collection limit with it, choose a GSI unless the query needs strong consistency within one item collection.

---

## Modeling for Access Patterns

Relational design starts from entities and normalizes them. DynamoDB design starts from the list of **access patterns**, the specific reads and writes the application performs, and shapes keys and indexes so each pattern is a single GetItem or Query.

For an order system, that list might include getting a customer's profile, listing a customer's orders newest first, getting one order with its line items, and listing all orders in a given status. A table with partition key `PK` and sort key `SK` can serve the first three from one item collection per customer:

| PK | SK | Attributes |
|---|---|---|
| `CUSTOMER#C123` | `PROFILE` | Name, email |
| `CUSTOMER#C123` | `ORDER#2026-09-20#O789` | Total, status |
| `CUSTOMER#C123` | `ORDER#2026-09-20#O789#LINE#1` | Product, quantity |

A Query on `PK = CUSTOMER#C123` returns the profile and all orders, `begins_with(SK, "ORDER#")` returns just the orders sorted by date, and `begins_with(SK, "ORDER#2026-09-20#O789")` returns one order with its lines. A GSI on the order's status and date answers the fourth pattern, as long as each status sees modest traffic. A status key has few values, so at high write rates it becomes a hot key on the index. A sparse index holding only open orders, or a status key sharded as `PENDING#0` through `PENDING#9`, spreads that load.

Storing several entity types in one table this way is called **single-table design**. It returns related data in one request without joins, and it can update related items together in one transaction. It has costs as well. The keys are hard to read, a new access pattern can mean restructuring keys and backfilling data (though GSI keys built from several existing attributes, since November 2025, avoid the backfill for many new indexes), and analytics across entity types needs an export to another system. Separate tables per entity are easier to understand and evolve, at the cost of more requests per page. Single-table design pays off when access patterns are known and stable and request counts matter. It's a poor fit for a young application whose queries are still changing.

Large values don't belong in items either. Store big documents, images, or blobs in S3 and keep the object key in DynamoDB. Every read and write is billed by item size, so a 300 KB item costs 75 read units for a strongly consistent read of an attribute that's a few bytes long.

---

## Capacity Modes

DynamoDB measures throughput in units. A **read unit** is one strongly consistent read per second of an item up to 4 KB, or two eventually consistent reads. A **write unit** is one write per second of an item up to 1 KB. Larger items consume one unit per 4 KB read or 1 KB written, rounded up.

### On-Demand

In **on-demand** mode, the default and AWS's recommendation for most tables, you pay per request and DynamoDB scales on its own. A new on-demand table can immediately serve 4,000 writes and 12,000 reads per second, and it can always absorb up to double its previous peak without warning. Growing beyond double the previous peak within 30 minutes can be throttled while DynamoDB adds partitions.

For launches and planned events, **warm throughput** shows the reads and writes per second a table can serve immediately, and you can raise it ahead of time (**pre-warming**, a one-time charge) without changing modes. An optional **maximum throughput** per table or index caps on-demand usage, which bounds the cost of a runaway client or a retry storm. A table defaults to 40,000 read and write units per second, raisable through Service Quotas.

### Provisioned

In **provisioned** mode, you set read and write capacity per table and per GSI, and pay per hour for what you set, used or not. **Auto scaling** adjusts it toward a target utilization, commonly 70%, but it reacts over minutes, so sudden spikes above the provisioned level are throttled while it catches up. You can raise capacity at any time, but decreases are limited to 4 at the start of each day plus one more each hour.

Provisioned capacity costs less per request when it's used steadily. At US East (N. Virginia) prices, one write unit provisioned for a month costs about $0.47, and writing at that rate all month on demand costs about $1.64. Provisioned is cheaper once average utilization exceeds roughly 30% of what's provisioned, and much cheaper for flat, predictable load. **Reserved capacity** discounts provisioned units further for one- or three-year commitments, and Database Savings Plans (December 2025) cover DynamoDB usage in exchange for a one-year hourly spending commitment.

| | On-demand | Provisioned |
|---|---|---|
| **You pay for** | Each request | Capacity per hour |
| **Writes (us-east-1)** | $0.625 per million | $0.00065 per write unit-hour |
| **Reads (us-east-1)** | $0.125 per million read units | $0.00013 per read unit-hour |
| **Scaling** | Automatic, up to double the previous peak instantly | Auto scaling toward a target, over minutes |
| **Fits** | New, spiky, or idle-heavy workloads | Steady, forecastable load |

A table can switch from provisioned to on-demand up to four times in 24 hours, and back to provisioned at any time.

### Table Classes

The **Standard-Infrequent Access** table class stores data for $0.10 per GB-month instead of $0.25, but charges about 25% more per request. It suits tables where storage outweighs throughput in the bill, such as order history or audit records that are mostly kept, not read.

---

## Streams and Expiring Data

### DynamoDB Streams

A **stream** records every change to a table's items within moments of the change. Each record can hold the item's keys, its new image, its old image, or both, chosen when the stream is enabled. Each change appears in the stream exactly once, and changes to the same item appear in the order they happened. Order across different items isn't guaranteed. Records are kept for 24 hours.

Streams are how a table drives other work, such as a Lambda function that updates a search index, sends a notification, or maintains an aggregate each time an item changes. A stream is divided into **shards**, one for each of the table's partitions. Lambda processes each shard in order, and its reads from the stream are free. Other consumers pay $0.02 per 100,000 stream read requests, and no more than two processes should read a shard at once. For longer retention or more consumers, **Kinesis Data Streams for DynamoDB** sends the same changes to a Kinesis stream instead, at the cost of possible duplicates and ordering that consumers have to restore from timestamps.

### Time to Live

**Time to Live (TTL)** deletes items automatically after a timestamp stored in an attribute you choose, as epoch seconds. Deletion is free and consumes no write capacity, but it isn't prompt. Expired items are typically removed within a few days, and until then they still appear in reads, so queries filter them out by comparing the attribute to the current time. TTL deletions appear in the stream marked as service deletions, which lets a Lambda function archive expired items to S3 before they're gone.

---

## DynamoDB Accelerator

**DAX** is an in-memory cache cluster that sits in front of DynamoDB, speaks the same API through its own client, and cuts eventually consistent read latency from milliseconds to microseconds. Reads it serves from cache consume no table capacity. Writes go through DAX to the table, and strongly consistent reads pass straight through without caching. A cluster runs in your VPC, with one primary node and up to ten read replicas, and is billed per node-hour.

DAX suits read-heavy tables where the same items are read repeatedly and microseconds matter, such as a product catalog or game state. It adds little for write-heavy tables, for mostly unique reads, or for applications that need strong consistency, and a general-purpose cache like ElastiCache is the better fit when the cached data isn't only DynamoDB items.

---

## Backups and Recovery

**Point-in-time recovery (PITR)** keeps continuous backups for a recovery period you choose between 1 and 35 days, and restores to any second within it. It costs $0.20 per GB-month of table and LSI size, whatever the period. A restore always creates a **new table**, in the same or another Region. Auto scaling settings, IAM policies, alarms, tags, TTL settings, and stream settings aren't restored and must be reapplied. **On-demand backups** are full copies kept until deleted, at $0.10 per GB-month, for long-term retention. Restores are billed per GB. AWS Backup can take scheduled snapshot backups (not PITR), and with its advanced DynamoDB features turned on, copy them to other accounts and Regions.

**Deletion protection** blocks `DeleteTable` until it's turned off, which prevents the one mistake a backup can't cover quickly. Turn it on for production tables.

PITR also enables **export to S3**, full or incremental, which writes the table's data to S3 for Athena or other analytics without consuming table capacity. **Zero-ETL integrations**, which copy data continuously without a pipeline you build, can replicate a table into Amazon Redshift or OpenSearch.

**Global tables** replicate a table to other Regions with writes accepted in every Region, and replicated writes are billed in each.

---

## Security

**Encryption at rest** is always on. Tables use an AWS owned key by default, or an AWS managed or customer managed KMS key when you need to audit or control key use. Requests use TLS.

**Access control** is IAM policies on principals plus, optionally, a **resource-based policy** on the table itself for cross-account access. IAM conditions can restrict access below the table level. The `dynamodb:LeadingKeys` condition limits a principal to items whose partition key matches a value, such as the caller's identity. `dynamodb:Attributes`, combined with conditions on what a request may return, limits which attributes it can read or write. This policy lets users signed in through a Cognito identity pool read and write only their own item collection, because the policy variable `${cognito-identity.amazonaws.com:sub}` resolves to each caller's identity ID:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:111122223333:table/UserData",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["${cognito-identity.amazonaws.com:sub}"]
        }
      }
    }
  ]
}
```

**Network access** from private subnets goes through a **gateway endpoint** for DynamoDB, which is free and avoids NAT gateway processing charges, or an interface endpoint when on-premises clients need a private address.

---

## Where the Money Goes

- **Requests or provisioned capacity.** Driven by item size as much as request count, since every 1 KB written and 4 KB read is a separate unit.
- **Index writes.** Each GSI roughly adds another write per affected table write, and `ALL` projections copy entire items.
- **Storage.** $0.25 per GB-month in Standard, including index copies, or $0.10 in Standard-IA.
- **Backups.** PITR per GB of table size, and on-demand backups until deleted.
- **Global tables.** Replicated writes in every Region, plus inter-Region transfer.
- **Streams.** Free for Lambda, per request for other readers.
- **Scans.** Full-table reads on a schedule, which a GSI or an export to S3 usually replaces for less.

---

## Key Takeaways

1. **Design keys around access patterns.** DynamoDB answers the questions its keys and indexes were built for, cheaply and at any scale, and little else.
2. **Spread traffic across many partition key values.** Each partition serves 3,000 reads and 1,000 writes per second, so a low-cardinality or time-based key throttles no matter how large the table is.
3. **Query, don't scan.** Filters don't reduce cost, and a regular Scan on a request path usually means a missing index.
4. **Prefer GSIs, and project only what's queried.** Every GSI adds write cost and is eventually consistent. LSIs lock in a 10 GB collection limit at creation.
5. **Use conditions for correctness and transactions for cross-item invariants.** Transactions cost double and cover up to 100 items.
6. **Start on-demand, move steady load to provisioned.** On-demand scales to double the previous peak instantly. Provisioned is cheaper once utilization is consistently high.
7. **Streams and TTL turn a table into an event source.** Every change appears once, in order per item, for 24 hours, and TTL deletes expired items for free within days.
8. **Turn on PITR and deletion protection for production.** Restores create new tables, so plan the cutover.
