---
layout: guide
title: "Time-Series Databases"
category: Databases
subcategory: Database Types
description: "Deep dive into time-series databases—how they optimize for metrics, events, and sensor data with time-based partitioning and compression."
tags: [databases, time-series, metrics, monitoring, observability, performance]
---

## What They Are

Time-series databases optimize specifically for data indexed by time: metrics, events, sensor readings, financial prices. Every data point has a timestamp, and the primary access patterns are writing new data (which always arrives in roughly time-order) and reading data within time ranges.

General-purpose databases can store time-series data, but they're not optimized for it. Time-series workloads have unique characteristics: extremely high write throughput, append-mostly (rarely updating old data), queries over time windows, and data that becomes less valuable over time (you care about yesterday's metrics, not last year's).

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

Query: SELECT mean(value) FROM cpu_usage
       WHERE time > now() - 1h AND region = 'us-east'
       GROUP BY time(5m), host
```

Data organizes by metric name + tags, creating distinct time-series. Timestamps are the primary index. Queries aggregate across time windows (5-minute averages, hourly sums).

---

## How They Work

### Time-Based Partitioning

Data automatically partitions by time (hourly, daily, weekly chunks). This makes retention policies trivial. Deleting last month's data means dropping a partition, not scanning and deleting individual rows. It also keeps hot data (recent) separate from cold data (historical).

### Columnar Storage

Time-series databases often store data in columns rather than rows. Since queries typically ask for a specific metric across many timestamps, columnar storage allows reading just that metric's column without loading irrelevant data.

### Compression

Time-series data compresses extremely well. Sequential timestamps delta-encode (storing the difference from the previous value rather than absolute values). Similar metric values compress with run-length encoding or more sophisticated algorithms. 10:1 or 20:1 compression is typical.

### Downsampling

Older data often doesn't need full resolution. Instead of keeping every second's CPU reading for a year, aggregate to minute averages after a week, hour averages after a month. The database handles this automatically through retention policies.

### Specialized Query Functions

Time-series databases include functions for:

- **Rate calculations**: Requests per second from cumulative counters
- **Moving averages**: Smooth out noise in metrics
- **Gap filling**: Interpolate missing data points
- **Period-over-period comparisons**: Built into the query language

---

## Why They Excel

### Write Throughput

The append-mostly nature and time-partitioned storage allow ingesting millions of data points per second.

### Storage Efficiency

Compression and automatic downsampling keep storage costs manageable even with high-volume ingest.

### Time-Range Queries

Querying "metrics from the last hour" touches only recent partitions, not the entire dataset.

### Built-In Time Semantics

Operations like "group by 5-minute intervals" or "calculate the derivative" are primitive operations, not complex user-defined functions.

---

## Why They Struggle

### Non-Time-Based Queries

If you need to query by attributes other than time (find all metrics where region='us-east'), you need secondary indexes that time-series databases may or may not support well.

### Updates and Deletes

Modifying historical data often requires rewriting entire time partitions, which is an expensive operation.

### Relationships

Time-series databases store independent series. Correlating data across series happens at query time, with limited join capabilities.

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

**InfluxDB** is purpose-built for time-series, with the Flux query language and strong community adoption for DevOps metrics.

**TimescaleDB** is a PostgreSQL extension that adds time-series capabilities while retaining full SQL support, making it a good choice when you need both relational and time-series features.

**Prometheus** is the standard for Kubernetes monitoring, using a pull-based model where it scrapes metrics from targets.

**QuestDB** emphasizes extreme ingestion speed and SQL compatibility, particularly for financial data.

**Amazon Timestream** offers serverless time-series storage with automatic tiering between hot and cold storage.

---
