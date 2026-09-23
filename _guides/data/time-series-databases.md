---
layout: guide
title: "Time-Series Databases"
category: Databases
subcategory: Database Types
description: "How time-series databases handle high-volume timestamped data with time partitioning, columnar compression, retention, and downsampling, and why series cardinality is the limit to watch."
tags: [time-series, metrics, observability, compression, cardinality, practical]
---

## What They Are

Time-series databases optimize specifically for data indexed by time: metrics, events, sensor readings, financial prices. Every data point has a timestamp, and the primary access patterns are writing new data (which always arrives in roughly time-order) and reading data within time ranges.

General-purpose databases can store time-series data, but the workload has a distinctive shape. Writes arrive at very high volume and almost never update old data. Queries ask for ranges of time, usually aggregated into windows. And data loses value with age, since yesterday's metrics matter more than last year's.

---

## Data Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TIME-SERIES: cpu_usage                                                  │
│  Tags: {host: "server-1", region: "us-east"}  ← Identifies the series    │
├────────────────────────┬─────────────────────────────────────────────────┤
│  TIMESTAMP             │  VALUE                                          │
├────────────────────────┼─────────────────────────────────────────────────┤
│  2024-01-15 10:00:00   │  45.2                                           │
│  2024-01-15 10:00:01   │  47.8                                           │
│  2024-01-15 10:00:02   │  46.1                                           │
│  2024-01-15 10:00:03   │  52.3                                           │
│  ...                   │  ... (millions of points)                       │
└────────────────────────┴─────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  TIME-SERIES: cpu_usage                                                  │
│  Tags: {host: "server-2", region: "us-east"}  ← Different series         │
├────────────────────────┬─────────────────────────────────────────────────┤
│  TIMESTAMP             │  VALUE                                          │
├────────────────────────┼─────────────────────────────────────────────────┤
│  2024-01-15 10:00:00   │  22.1                                           │
│  2024-01-15 10:00:01   │  23.4                                           │
│  ...                   │  ...                                            │
└────────────────────────┴─────────────────────────────────────────────────┘

InfluxQL query:
       SELECT mean(value) FROM cpu_usage
       WHERE time > now() - 1h AND region = 'us-east'
       GROUP BY time(5m), host
```

Each combination of a metric name and tag values is a separate series. Timestamps are the primary index, and queries aggregate across time windows such as 5-minute averages or hourly sums.

---

## How They Work

### Time-Based Partitioning

Data is split into chunks by time, such as one per hour or day. Retention becomes cheap, since deleting last month's data means dropping whole chunks rather than finding and deleting individual rows. Recent, frequently queried data also stays separate from older data, which can move to cheaper storage.

### Columnar Storage

Many time-series databases store data in columns rather than rows, at least for older chunks. Queries typically ask for one metric across many timestamps, so columnar storage reads just that column.

### Compression

Time-series data compresses very well. Timestamps arriving at regular intervals are stored as differences from the previous timestamp, and differences of differences, which are usually zero. Consecutive values tend to be close to each other, so storing how they differ takes few bits. Facebook's Gorilla paper (2015) reported compressing 16-byte timestamp-and-value points to about 1.37 bytes on average with these techniques.

### Downsampling

Older data often doesn't need full resolution. Instead of keeping every second's CPU reading for a year, a system can keep minute averages after a week and hourly averages after a month. Some databases do this continuously for you, such as TimescaleDB's continuous aggregates. Others, like Prometheus, leave it to companion tools or scheduled jobs.

### Specialized Query Functions

Time-series databases include functions for:

- **Rate calculations**: Requests per second from cumulative counters
- **Moving averages**: Smooth out noise in metrics
- **Gap filling**: Interpolate missing data points
- **Period-over-period comparisons**: Built into the query language

---

## Why They Excel

### Write Throughput

Because writes almost always append to the newest chunk, time-series databases ingest hundreds of thousands of points per second on a single node, and clusters go well beyond that.

### Storage Efficiency

Compression and automatic downsampling keep storage costs manageable even with high-volume ingest.

### Time-Range Queries

Querying "metrics from the last hour" touches only recent partitions, not the entire dataset.

### Built-In Time Semantics

Operations like "group by 5-minute intervals" or "calculate the derivative" are primitive operations, not complex user-defined functions.

---

## Why They Struggle

### High Cardinality

Tags are indexed, so filtering by `region` or `host` is cheap, but every unique combination of tag values creates a new series. Tagging metrics with a user ID, request ID, or container ID can turn thousands of series into millions, and many time-series databases slow down or run out of memory as series count grows. Values with unbounded variety belong in fields or in a different store, not in tags.

### Queries That Don't Start From Time

Queries that don't filter by time, or that look up individual records by some other attribute, have no efficient path in a store organized around time.

### Updates and Deletes

Old chunks are often compressed and immutable, so correcting historical data can mean decompressing or rewriting a whole chunk.

### Relationships

Time-series databases store independent series. Correlating series, or joining them to other data such as device metadata, happens at query time and ranges from limited to unsupported, depending on the engine. SQL-based engines such as TimescaleDB are the exception.

---

## When to Use Them

Time-series databases are the right choice for:

- **Infrastructure monitoring**: CPU, memory, network metrics
- **Application performance monitoring**: Latencies, error rates, throughput
- **IoT and sensor data**: Temperature, pressure, location readings
- **Financial data**: Prices, volumes, trading activity
- **Any data where "what happened over this time period" is the primary question**

---

## When to Look Elsewhere

If your data isn't primarily accessed by time range, if you need complex relationships between records, or if your access patterns involve significant random access by non-time attributes, a time-series database will fight you.

---

## Examples

**Prometheus** is the standard metrics system for Kubernetes and cloud-native monitoring. It scrapes metrics from targets on a schedule, stores them locally, and relies on companion systems for long-term storage. **InfluxDB** is a purpose-built time-series database. Version 3, rewritten in Rust on columnar Parquet storage, is queried with SQL and InfluxQL, and the Flux language from version 2 isn't supported. **TimescaleDB** is a PostgreSQL extension that adds time partitioning and columnar compression while keeping full SQL, which suits workloads that need time-series and relational data together. **QuestDB** is a columnar, SQL-based time-series database focused on fast ingestion, common with financial market data. On AWS, **Amazon Timestream for InfluxDB** is the managed option. The original Timestream for LiveAnalytics closed to new customers in June 2025.

---
