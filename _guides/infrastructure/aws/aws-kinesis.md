---
title: "Amazon Kinesis Data Streams and Data Firehose for System Architects"
layout: guide
category: AWS
subcategory: Application Integration & Messaging
description: "How to move streaming data on AWS: Kinesis Data Streams shards, partition keys, ordering, retention, and replay; On-demand and provisioned capacity; shared and enhanced fan-out consumers; delivery to S3 and Iceberg tables; Amazon Data Firehose buffering and transformation; choosing a stream, a queue, or MSK; monitoring; and cost."
tags: [kinesis-data-streams, data-firehose, event-streaming, shards, partition-keys, enhanced-fan-out, fundamentals]
---

## Streams and Queues

A **queue** hands each message to one consumer and deletes it once processed. A **stream** is an ordered log. Records are appended to it and kept for a set period, whether or not anyone has read them, and every consumer reads the whole log at its own pace, keeping its own place. That difference decides most of what follows:

- Several applications can read the same records independently, such as a fraud detector, a dashboard, and an archive job, without the producer sending anything twice.
- Records with the same key are read in the order they were written.
- A consumer can go back and **replay** the log, to recover from a bug or to fill a new system with history.
- A slow consumer falls behind without holding anyone else up, and it only loses data if it falls further behind than the retention period.

AWS's managed services for this are **Amazon Kinesis Data Streams**, the stream itself, and **Amazon Data Firehose** (called Kinesis Data Firehose until February 2024), which loads streaming data into S3, warehouses, and search and monitoring tools without any consumer code. Both are Regional, and their quotas are per account per Region. Two relatives are out of this guide's scope. **Amazon MSK** runs Apache Kafka, the open-source equivalent of a stream, and **Amazon Managed Service for Apache Flink** (formerly Kinesis Data Analytics) runs stream-processing applications. The SQL flavor of Kinesis Data Analytics ended support in January 2026.

---

## Kinesis Data Streams

A producer writes a **record**, a blob of data up to 10 MiB (mebibytes, about 10.5 MB) with a **partition key** attached. A stream is divided into **shards**, and a hash of the partition key decides which shard a record goes to, so all records with the same key land in the same shard. Within a shard, each record gets a **sequence number**, and records are stored and read in that order. Order is guaranteed only within a shard, which in practice means per partition key.

Records stay in the stream for its **retention period**, 24 hours by default and up to 365 days, and are then deleted whether or not they were read. Each consumer tracks its own position in each shard, often called a **checkpoint**, and resumes from there after a restart.

{% include figure.html id="aws-kds-shards-consumers" %}

A shard is also the unit of capacity. Each shard accepts writes of up to 1 MB per second or 1,000 records per second, whichever comes first, and serves reads of up to 2 MB per second. Records larger than 1 MiB are allowed as occasional bursts.

Producers usually send batches with `PutRecords`, up to 500 records per call. A batch isn't all-or-nothing. The response lists which records failed, typically with a throttling error, and the producer must retry just those, with backoff. The **Kinesis Producer Library** (KPL) handles batching and retries, and also **aggregates** many small records into one Kinesis record, which lets a shard carry more than 1,000 small records per second, and since writes are billed per record or per payload unit, fewer, larger records usually cost less.

### Capacity Modes

A stream uses one of three modes, and you can switch a stream between on-demand and provisioned twice in 24 hours:

| | On-demand Standard | On-demand Advantage | Provisioned |
|---|---|---|---|
| **Capacity** | Scales on its own. Handles up to double the peak write rate of the last 30 days without throttling. | Same scaling, plus **warm throughput**, capacity you ask for ahead of a known spike so it doesn't wait for scaling, at no extra charge | You choose the shard count and change it |
| **Starts at** | 4 MB/s write, 8 MB/s read | Same | Your shard count |
| **Largest stream** | 10 GB/s write in us-east-1, us-west-2, and eu-west-1, 200 MB/s elsewhere by default | Same | No hard limit, within the account's shard quota (20,000 in the largest Regions, raisable) |
| **Billing** | Per stream-hour, plus per GB written and read | Per GB written and read, at least 60% below Standard, with no stream-hour charge | Per shard-hour, plus per 25 KB of data written |
| **Commitment** | None | An account-wide minimum of 25 MiB/s written and 25 MiB/s read across all on-demand streams in the Region | None |

On-demand Advantage isn't a per-stream choice. It's an account setting that changes how every on-demand stream in the Region is billed, which pays off for accounts with steady, high volume or hundreds of streams. On-demand Standard suits new or unpredictable streams. Provisioned suits steady, well-understood traffic, and it gives fine control over which keys share a shard.

In provisioned mode, you change capacity with `UpdateShardCount`, or by splitting and merging individual shards. A shard that's split or merged closes, and its records must be read before its children's to keep each key in order. The KCL and Lambda handle that ordering for you.

One limit applies in every mode. A single partition key always lands in one shard, so no key can exceed one shard's write limit of 1 MB or 1,000 records per second. On-demand scaling adds shards as traffic grows, but no amount of scaling spreads one hot key (see Choosing a Partition Key).

---

## Reading a Stream

Consumers read in one of two ways:

- **Shared throughput.** Consumers call `GetRecords` on each shard, and all of them together share that shard's 2 MB per second and five calls per second. Two or three consumers fit. More start throttling each other and falling behind.
- **Enhanced fan-out.** A registered consumer gets its own 2 MB per second from every shard, and Kinesis pushes records to it over a long-lived connection instead of waiting to be polled, typically within about 70 milliseconds. A stream can have 20 enhanced fan-out consumers, or 50 under On-demand Advantage.

Several kinds of consumers read streams:

| Consumer | How it reads |
|---|---|
| **Lambda** | An event source mapping, a poller that Lambda runs for you, reads each shard or subscribes with enhanced fan-out, and invokes the function with batches of records in order |
| **Kinesis Client Library (KCL)** | A library for long-running consumer applications. It balances shards across the application's workers and stores checkpoints in a DynamoDB table |
| **Managed Service for Apache Flink** | Runs stateful stream processing, such as windowed aggregations and joins |
| **Firehose** | Reads the stream and delivers it to a destination (see below) |

Delivery is **at least once**. A producer that retries after a timeout may write a record twice, and a consumer that crashes before checkpointing processes some records again when it restarts. Consumers need to be **idempotent**, producing the same result when they see a record twice, for example by keying writes on an ID carried in the record.

A record that always fails, a **poison record**, behaves differently by consumer, and either default can surprise:

- **Lambda** retries a failing batch by default, and because each shard is read in order, every record behind it waits, for up to a week. The event source mapping's retry limit, maximum record age, and on-failure destination bound that wait and keep a record of what was skipped.
- **The KCL** skips a batch whose processing code throws, and never delivers it again, so a failure silently loses records unless the application catches the exception and handles the record itself.

---

## Choosing a Partition Key

The partition key decides both ordering and load, so it's the main design decision for a stream:

- Use the entity whose events must stay in order, such as a customer ID, device ID, or account number. Records for different entities may be read out of order relative to each other, which is usually fine.
- Choose a key with many distinct values, so the hash spreads records evenly. A key like log level or event type, with a handful of values, puts all traffic on a handful of shards.
- Watch for single keys with extreme volume, such as one very large customer, since one key's traffic can't be spread.

When records don't need ordering at all, as with logs, metrics, or telemetry, an on-demand stream can choose the placement itself. With **service-managed partition keys** (since September 2026, in the latest SDKs and KPL), a producer omits the partition key and Kinesis spreads records across shards by available capacity, so no key can run hot.

When only some keys are hot, one hot key can be spread by adding a suffix, such as `customer-42-3` with a suffix from 0 to 9, which splits its records across up to ten shards. The price is order, since that customer's records are no longer read in sequence. Do this only for keys that don't need ordering, or have consumers put the records back in order themselves.

---

## Delivering a Stream to S3

Two services load streaming data into S3 without consumer code.

**Kinesis Data Streams delivery** (since August 2026) writes a stream straight to S3 from the stream itself, on on-demand streams only:

- **Streaming tables** write the records into Apache Iceberg tables in Amazon S3 Tables. Iceberg is an open table format that lets many query engines treat files in S3 as database tables, and S3 Tables is S3's managed storage for them. Records are converted to Parquet, a columnar file format, and **compacted**, merged into fewer large files, since thousands of tiny files make queries slow. They're queryable by Athena, EMR, Redshift, or any Iceberg engine within minutes.
- **General purpose S3 delivery** writes the records to an ordinary bucket in their original format, batched into larger objects with optional compression, for archives and batch processing.

Delivery arrives within a freshness window of 5 to 15 minutes, doesn't use any of the stream's read capacity, and delivers each shard's records exactly once. The destination must be in the same Region. Delivered data is encrypted with S3-managed keys by default, and a KMS key, if you choose one, must be customer managed. A stream encrypted with the AWS managed key can't be a delivery source at all, so a stream that needs encryption and delivery must use a customer managed key. Streaming tables also need the records' schema in the AWS Glue Schema Registry, a catalog of record formats that delivery uses to convert records into table columns, plus an S3 dead-letter location for records that can't be delivered, with the stream, table bucket, and registry all in one account.

**Amazon Data Firehose** is the older and broader option. It accepts records sent directly by producers (up to 1,000 KB each) or reads them from a Kinesis data stream, and delivers them to S3, Iceberg tables, Redshift, OpenSearch, Snowflake, Splunk, any HTTPS endpoint, or monitoring partners like Datadog and New Relic. It can also read an MSK topic and deliver it to S3. Along the way it can:

- **Buffer** records until a size (1 to 128 MB for S3) or an interval (0 to 900 seconds, 300 by default) is reached, whichever comes first. Larger buffers mean fewer, larger S3 objects, which are cheaper to write and faster to query. A zero interval delivers within seconds to most destinations.
- **Transform** records with a Lambda function, such as parsing log lines or dropping fields.
- **Convert** JSON to Parquet or ORC, columnar formats that analytics engines scan far faster than JSON.
- **Partition** S3 output by fields in the data, such as `customer_id=42/date=2026-09-25/`, so queries read only the partitions they need.
- **Back up** the source data, or just the records it failed to deliver, to S3.

Firehose delivers at least once, so duplicates are possible at the destination. When a destination stays unavailable, what happens depends on the source. Records sent directly to Firehose are retried for a limited time, up to 24 hours for S3, and then discarded, which is why the failed-record backup matters. Records read from a Kinesis stream or MSK topic are retried for as long as the source still holds them.

Choose Kinesis delivery for a plain archive or Iceberg tables fed from an on-demand stream. Choose Firehose when producers write directly without a stream, when the destination isn't S3, or when records need transforming, converting, or partitioning on the way.

---

## Kinesis, SQS, or MSK

| | Kinesis Data Streams | SQS | Amazon MSK |
|---|---|---|---|
| **Model** | Ordered log with retention | Queue, messages deleted once processed | Ordered log with retention (Kafka) |
| **Several consumers of the same data** | Yes, each at its own position | No. Each message goes to one consumer, so fanout needs SNS or several queues | Yes |
| **Order** | Per partition key | Per message group, on FIFO queues | Per partition key |
| **Replay** | Within retention, up to 365 days | No | Within retention |
| **Consumer failure** | Depends on the consumer, which either blocks the shard or skips the record (see Reading a Stream) | Standard queues retry a failing message alone. On FIFO queues it holds up its message group. Either can move it to a dead-letter queue | Depends on the consumer, as with Kinesis |
| **Scaling unit** | Shards, or on-demand | None to manage | Brokers and partitions, or MSK Serverless |

Use **SQS** for work items that each need doing once, by whichever worker is free, where one bad message shouldn't block others. Use **Kinesis Data Streams** when several applications need the same records, when order per key matters at high volume, or when you need replay. Use **MSK** when you already run Kafka, need the Kafka ecosystem of connectors and stream processors, or need retention and throughput patterns Kinesis doesn't offer.

---

## Security

- **Access.** IAM policies grant `kinesis:PutRecords` to producers and read actions to consumers on specific stream ARNs. A **resource policy** on a stream or consumer lets other accounts read or write it directly.
- **Encryption at rest.** Kinesis Data Streams encrypts records with a KMS key only once you turn on server-side encryption for the stream, using the AWS managed key or your own. Records written before that stay unencrypted. Sharing an encrypted stream with another account requires a customer managed key. Firehose can encrypt the data it holds with a KMS key, and writes to S3 using the destination bucket's encryption or a key you choose.
- **Private access.** Interface VPC endpoints let producers and consumers in private subnets reach both services without a NAT gateway.

---

## Monitoring

| Metric | What it shows |
|---|---|
| `GetRecords.IteratorAgeMilliseconds` | How far behind the newest record a shared-throughput consumer is. The key alarm, since a consumer falling further behind than retention loses data. |
| `SubscribeToShardEvent.MillisBehindLatest` | The same, for an enhanced fan-out consumer |
| `WriteProvisionedThroughputExceeded` | Writes throttled, usually by a hot key or a traffic jump past on-demand's doubling |
| `ReadProvisionedThroughputExceeded` | Shared-throughput reads throttled, usually by too many consumers |
| Firehose `DeliveryToS3.DataFreshness` | Age of the oldest record not yet delivered to S3 |

Stream-level metrics hide a single hot shard. **Enhanced shard-level monitoring** adds per-shard metrics at extra cost, for diagnosing uneven keys.

---

## Where the Money Goes

| Kinesis Data Streams (us-east-1) | On-demand Standard | On-demand Advantage | Provisioned |
|---|---|---|---|
| **Capacity** | $0.04 per stream-hour | No charge | $0.015 per shard-hour |
| **Writes** | $0.08 per GB, each record rounded up to 1 KB | $0.032 per GB, rounded up to 1 KB | $0.014 per million 25 KB units |
| **Reads** | $0.04 per GB | $0.016 per GB | Included for shared throughput |
| **Enhanced fan-out** | $0.04 per GB read | No extra charge | $0.015 per consumer-shard-hour, plus $0.013 per GB |
| **Delivery to S3 / streaming tables** | $0.0275 / $0.035 per GB | $0.011 / $0.014 per GB | Not available |

Retention beyond 24 hours costs extra in every mode, and reading records older than 7 days carries its own charge. **Firehose** charges $0.029 per GB for data sent directly or read from a Kinesis stream, rounding every record up to 5 KB, and $0.055 per GB from MSK with no rounding. Format conversion, dynamic partitioning, and delivery into a VPC add their own charges.

The rounding rules matter most for small records. Provisioned streams bill writes in 25 KB units, with every record at least one unit, so a 1 KB record costs a full unit. A stream writing 1,000 records of 1 KB per second, 1 MB per second or about 2.6 TB in a 30-day month, with one consumer, costs roughly:

- **Provisioned**, with two shards for headroom, about $22 for shards and $36 for 2.6 billion write units, around **$58 a month**.
- **On-demand Standard**, about $29 for the stream, $207 for writes, and $104 for reads, around **$340 a month**.
- **Firehose** reading the same records bills every 1 KB record as 5 KB, about $376 a month, five times what the data volume suggests. Combining records into larger ones before sending avoids the rounding.

On-demand costs more for steady traffic and saves money and effort for traffic that's spiky, idle much of the time, or hard to predict. On-demand Advantage narrows the gap only for accounts that reach its 25 MiB/s minimum, which is 25 times the stream in this example.

---

## Key Takeaways

- A stream is an ordered log that every consumer reads at its own pace, with replay within retention. Use it when several applications need the same records or order per key matters, and a queue when each item just needs doing once.
- The partition key decides both order and load. Pick a high-cardinality key that matches the entity whose order matters, since one key can never exceed one shard's 1 MB or 1,000 records per second. When order doesn't matter, let an on-demand stream place records itself.
- On-demand Standard needs no planning and costs more for steady load. Provisioned is cheapest for predictable traffic. On-demand Advantage cuts on-demand rates for accounts with high, steady volume.
- Beyond two or three consumers, use enhanced fan-out. Make consumers idempotent, and decide what happens to a record that keeps failing, since Lambda blocks the shard behind it and the KCL skips it by default.
- Deliver to S3 or Iceberg with Kinesis delivery on on-demand streams, or with Firehose when producers write directly, the destination isn't S3, or records need transforming or partitioning.
- Alarm on iterator age, and mind the rounding rules: 1 KB per record on on-demand writes, 25 KB units on provisioned, 5 KB on Firehose.
