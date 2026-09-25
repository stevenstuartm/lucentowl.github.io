---
title: "Amazon S3 for System Architects"
layout: guide
category: AWS
subcategory: Storage Services
description: "How S3 stores objects and what that means for design: buckets, keys, consistency, and conditional writes; storage classes and lifecycle rules; request scaling and multipart upload; access control, encryption, and Object Lock; versioning and replication; events and bulk operations; and where the money goes."
tags: [s3, object-storage, storage-classes, lifecycle-rules, bucket-policies, replication, fundamentals]
---

## What S3 Is

**Amazon S3** stores **objects** in **buckets**. An object is a blob of data, from zero bytes up to 50 TB, plus metadata, addressed by a **key** that is unique within its bucket. There's no directory tree. A key like `invoices/2026/09/0042.pdf` is one flat string, and the slashes only look like folders because the console and the `ListObjectsV2` API can group keys by a shared **prefix**. Applications reach objects over HTTPS through the S3 API, so S3 isn't a disk you mount. It's a service you call.

A bucket lives in one Region, which is where its data stays unless you copy it elsewhere, but its name must be unique across every AWS account in the partition. An account can create 10,000 general purpose buckets by default and can raise that to a million. Besides these **general purpose buckets**, S3 now has three other bucket types, each built for one job:

| Bucket type | Holds | For |
|---|---|---|
| **General purpose** | Objects in any storage class except Express One Zone | Almost everything |
| **Directory** | Objects in S3 Express One Zone, in one Availability Zone you choose | Very low-latency, high-request workloads |
| **Table** (S3 Tables) | Apache Iceberg tables that S3 maintains and compacts | Analytics tables queried by Athena, Redshift, Spark |
| **Vector** (S3 Vectors) | Vector embeddings with similarity search | Low-cost vector storage for retrieval-augmented generation |

This guide covers general purpose buckets unless it says otherwise. **S3 Files** (April 2026) can also mount a bucket as a shared file system for EC2, containers, and Lambda, built on Amazon EFS, for tools that need file semantics over data kept in S3.

### Consistency and Concurrent Writes

S3 has strong read-after-write consistency for every operation. Once a write or delete succeeds, every later read and list sees it, with no delay to design around.

Strong consistency doesn't stop two clients from overwriting each other, because S3 has no locks. **Conditional writes** close that gap. A `PutObject` with `If-None-Match: *` succeeds only if no object has that key yet, so two workers racing to create the same key can't both win. A `PutObject` with `If-Match: <ETag>` succeeds only if the object still has the version the client last read, which gives optimistic concurrency for read-modify-write updates. A bucket policy can require the headers so that no client can skip them.

### Durability

Every storage class is designed for 99.999999999% (eleven nines) durability. Most classes store each object redundantly across at least three Availability Zones, so they survive the loss of a whole zone. The two **One Zone** classes, S3 One Zone-IA and S3 Express One Zone, store data in a single zone and lose it if that zone is physically destroyed. Use them only for data you can recreate or have copied elsewhere.

---

## Storage Classes

Each object has a **storage class** that trades storage price against access cost and speed. Prices below are per GB-month in US East (N. Virginia):

| Class | Designed for | AZs | Minimum duration | Minimum billed size | Retrieval | Storage price |
|---|---|---|---|---|---|---|
| **Standard** | Frequently read data | 3+ | None | None | Free | $0.023 |
| **Intelligent-Tiering** | Unknown or changing access | 3+ | None | None | Free, plus a monitoring fee | $0.023 down to $0.004, by tier |
| **Express One Zone** | Single-digit-millisecond access | 1 (you choose) | None | None | Per-GB upload and retrieval charges | $0.11 |
| **Standard-IA** | Data read about once a month | 3+ | 30 days | 128 KB | Per GB | $0.0125 |
| **One Zone-IA** | Recreatable data read about once a month | 1 | 30 days | 128 KB | Per GB | $0.01 |
| **Glacier Instant Retrieval** | Archives read about once a quarter, in milliseconds | 3+ | 90 days | 128 KB | Per GB, higher than IA | $0.004 |
| **Glacier Flexible Retrieval** | Archives read about once a year, in minutes to hours | 3+ | 90 days | 40 KB overhead per object | Restore first | $0.0036 |
| **Glacier Deep Archive** | Archives read less than once a year, in hours | 3+ | 180 days | 40 KB overhead per object | Restore first | $0.00099 |

Three columns decide most choices besides price:

- **Minimum duration.** Deleting, overwriting, or moving an object out of the class before the minimum still bills the full minimum.
- **Minimum billed size.** A 10 KB object in Standard-IA is billed as 128 KB. The Glacier Flexible Retrieval and Deep Archive classes instead add 40 KB of metadata to every object, 8 KB of it at the Standard price.
- **Retrieval.** The IA and Glacier Instant Retrieval classes charge per GB read, so their low storage price only pays off for data that's rarely read.

### Where the Break-Even Falls

Retrieval fees make the right class depend on how often data is read. For 1 TB read in full once a month, Standard costs $23, Standard-IA costs $12.50 plus $10 to read it, and Glacier Instant Retrieval costs $4 plus $30. Standard-IA stops paying off at about one full read a month, and Glacier Instant Retrieval at about two reads every three months.

{% include figure.html id="aws-s3-class-breakeven" %}

### Intelligent-Tiering

**S3 Intelligent-Tiering** moves each object between tiers based on its own access history, with no retrieval fees. An object starts in the Frequent Access tier, moves to Infrequent Access after 30 days without access, and to Archive Instant Access after 90. A read moves it back to Frequent Access. Two optional tiers, Archive Access and Deep Archive Access, archive objects after 90 and 180 days, but objects in them must be restored before reading, so turn them on only for data the application can wait for.

It charges a monitoring fee of $0.0025 per 1,000 objects a month. Objects smaller than 128 KB aren't monitored or charged the fee and always stay in Frequent Access. For large objects with unpredictable access, it's the safe default. For billions of tiny objects, the monitoring fee and the lack of tiering for small objects make it a poor fit.

### Archive Retrieval

Objects in Glacier Flexible Retrieval and Glacier Deep Archive, and in Intelligent-Tiering's two archive tiers, aren't readable until a restore request creates a temporary copy. The restore tier sets the speed and the price:

| Tier | Glacier Flexible Retrieval | Glacier Deep Archive |
|---|---|---|
| **Expedited** | 1–5 minutes for objects under 250 MB | Not available |
| **Standard** | 3–5 hours | Within 12 hours |
| **Bulk** | 5–12 hours, free | Within 48 hours |

A restored copy is billed at the Standard price for as long as it's kept, on top of the archived original. Large restores are limited to roughly 1,000 restore requests per second and 1–2 PB per day per account, so a disaster recovery plan that depends on archive restores needs to budget days, not hours, for large datasets.

### Choosing a Class

```
Does the data need single-digit-millisecond latency or very high request rates?
├── Yes → Express One Zone (with a copy elsewhere if it can't be recreated)
└── No → Is the access pattern known?
    ├── No → Intelligent-Tiering (objects ≥ 128 KB)
    └── Yes → How often is each object read?
        ├── More than monthly → Standard
        ├── About monthly → Standard-IA (One Zone-IA if recreatable)
        ├── About quarterly, but must be instant → Glacier Instant Retrieval
        ├── About yearly, minutes to hours is fine → Glacier Flexible Retrieval
        └── Rarely or never, hours is fine → Glacier Deep Archive
```

---

## Lifecycle Rules

A **lifecycle configuration** on a bucket moves or deletes objects on a schedule, without code. Rules can be scoped to a prefix, object tags, or an object size range, and each can take several actions:

- **Transition** current objects to a colder class after a number of days.
- **Expire** current objects, deleting them (or, in a versioned bucket, adding a delete marker).
- **Expire noncurrent versions** a number of days after they're replaced.
- **Abort incomplete multipart uploads**, whose uploaded parts are otherwise billed forever.
- **Remove expired delete markers** that no longer hide any versions.

```json
{
  "Rules": [
    {
      "ID": "logs",
      "Filter": { "Prefix": "logs/" },
      "Status": "Enabled",
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 180, "StorageClass": "DEEP_ARCHIVE" }
      ],
      "Expiration": { "Days": 2555 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

Transitions only move down the waterfall of classes, never back up, and they have rules of their own:

- **Objects must spend 30 days in their current class before moving to Standard-IA or One Zone-IA.**
- **The minimum duration of an intermediate class still applies.** One rule can't move objects into Glacier Instant Retrieval and then out again before its 90 days are up.
- **Small objects don't transition by default.** Since September 2024, objects under 128 KB are skipped unless a rule's size filter says otherwise, because each transition is billed as a request and small objects rarely save enough to cover it.
- **Each transition is billed per object.** Archiving millions of small files can cost more in transition requests and 40 KB overheads than it saves. Aggregate small files into larger archives first.
- **Archive transitions bill from the day the rule applies,** even if the physical move happens later.

---

## Performance

### Request Rates

S3 supports at least 3,500 writes (`PUT`, `COPY`, `POST`, `DELETE`) and 5,500 reads (`GET`, `HEAD`) per second **per partitioned prefix**, and there's no limit on the number of prefixes. S3 partitions a bucket's key space automatically as load grows. While it does, requests above the current capacity get `503 Slow Down` errors, which the AWS SDKs retry with backoff. Workloads that need more throughput spread their requests across more prefixes, since each prefix adds its own capacity. A bucket reading objects under 10 prefixes in parallel can reach 55,000 reads per second.

### Large Objects

**Multipart upload** splits an object into up to 10,000 parts of 5 MiB to 5 GiB each, uploaded in parallel and retried individually, and S3 assembles them when the upload completes. A single `PutObject` tops out at 5 GB, so anything larger must use it, and AWS recommends it from about 100 MB. The AWS SDKs' transfer managers switch to multipart automatically. On the read side, **byte-range GETs** fetch pieces of an object in parallel, or only the part a reader needs.

An upload that's started and never completed or aborted leaves its parts in the bucket, billed but invisible to normal listings. The lifecycle rule above that aborts incomplete uploads after seven days is a sensible default for every bucket.

### Lower Latency and Longer Distances

**S3 Express One Zone** serves requests with single-digit-millisecond latency from a directory bucket in one Availability Zone, and suits compute placed in the same zone, such as ML training or interactive analytics reading many small objects. **S3 Transfer Acceleration** routes uploads from distant clients through the nearest CloudFront edge location and over the AWS network, for an extra $0.04 per GB (US, Europe, Japan) or $0.08 per GB elsewhere, charged only when it's faster. For repeated downloads by many users, CloudFront caching in front of the bucket is the usual answer.

S3 Select and Glacier Select, which ran SQL filters inside S3, closed to new customers on July 25, 2024. Query objects in place with Athena, or filter in the client.

---

## Access Control

### Who Can Do What

A request to S3 is allowed when the policies involved allow it and none deny it:

- **IAM policies** on users and roles say what those principals can do across buckets.
- A **bucket policy** on the bucket says who can do what to it, and is how you grant another account access or add bucket-wide rules.
- **S3 Access Points** give one shared bucket several named endpoints, each with its own policy and optionally restricted to one VPC, so each application's access rules live in a small policy of their own rather than in one large bucket policy.

Two defaults, applied to every new bucket since April 2023, remove the most common historical leaks. **Block Public Access** is on, overriding any policy or ACL that would make data public. And **Object Ownership** is set to bucket owner enforced, which disables ACLs so that permissions come from policies alone. Keep Block Public Access on at the account level too, and serve public content through CloudFront rather than a public bucket.

A least-privilege read policy for one prefix grants `s3:GetObject` on the objects and `s3:ListBucket` on the bucket, limited to that prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::orders-data/app-data/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::orders-data",
      "Condition": { "StringLike": { "s3:prefix": "app-data/*" } }
    }
  ]
}
```

A **presigned URL** lets someone without AWS credentials upload or download one object for a limited time, signed with the permissions of whoever generated it. It's the standard way for a browser or mobile app to upload straight to S3 without the file passing through your servers. Keep expirations short, and validate the request before generating the URL.

### Encryption

Every object written since January 5, 2023 is encrypted at rest. S3 applies the bucket's default encryption automatically, so a bucket policy that rejects uploads without an encryption header is no longer needed, and can break clients that rely on the default.

| Option | Keys | Use when |
|---|---|---|
| **SSE-S3** (default) | Managed entirely by S3 | Encryption at rest is the only requirement |
| **SSE-KMS** | A KMS key you control | You need key-level access control, key usage audit in CloudTrail, or the ability to revoke access by disabling the key |
| **DSSE-KMS** | Two layers of encryption, one with a KMS key | A compliance rule requires dual-layer encryption |
| **SSE-C** | Keys you send with every request | Rarely. Disabled by default on new buckets since April 2026 |

SSE-KMS calls KMS on reads and writes, which adds per-request KMS charges and counts against KMS request quotas. Turn on **S3 Bucket Keys** with SSE-KMS. S3 then uses a short-lived bucket-level key derived from the KMS key, which cuts KMS calls by up to 99%.

For encryption in transit, deny any request that doesn't use TLS:

```json
{
  "Sid": "DenyInsecureTransport",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::orders-data", "arn:aws:s3:::orders-data/*"],
  "Condition": { "Bool": { "aws:SecureTransport": "false" } }
}
```

### Network Paths

Instances in a VPC reach S3 over the Region's public endpoints unless the VPC has an S3 endpoint. A **gateway endpoint** is free and keeps S3 traffic off NAT gateways, which otherwise charge per GB processed. A bucket policy can then deny requests that don't arrive through a specific endpoint with the `aws:SourceVpce` condition, though such a policy also blocks the console and any caller outside that VPC, including administrators.

### Object Lock

**Object Lock** stores objects as write once, read many (WORM), so they can't be deleted or overwritten for a retention period. It needs versioning, and since November 2023 it can be turned on for existing buckets as well as new ones.

- **Governance mode** blocks deletion except by principals with a special permission to bypass it.
- **Compliance mode** blocks deletion by everyone, including the root user, until the retention period ends, and the period can't be shortened.
- A **legal hold** blocks deletion with no end date until someone removes the hold.

Compliance mode is how S3 meets regulatory WORM requirements and protects backups from ransomware that has stolen administrator credentials. It's also irreversible for the objects it covers, so test retention settings on a separate bucket first.

---

## Versioning and Replication

### Versioning

With **versioning** on, every overwrite creates a new version and every delete adds a **delete marker** instead of removing data, so any earlier version can be read or restored by its version ID. Versioning can be suspended but never fully turned off once enabled. Every version is billed as a full object, so a versioned bucket needs a lifecycle rule that expires noncurrent versions, or its cost grows with every overwrite. **MFA Delete** additionally requires an MFA code, from the root user, to delete a version permanently or change the versioning state.

### Replication

**S3 Replication** copies new objects from one bucket to another asynchronously, either to another Region (**Cross-Region Replication**) or within the same Region (**Same-Region Replication**), in the same account or a different one. Both buckets need versioning. A rule can filter by prefix or tag, change the storage class or owner of the replicas, and optionally replicate delete markers.

- Replication applies to objects written after the rule exists. **S3 Batch Replication** copies existing objects and retries failed ones.
- **Replication Time Control** replicates 99.99% of objects within 15 minutes under an SLA, and adds replication metrics and notifications.
- Cross-Region Replication pays for inter-Region data transfer as well as storage and requests in the destination.

Replication is the mechanism behind multi-Region designs and backup copies in another account, which pair it with Object Lock or a separate owner so the copy survives a compromised source account.

---

## Events and Bulk Operations

**Event notifications** send a message when objects are created, deleted, restored, transitioned, or replicated, to SQS, SNS, Lambda, or EventBridge. Delivery is at least once and usually within seconds, but sometimes a minute or more, so consumers must tolerate duplicates and late arrivals. Sending events to EventBridge instead of directly to a target allows richer filtering, several targets per event, and targets such as SQS FIFO queues that direct notifications don't support. A function triggered by uploads that writes back to the same bucket and prefix triggers itself indefinitely, so write output to another bucket or prefix.

For questions about a whole bucket, listing it isn't the answer. `ListObjectsV2` returns 1,000 keys per request, so repeatedly listing a bucket of billions of objects is slow and billed per request. S3 offers purpose-built alternatives:

| Tool | What it gives you | Freshness |
|---|---|---|
| **S3 Inventory** | A CSV, ORC, or Parquet file listing every object and its size, class, encryption, and replication status | Daily or weekly |
| **S3 Metadata** | Apache Iceberg tables of every object's metadata plus a journal of changes, queryable with Athena | Near real time |
| **S3 Storage Lens** | Account- and organization-wide usage and activity metrics, with free and paid tiers | Daily |
| **S3 Batch Operations** | One job that copies, tags, restores, re-encrypts, or invokes Lambda on millions of listed objects, for $0.25 per job plus $1 per million objects | On demand |

---

## Where the Money Goes

Storage is often not the largest line on an S3 bill. The other charges scale with how the data is used:

- **Requests.** Standard charges $0.005 per 1,000 writes and lists and $0.0004 per 1,000 reads. A workload that reads a 1 TB dataset a billion times a month pays $23 for storage and $400 for requests. Writing a million 1 KB files costs $5 in requests to store 1 GB. Batch small records into larger objects.
- **Data transfer.** Data leaving AWS to the internet costs up to $0.09 per GB after a free 100 GB a month across services. Transfer from S3 to CloudFront is free, and so is transfer to EC2 in the same Region. Traffic from private subnets that goes through a NAT gateway pays that gateway's per-GB charge, which a gateway endpoint avoids.
- **Retrieval, minimums, and monitoring.** IA and Glacier retrieval fees, early deletion charges, per-object Glacier overhead, and Intelligent-Tiering's monitoring fee.
- **Replication.** Inter-Region transfer and a second copy of the storage.
- **Leftovers.** Noncurrent versions, incomplete multipart uploads, and restored archive copies, all billed until a rule removes them.

---

## Common Pitfalls

### Versioning With No Expiration Rule

Turning on versioning without a noncurrent-version expiration rule keeps every overwrite forever. A frequently updated object can quietly accumulate hundreds of billed versions, and the cost only shows up months later. Add the expiration rule when you turn on versioning.

### Moving Frequently Read Data to a Colder Class

A lifecycle rule written on the assumption that data goes cold after 30 days turns expensive if it doesn't, because every read of an IA or Glacier Instant Retrieval object pays a retrieval fee. When the access pattern isn't known, measure it with S3 Storage Class Analysis first, or use Intelligent-Tiering.

### Archiving Many Small Objects

Moving millions of small files to Glacier Flexible Retrieval or Deep Archive pays a transition request per object and 40 KB of overhead per object. For objects much smaller than 40 KB, the overhead alone can cost more than leaving them in Standard. Bundle them into larger archives first.

### A One Zone Class as the Only Copy

One Zone-IA and Express One Zone lose data if their zone is destroyed. They suit derived data, caches, and replicas, but not the only copy of anything that can't be regenerated.

---

## Key Takeaways

1. **S3 is a flat, strongly consistent key-value store for objects up to 50 TB.** Prefixes only look like folders, and conditional writes provide the concurrency control that consistency alone doesn't.
2. **Choose a storage class by how often data is read.** Retrieval fees, minimum durations, and minimum billed sizes decide the break-even, and Intelligent-Tiering is the default when the pattern is unknown.
3. **Lifecycle rules do the housekeeping.** Transition cold data, expire noncurrent versions, and abort incomplete multipart uploads on every bucket.
4. **Throughput scales per prefix.** Spread heavy workloads across prefixes, retry `503 Slow Down` with backoff, and use multipart upload and byte-range reads for large objects.
5. **Access is policy-driven.** Block Public Access and disabled ACLs are the defaults. Use IAM policies, bucket policies, and access points, and presigned URLs for clients without credentials.
6. **Encryption at rest is automatic.** Choose SSE-KMS with Bucket Keys when you need control over keys, and deny requests without TLS.
7. **Versioning, Object Lock, and replication protect data in layers.** Versioning undoes mistakes, Object Lock stops deletion, and replication keeps a copy somewhere else.
8. **Requests, transfer, and leftovers can outweigh storage.** Watch request counts, egress, NAT charges, noncurrent versions, and incomplete uploads.
