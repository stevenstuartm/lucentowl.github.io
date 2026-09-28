---
title: "AWS CloudWatch for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "How CloudWatch collects, stores, queries, and alarms on AWS metrics and logs: metric identity and cardinality, classic versus OpenTelemetry metrics, alarm evaluation, log classes and retention, Logs Insights, application and container monitoring, cross-account observability, and what drives the bill."
tags: [cloudwatch, logs-insights, alarms, opentelemetry, embedded-metric-format, cross-account-observability, fundamentals]
---

## What CloudWatch Does

Amazon CloudWatch is where AWS services and your own applications send their telemetry, and where you query it, graph it, and alarm on it. It has two stores at its core:

- **Metrics** are numeric time series, such as an instance's CPU utilization or an API's request count, stored at fixed resolutions for 15 months.
- **Logs** are timestamped text or JSON events, such as Lambda output or load balancer access logs, stored for as long as you choose.

**Alarms** watch metrics or log queries and act when they cross a threshold, and **dashboards** put graphs of both side by side. Traces, the third kind of telemetry, go through AWS X-Ray and appear in the same console.

Everything in CloudWatch is Regional. A metric exists only in the Region where it was published, a log group lives in one Region, and an alarm watches data in its own Region. Seeing several Regions or accounts together takes the cross-account and cross-Region features covered at the end.

---

## Metrics

### What makes a metric

A metric is identified by a **namespace**, a **name**, and up to 30 **dimensions**, which are name-value pairs. `AWS/EC2` is a namespace, `CPUUtilization` a name, and `InstanceId=i-0abc` a dimension, and together they name one time series. Each unique combination of dimension values is a separate metric. Publishing `ResponseTime` with a `Service` dimension of 5 values, an `Endpoint` of 20, and a `StatusCode` of 5 creates up to 500 metrics, and a dimension like `UserId` creates one per user. Custom metrics are billed per metric, so this **cardinality**, the number of distinct combinations, is what sets their cost.

Metrics can't be deleted. A metric that stops receiving data expires 15 months after its last data point. CloudWatch keeps detail for a limited time and then rolls it up:

| Data point period | Kept for |
| --- | --- |
| Under 60 seconds (high-resolution custom metrics) | 3 hours |
| 1 minute | 15 days, then available at 5 minutes |
| 5 minutes | 63 days, then available at 1 hour |
| 1 hour | 455 days (15 months) |

Queries summarize data points over a **period** with a **statistic**, such as Average, Sum, Maximum, or a percentile like p99. Percentiles show the slow tail that an average hides, but CloudWatch can compute them only from raw data points. A custom metric published as pre-aggregated statistic sets, which send only the minimum, maximum, sum, and count, generally loses its percentiles.

### Where metrics come from

AWS services publish **vended metrics** automatically and at no charge, such as Lambda invocations and errors or load balancer response times. EC2 publishes its basic metrics every 5 minutes, and **detailed monitoring**, at extra cost, publishes them every minute. EC2 can't see inside the guest operating system, so memory and disk-space utilization aren't among its metrics.

Everything else is a **custom metric**, published in one of these ways:

- **`PutMetricData`** calls from your code, charged per call as well as per metric.
- **The CloudWatch agent**, a process on EC2 instances, on-premises servers, or in containers, which publishes operating system metrics such as memory and disk use, and ships log files.
- **Embedded metric format (EMF)**, described below, which turns structured log lines into metrics.
- **OpenTelemetry**, sent over the OpenTelemetry Protocol (OTLP) from an OpenTelemetry SDK or collector.

A custom metric is standard resolution, one data point per minute, unless you publish it as high resolution, with data points as often as every second.

### Classic metrics and OpenTelemetry metrics

Since June 16, 2026, CloudWatch stores metrics in two forms, priced differently:

| | Classic metrics | OpenTelemetry metrics |
| --- | --- | --- |
| **Sent with** | `PutMetricData`, the CloudWatch agent, EMF | OTLP from OpenTelemetry SDKs and collectors |
| **Identity** | Namespace, name, up to 30 dimensions | Name and up to 150 labels |
| **Queried with** | Metric math, which does arithmetic across metrics, and Metrics Insights, a SQL-like language | PromQL, the Prometheus query language, in Query Studio, the console's PromQL editor, or through a Prometheus-compatible API |
| **Billed** | Per metric per month, $0.30 each for the first 10,000, less at higher volumes | $0.50 per GB ingested, with 15 months of storage included |
| **Queries** | Console free, API per 1,000 metrics requested | Console free, API $0.01 per million samples scanned |

AWS documents OpenTelemetry metrics as the recommended form for new metrics. Because it bills by volume rather than by distinct series, a label such as a pod name costs only the bytes it adds, whereas the same dimension on a classic metric multiplies the metric count. Vended metrics from AWS services can join them in PromQL queries once **OTel enrichment** is turned on, per account and Region, which adds each resource's ARN and tags as labels and is billed at the OpenTelemetry ingestion rate. The classic versions of those metrics are unchanged. Classic metrics remain fully supported, and every alarm and dashboard built before the April 2026 preview uses them.

### Embedded metric format

EMF lets code emit metrics by writing a log line. The line carries a `_aws` block that says which of its fields are metrics and which are dimensions, and CloudWatch Logs extracts the metrics asynchronously when the line arrives:

```json
{
  "_aws": {
    "Timestamp": 1790000000000,
    "CloudWatchMetrics": [{
      "Namespace": "Orders",
      "Dimensions": [["Service", "OrderType"]],
      "Metrics": [{ "Name": "ProcessingTime", "Unit": "Milliseconds" }]
    }]
  },
  "Service": "checkout",
  "OrderType": "express",
  "ProcessingTime": 184,
  "OrderId": "o-7731"
}
```

The same event stays in the log with its other fields, such as `OrderId`, which isn't a dimension, so a spike in the metric can be traced to the individual requests with a log query. EMF suits Lambda functions and containers, where a synchronous `PutMetricData` call would add latency to every request. It costs the log ingestion plus the custom metrics it creates, and it works only in log groups of the Standard class, described under Logs.

---

## Alarms

### How an alarm evaluates

An alarm is in one of three states: `OK`, `ALARM`, or `INSUFFICIENT_DATA`. Each **period**, it compares the latest data point with its threshold. It looks at the last N data points, its **evaluation periods**, and goes to `ALARM` when M of them breach, its **datapoints to alarm**. A "3 out of 5" alarm on a 1-minute metric fires when any three of the last five minutes breach, which tolerates a single spike without waiting for five bad minutes in a row.

An alarm acts only when its state changes, not while it stays in a state. The exception is an Auto Scaling action, which repeats every minute while the alarm stays in `ALARM`. An alarm can:

- notify an SNS topic, which fans the message out to email, chat, or other subscribers
- invoke a Lambda function, the simplest way to run custom remediation
- stop, terminate, reboot, or recover an EC2 instance
- scale an Auto Scaling group
- open an OpsItem, a tracked operational issue in Systems Manager, or an incident in Incident Manager
- start a CloudWatch investigation, an AI-assisted analysis of related telemetry

Every state change is also published to EventBridge, the AWS event bus, so any other automation can react to it.

### Missing data

Metrics don't always arrive. Some are published only when something happens, such as DynamoDB's `ThrottledRequests`, and others stop because the thing publishing them died. Each alarm chooses how to treat a missing data point:

| Setting | Treats missing data as | Suits |
| --- | --- | --- |
| `missing` (default) | Nothing. If every point in the range is missing, the alarm goes to `INSUFFICIENT_DATA` | Most metrics |
| `notBreaching` | Within the threshold | Metrics published only when something goes wrong, such as error counts |
| `breaching` | Over the threshold | Heartbeats and other metrics whose absence is itself the problem |
| `ignore` | A reason to keep the current state | Metrics with gaps that mean nothing either way |

Alarms on metrics in the `AWS/DynamoDB` namespace default to `ignore`. A missing-data setting that doesn't match the metric's shape is the usual cause of an alarm that never fires or never clears.

### Kinds of alarm

Alarms come in several kinds, depending on what they watch:

| Kind | Watches | Notes |
| --- | --- | --- |
| **Metric alarm** | One metric, a metric math expression such as errors divided by requests, or a Metrics Insights query | A Metrics Insights query can group metrics by resource tag and alarm on each group, once resource tags on telemetry are turned on |
| **Composite alarm** | The states of other alarms, combined with a rule such as "latency high AND error rate high" | Can notify, open OpsItems and incidents, and start investigations, but can't take EC2 or Auto Scaling actions |
| **Log alarm** | The results of a Logs Insights query run on a schedule | No metric filter needed, but each run is charged for the data it scans |
| **PromQL alarm** | A PromQL query over OpenTelemetry metrics | Tracks each breaching series separately |

A metric alarm's threshold is either a fixed value or an **anomaly detection** band. Anomaly detection trains a model on up to two weeks of the metric's history, learning its trend and its hourly, daily, and weekly patterns, and alarms when the value leaves the band of expected values. A wider band gives fewer false alarms and misses smaller anomalies. Periods such as deployments can be excluded from training.

A composite alarm alerts only when its rule is true, so paging on the composite rather than on each symptom turns five related alarms into one page.

Standard alarms cost $0.10 per metric per month, high-resolution alarms, with 10- or 30-second periods, $0.30, and composite alarms $0.50 each. An anomaly detection alarm is billed as three metrics, since it also evaluates the band's upper and lower bounds. Log alarms and PromQL alarms add the cost of the queries they run.

---

## Logs

### Log groups and retention

Log events arrive in **log streams**, one per source such as a container or a Lambda execution environment (one running instance of a function), and streams belong to a **log group**, which holds the settings. Retention is set per log group, from one day to ten years. A new log group's default is to **never expire**, so logs accumulate and are billed for storage indefinitely until someone sets a retention period.

### Working with logs

**Logs Insights** queries log groups interactively in one of three languages: its own pipe-based query language, OpenSearch PPL, or OpenSearch SQL. It charges $0.005 per GB of uncompressed data scanned, whatever the language, and a query times out after 60 minutes. A query over a narrow time range and a few log groups costs little. The same query over a year of every log group scans every byte stored in that time, and on a dashboard that refreshes it, the scans add up quickly. **Field indexes** on common fields, such as a request ID, let a query skip events that don't contain the value, which cuts both time and cost.

```
fields @timestamp, route, latencyMs
| filter status >= 500
| stats count() as errors, pct(latencyMs, 99) as p99 by route
| sort errors desc
```

**Metric filters** turn matching log events into metrics, such as a count of lines at `ERROR` level or a latency value extracted from JSON, which alarms can then watch. Each metric a filter creates is a custom metric. **Subscription filters** stream matching events, usually within three minutes, to Kinesis Data Streams, Amazon Data Firehose, or Lambda, which deliver them onward to S3, OpenSearch Service, a SIEM (security information and event management system), or a third-party tool. A log group can have up to five, and each account can add one account-level filter per Region. Delivery is at least once, so consumers should tolerate duplicates.

Several other features act on logs as they arrive:

- **Live Tail** streams new events to the console as they're written.
- **Log anomaly detection** learns a log group's usual patterns and reports new or changed ones.
- **Data protection policies** find and mask sensitive values such as email addresses or card numbers, for $0.12 per GB scanned.
- **CloudWatch pipelines** parse, enrich, filter, and reformat logs during ingestion, at no charge beyond ingestion. The original, untransformed events aren't kept.

### Log classes

Each log group has a **log class**, chosen at creation and fixed afterward:

| | Standard | Infrequent Access |
| --- | --- | --- |
| **Ingestion** | $0.50 per GB | $0.25 per GB |
| **Storage** | $0.03 per GB-month | Same |
| **Logs Insights queries** | Yes | Most commands |
| **Data protection, pipelines, export to S3** | Yes | Yes |
| **Metric filters, subscription filters, EMF** | Yes | No |
| **Live Tail, log anomaly detection, field indexes** | Yes | No |
| **Reading events with `GetLogEvents` or `FilterLogEvents`** | Yes | No, only through Logs Insights |

Infrequent Access halves the ingestion price for logs that are kept for audits and occasional investigation. It gives up the features that turn logs into metrics or streams, and the ones that watch logs live. A third class, **Delivery**, exists only to pass Lambda logs through to S3 or Amazon Data Firehose. It keeps events for two days and supports no queries.

Logs that AWS services write on your behalf, such as VPC flow logs and Lambda logs, are **vended logs**, priced in volume tiers from $0.50 per GB down to $0.05 per GB above 50 TB a month.

---

## Application and Container Monitoring

Several CloudWatch features build on metrics, logs, and traces for particular kinds of workload:

- **Application Signals** instruments applications in languages including Java, Python, Node.js, and .NET, on EKS, ECS, and EC2 through the CloudWatch agent and the AWS Distro for OpenTelemetry, and on Lambda through an OpenTelemetry Lambda layer. It produces standard metrics for each service and operation, such as call volume, latency, faults, and errors, and draws an application map of services and their dependencies. It also tracks **service level objectives (SLOs)**, targets such as "99.9% of checkout requests succeed over 28 days".
- **Container Insights** collects cluster, node, pod, task, and service metrics from ECS and EKS, including tasks and pods on Fargate, where AWS runs the containers without servers you manage. Its original version bills as custom metrics and log ingestion. On EKS, enhanced observability instead bills per observation, meaning each data point ingested, and an OpenTelemetry version sends metrics with up to 150 labels, queried with PromQL.
- **Lambda Insights** adds per-invocation system metrics, such as memory used and CPU time, through a Lambda extension.
- **Synthetics canaries** run scripted checks against endpoints on a schedule, and **RUM** (real user monitoring) collects performance and errors from real users' browsers.

---

## Across Accounts and Regions

Two features bring telemetry from many accounts together, and they differ in whether data moves. A third, older console feature covers viewing across Regions.

**Cross-account observability** leaves data where it is. A **monitoring account** creates a **sink** in a Region, and **source accounts** create **links** to it, sharing metrics, log groups, traces, and Application Signals data. From the monitoring account, dashboards, Logs Insights queries, and alarms read source-account data in place. A monitoring account can have up to 100,000 source accounts, and a source can share with up to five monitoring accounts. With AWS Organizations, every account in the organization or an organizational unit becomes a source automatically, including accounts created later. Sharing logs and metrics costs nothing extra, since each source account keeps paying for its own data. It works within one Region, so a multi-Region estate needs a sink in each Region.

**Log centralization** copies data. The organization's management account, or a delegated administrator, writes rules that replicate new log events from chosen accounts and Regions into log groups in one destination account and Region, optionally with a second copy in a backup Region. It suits a security or audit account that must hold its own copy, retained and controlled separately from the accounts that produced it. It copies only events that arrive after the rule is created.

{% include figure.html id="aws-cw-cross-account" %}

For viewing across Regions, the **cross-account cross-Region console**, which uses IAM roles shared from each account, lets one dashboard hold graphs from several Regions and accounts, and metric math can combine metrics from different Regions. It doesn't extend to logs, and an alarm can't watch a metric in another Region, so each Region still needs its own alarms. CloudWatch never aggregates across Regions on its own.

---

## What Drives the Bill

CloudWatch costs rarely come from one big item. They come from defaults nobody changed:

| Cost driver | What keeps it down |
| --- | --- |
| **Log storage** | Set a retention period on every log group, since the default is never |
| **Log ingestion** | Infrequent Access for logs that are only kept, not watched. Lower log levels in production. For Lambda logs that only need to reach S3, the Delivery class |
| **Custom metric count** | Keep high-cardinality fields out of classic dimensions, or move to OpenTelemetry metrics. Metric filters, EMF, and original Container Insights all create custom metrics too |
| **Logs Insights scans** | Narrow time ranges and log groups, and field indexes. A log alarm or dashboard widget repeats its scan on every run |
| **OTel enrichment of vended metrics** | Turn it on only in Regions where PromQL over AWS metrics is needed, since it's billed per GB |
| **API polling** | Metric Streams, at $0.003 per 1,000 metric updates, instead of a third-party tool polling `GetMetricData` |
| **Dashboards** | Three are free, then $3 per dashboard per month |

The free tier covers 10 custom or detailed monitoring metrics, 10 alarm metrics, 3 dashboards, and 5 GB of log ingestion, storage, and scanning a month.

---

## Common Pitfalls

- **Never-expiring logs.** Every log group without a retention period keeps growing and costs more each month. Set retention when the log group is created, in the same template, rather than afterward.
- **Unique IDs as dimensions.** A request ID, user ID, or order ID as a classic dimension, including through EMF, creates a metric per value. Keep such fields in the log event, where queries can still find them.
- **Missing data treated as breaching on a sparse metric.** An error-count alarm set to `breaching` fires whenever there are no errors to report. Match the setting to how the metric is published.
- **Alarms nobody receives.** An alarm without an action, or whose SNS topic has no confirmed subscriber, changes state silently. Test each with `SetAlarmState` before relying on it.
- **Infrequent Access chosen for logs that feed metrics or streams.** It has no metric filters, EMF, or subscription filters, and the class can't be changed later, so logs those features depend on must be Standard.
- **Unbounded Logs Insights queries.** A query over a long time range and many log groups scans everything in them. Scope the time range and log groups before running it, and index the fields you filter on.
- **One Region's view mistaken for the whole estate.** Metrics, alarms, and cross-account links are all Regional. A service in a second Region needs its own alarms and its own sink.

---

## Key Takeaways

- CloudWatch stores metrics for 15 months at decreasing resolution and logs for as long as each log group's retention allows, which by default is forever.
- Each unique set of dimension values is a separate classic metric, billed monthly. OpenTelemetry metrics bill by volume, allow 150 labels, and are queried with PromQL.
- EMF turns structured log lines into metrics without API calls, and keeps the full event for investigation.
- An alarm fires when M of its last N data points breach, acts only on state changes, and needs a missing-data setting that matches how its metric is published. Composite alarms turn related symptoms into one page.
- Choose each log group's class at creation. Standard supports everything, and Infrequent Access halves ingestion for logs that are only stored and queried later.
- Logs Insights charges by data scanned, so time range, log group selection, and field indexes set its cost.
- Cross-account observability queries other accounts' data in place, per Region, at no extra charge. Log centralization copies logs into one account for separate retention.
