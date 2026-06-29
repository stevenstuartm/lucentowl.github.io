---
title: "AWS CloudWatch for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "Comprehensive guide to AWS CloudWatch covering metrics, alarms, dashboards, Logs Insights, cross-account observability, and cost optimization strategies for monitoring and operational excellence"
tags: [aws, observability, monitoring, cloudwatch, logging, metrics, fundamentals]
---

## What Problems CloudWatch Solves

CloudWatch is AWS's native monitoring and observability service that addresses critical operational challenges:

**Unified monitoring across AWS services**: Over 70 AWS services automatically publish metrics to CloudWatch without configuration. You get immediate visibility into EC2 CPU utilization, Lambda invocations, DynamoDB consumed capacity, and hundreds of other metrics the moment you provision resources.

**Centralized log aggregation**: Applications running across hundreds of EC2 instances, Lambda functions, and containers can stream logs to CloudWatch Logs, where you can search, filter, and analyze them in one place. Without this, you'd be SSHing into individual servers or tailing container logs manually.

**Proactive issue detection**: Alarms trigger notifications or automated remediation when metrics cross thresholds. CloudWatch detects a DynamoDB table approaching capacity limits and sends you a notification 10 minutes before users experience throttling, not 10 minutes after they start complaining.

**Operational intelligence**: CloudWatch Logs Insights lets you query terabytes of logs in seconds to answer questions like "Which API endpoints had the highest error rates during the incident?" or "What percentage of requests exceeded 500ms latency?" This investigation would take hours with traditional log files.

**Cross-account and cross-region visibility**: Organizations with dozens of AWS accounts can aggregate metrics and logs into centralized monitoring accounts. Security teams get visibility into all accounts without requiring individual account access.

**Cost attribution and optimization**: CloudWatch usage metrics help identify which resources consume the most capacity, helping you right-size instances or optimize data transfer. You discover that 80% of your API Gateway calls come from a single internal service that could use direct service-to-service communication instead.

## Service Fundamentals

### Core Components

CloudWatch consists of several integrated services:

**CloudWatch Metrics**: Time-series data points representing resource and application behavior (CPU utilization, request count, error rate). Metrics are the foundation; everything else builds on them.

**CloudWatch Alarms**: Automated watches on metrics that trigger actions when thresholds are crossed. Alarms evaluate metrics over time windows and can trigger SNS notifications, Auto Scaling actions, EC2 actions, or Systems Manager automation.

**CloudWatch Logs**: Centralized log storage and analysis for application logs, AWS service logs, and custom logs. Logs can be searched, filtered, transformed, and exported to other services.

**CloudWatch Dashboards**: Customizable visual representations of metrics and logs. Dashboards provide at-a-glance operational views for teams, executives, or customers.

**CloudWatch Insights**: Query and analysis tools including Logs Insights (SQL-like queries on logs), Container Insights (container metrics and logs), Lambda Insights (Lambda performance analysis), and Application Insights (application-level monitoring).

**CloudWatch Events/EventBridge**: Event-driven automation based on state changes. While technically a separate service (EventBridge), it integrates tightly with CloudWatch for operational automation.

### Data Model

**Namespaces**: Logical containers for metrics. AWS services use namespaces like `AWS/EC2`, `AWS/Lambda`, `AWS/RDS`. Custom applications use custom namespaces like `MyApp/Production`.

**Metrics**: Named time-series data (e.g., `CPUUtilization`, `InvocationCount`). Each metric belongs to one namespace.

**Dimensions**: Name-value pairs that identify unique metric streams. The metric `CPUUtilization` in namespace `AWS/EC2` with dimension `InstanceId=i-1234567890abcdef0` represents CPU usage for one specific EC2 instance. Multiple dimension combinations create separate metric streams.

**Statistics**: Aggregations over time periods (Average, Sum, Minimum, Maximum, SampleCount). The statistic `Average CPUUtilization over 5 minutes` gives you a single number summarizing CPU usage.

**Percentiles**: Statistical aggregations that answer questions like "What is the 99th percentile response time?" (99% of requests were faster than this value). Percentiles are critical for understanding tail latency that averages obscure.

**Timestamps**: CloudWatch metrics have up to millisecond resolution. Standard resolution is 60-second granularity; high-resolution custom metrics support 1-second granularity.

### Data Retention

CloudWatch retains metrics for different periods based on resolution:

| Resolution | Retention Period |
|------------|------------------|
| 1-second (high resolution) | 3 hours |
| 60-second | 15 days |
| 5-minute | 63 days |
| 1-hour | 455 days (15 months) |

Logs have configurable retention from 1 day to 10 years, or indefinite retention. Short retention periods reduce costs dramatically; changing from indefinite to 30-day retention can reduce log storage costs by 90%+ for high-volume applications.

## CloudWatch Metrics

### Standard Metrics

AWS services publish standard metrics automatically:

**EC2 standard metrics** (5-minute intervals, free):
- `CPUUtilization`: Percentage of allocated CPU used
- `NetworkIn` / `NetworkOut`: Bytes received/sent
- `DiskReadBytes` / `DiskWriteBytes`: Disk I/O (instance store only, not EBS)
- `StatusCheckFailed`: Instance or system status check failures

**EC2 detailed monitoring** (1-minute intervals, additional cost):
- Same metrics at higher resolution
- Cost: $2.10 per instance per month (7 metrics × $0.30 per metric)

**RDS standard metrics**:
- `CPUUtilization`, `DatabaseConnections`, `FreeableMemory`
- `ReadLatency` / `WriteLatency`: Disk I/O latency
- `ReadIOPS` / `WriteIOPS`: I/O operations per second

**Lambda standard metrics**:
- `Invocations`: Number of invocations
- `Duration`: Execution time in milliseconds
- `Errors`: Failed invocations
- `Throttles`: Invocations throttled due to concurrency limits
- `ConcurrentExecutions`: Current concurrent invocations

**DynamoDB standard metrics**:
- `ConsumedReadCapacityUnits` / `ConsumedWriteCapacityUnits`
- `UserErrors` / `SystemErrors`
- `ThrottledRequests`: Requests rejected due to capacity limits

### Custom Metrics

Custom metrics let you publish application-level metrics:

**Use cases**:
- Business metrics (orders placed, revenue, signups)
- Application performance (custom latency measurements, cache hit rate)
- Resource utilization AWS doesn't track (memory usage inside instances, disk usage on EBS volumes)

**Publishing methods**:

1. **AWS SDKs**: Use `PutMetricData` API
2. **CloudWatch Agent**: Collects system metrics and logs from EC2/on-premises
3. **Embedded Metric Format (EMF)**: JSON logs that CloudWatch automatically converts to metrics
4. **StatsD protocol**: CloudWatch Agent can receive StatsD metrics

**Resolution options**:
- **Standard resolution**: 60-second intervals, $0.30 per metric per month
- **High resolution**: 1-second intervals, $0.30 per metric per month (same price, but more data points)

**Cost model**:
- First 10,000 metrics: $0.30 per metric per month
- Next 240,000 metrics: $0.10 per metric per month
- Next 750,000 metrics: $0.05 per metric per month
- Over 1 million metrics: $0.02 per metric per month

**Dimensions best practices**:
- Use dimensions to separate metric streams (e.g., `Service=API`, `Environment=Production`)
- Each unique combination of dimensions creates a separate metric
- Example: Metric `ResponseTime` with dimensions `{Service, Endpoint, StatusCode}` and 5 services × 20 endpoints × 5 status codes = 500 metric streams = $150/month

<div class="callout callout--warning">
<p class="callout__title">Avoid Cardinality Explosions</p>
<p>Adding a dimension like <code>UserId</code> with millions of unique values creates millions of metrics. Use aggregation instead; track <code>ResponseTime</code> by <code>Service</code> and <code>Endpoint</code>, not by individual user.</p>
</div>

### CloudWatch Agent

The CloudWatch Agent collects metrics and logs from EC2 instances and on-premises servers:

**Standard metrics from agent**:
- Memory utilization (not available in standard EC2 metrics)
- Disk utilization (used disk space percentage)
- Swap utilization
- Network metrics (packets, errors)
- Process metrics (CPU, memory per process)

**Configuration**:
- Stored in Systems Manager Parameter Store or local file
- JSON configuration specifies which metrics and logs to collect
- Can be deployed via Systems Manager Run Command to hundreds of instances

**Installation**:
- Available as package (Amazon Linux, Ubuntu, Windows)
- Runs as service, starts automatically on boot
- Minimal CPU/memory overhead (typically <1% CPU, ~50MB RAM)

## CloudWatch Alarms

Alarms monitor metrics and trigger actions when thresholds are crossed.

### Alarm States

Alarms have three states:

**OK**: Metric is within acceptable threshold
**ALARM**: Metric has breached threshold for specified number of evaluation periods
**INSUFFICIENT_DATA**: Not enough data to determine state (recent alarm creation, missing data points)

### Alarm Configuration

**Threshold types**:

1. **Static threshold**: Fixed value (CPU > 80%)
2. **Anomaly detection**: Machine learning-based threshold that adapts to metric patterns
3. **Metric math**: Combine multiple metrics with expressions (`m1 / m2 * 100`)

**Evaluation parameters**:

- **Period**: Time range for one data point (1 minute, 5 minutes, etc.)
- **Evaluation periods**: How many consecutive periods must breach threshold
- **Datapoints to alarm**: How many of the evaluation periods must breach (allows for sparse metrics)

Example: Alarm on CPU > 80% for 3 out of 5 consecutive 5-minute periods means CloudWatch looks at 25 minutes of data, and the alarm triggers if 15 minutes (3 periods) exceed 80%.

**Missing data handling**:
- **Treat as missing**: Ignore missing data points (don't change alarm state)
- **Treat as good (not breaching)**: Missing data counts as OK
- **Treat as bad (breaching)**: Missing data counts as ALARM
- **Treat as insufficient data**: Missing data puts alarm in INSUFFICIENT_DATA state

Choose based on metric characteristics. For metrics that should always exist (EC2 instance CPU), treat missing data as bad. For sparse metrics (error counts), treat as good.

### Alarm Actions

Alarms can trigger multiple action types:

**SNS notifications**: Send messages to SNS topics (email, SMS, Lambda, SQS)
**Auto Scaling actions**: Add or remove instances from Auto Scaling groups
**EC2 actions**: Stop, terminate, reboot, or recover instances
**Systems Manager actions**: Execute automation documents

**Action timing**:
- Actions trigger on state transitions (OK → ALARM, ALARM → OK)
- Separate actions for each state transition
- Actions can be different per transition (send alert on ALARM, send all-clear on OK → notification)

### Composite Alarms

Composite alarms combine multiple alarms with boolean logic:

Example: Alert if (HighCPU AND HighMemory) OR DatabaseDown

**Use cases**:
- Reduce alert fatigue by combining correlated symptoms
- Alert only when multiple conditions occur simultaneously
- Create hierarchical alarm structures (service-level alarms composed of component alarms)

**Cost**: $0.50 per composite alarm per month (10 composite alarms free tier)

### Anomaly Detection

CloudWatch uses machine learning to establish baselines and detect anomalies:

**How it works**:
- Analyzes up to 2 weeks of historical data
- Creates model of expected metric behavior (daily/weekly patterns)
- Establishes upper and lower bounds (anomaly detection band)
- Triggers alarm when metric exceeds band

**Use cases**:
- Metrics with predictable patterns (traffic higher during business hours, lower at night)
- Detecting unusual behavior without knowing exact thresholds
- Seasonal patterns (e-commerce traffic higher during holidays)

**Cost**: $0.30 per metric per month (same as custom metrics)

**Configuration**: Set band width (how sensitive to deviations). Narrower bands detect smaller anomalies but may create false positives.

## CloudWatch Logs

CloudWatch Logs provides centralized log storage, search, and analysis.

### Log Organization

**Log Groups**: Containers for log streams, representing an application or resource type (e.g., `/aws/lambda/my-function`, `/var/log/nginx/access.log`)

**Log Streams**: Sequences of log events from a single source (e.g., one Lambda invocation, one EC2 instance)

**Log Events**: Individual log entries with timestamp and message

**Retention policies**: Set per log group (1 day to 10 years, or never expire)

### Log Sources

**AWS service logs** (automatic):
- Lambda function logs
- API Gateway access logs
- VPC Flow Logs
- CloudTrail logs
- RDS logs (error, slow query, general)
- ECS container logs

**Application logs** (via agent/SDK):
- EC2 application logs (via CloudWatch Agent)
- On-premises server logs
- Custom application logs (via AWS SDK PutLogEvents API)

**Log formats**:
- Plain text
- JSON (recommended for structured logging)
- Any custom format (parsed with Logs Insights queries)

### Subscription Filters

Subscription filters stream log data to other services in real-time:

**Destinations**:
- **Lambda**: Process logs with custom code
- **Kinesis Data Streams**: Stream to analytics pipelines
- **Kinesis Data Firehose**: Stream to S3, Redshift, Elasticsearch, Splunk

**Use cases**:
- Real-time log analysis (detect error patterns, trigger alerts)
- Long-term archive to S3 (cheaper than CloudWatch Logs retention)
- Stream to third-party SIEM tools
- Feed logs to machine learning pipelines

**Filter patterns**:
- Match specific text (`[ERROR]`, `Exception`)
- Match JSON fields (`{ $.statusCode = 500 }`)
- Metric filters: Create metrics from log patterns (count errors, measure latencies from logs)

**Cost**: No additional cost for subscription filters themselves; standard data transfer and destination costs apply.

### Metric Filters

Metric filters create CloudWatch metrics from log patterns:

Example: Count log lines containing `ERROR` and publish metric `ErrorCount` to namespace `MyApp/Production`

**Use cases**:
- Create metrics from application logs without instrumenting code
- Count specific error types
- Extract latency measurements from access logs
- Track business metrics logged to application logs

**Pattern matching**:
- Space-delimited logs: `[timestamp, request_id, level = ERROR]`
- JSON logs: `{ $.level = "ERROR" }`
- Numeric extraction: `{ $.response_time > 1000 }` to find slow requests

**Cost**: Free (creates standard CloudWatch metrics, which cost $0.30/month)

## CloudWatch Dashboards

Dashboards provide visual representations of metrics and logs.

### Dashboard Components

**Widget types**:
- **Line graph**: Time-series metrics (CPU utilization over time)
- **Stacked area**: Multiple metrics stacked (network in/out combined view)
- **Number**: Single current metric value (current RDS connections)
- **Gauge**: Metric value within a range (disk usage 0-100%)
- **Bar chart**: Compare metrics across dimensions (requests per region)
- **Pie chart**: Percentage breakdown (traffic distribution across services)
- **Logs widget**: Display log query results
- **Alarm status**: Show current alarm states

**Customization**:
- Time range selection (last hour, 3 hours, 1 day, custom)
- Auto-refresh intervals (10 seconds to 15 minutes)
- Widget annotations (mark deployments, incidents)
- Y-axis scaling and units

### Dashboard Use Cases

**Operational dashboards**: Monitor production health (error rates, latency, throughput)
**Executive dashboards**: High-level business metrics (orders, revenue, active users)
**Incident response**: Pre-built views for troubleshooting specific services
**Customer-facing**: Public dashboards showing service status

### Sharing and Permissions

**Sharing options**:
- AWS account users (via IAM permissions)
- Public dashboards (anyone with link, no AWS authentication required)
- Cross-account sharing (link to dashboards in different accounts)

**Public dashboard considerations**:
- No cost to viewers
- Read-only access
- Can show metrics and logs (logs should not contain sensitive data)
- Useful for status pages

**Cost**:
- First 3 dashboards: Free
- Additional dashboards: $3 per dashboard per month
- Dashboard = up to 50 metrics (additional metrics $0.30/month each)

## CloudWatch Insights

CloudWatch Insights provides advanced querying and analysis capabilities.

### CloudWatch Logs Insights

SQL-like query language for analyzing logs:

**Query syntax**:

```
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
```

This query counts errors in 5-minute intervals.

**Capabilities**:
- Filter logs by field values
- Extract fields from structured (JSON) or unstructured logs
- Aggregate with `count()`, `sum()`, `avg()`, `min()`, `max()`
- Group by dimensions
- Sort and limit results

**Common queries**:

Find slowest requests:
```
fields @timestamp, url, response_time
| filter response_time > 1000
| sort response_time desc
| limit 20
```

Count errors by type:
```
filter level = "ERROR"
| stats count() by error_type
| sort count desc
```

Calculate p99 latency:
```
stats pct(response_time, 99) by bin(1h)
```

**Cost**:
- $0.005 per GB of data scanned
- Query that scans 100 GB costs $0.50

**Performance**:
- Queries scan log data in parallel across multiple log streams
- Typical query scans 1-100 GB in seconds
- Queries timeout after 15 minutes
- Use time range filters to reduce data scanned

### Container Insights

Container Insights collects metrics and logs from container environments:

**Supported platforms**:
- Amazon ECS (EC2 and Fargate launch types)
- Amazon EKS (Kubernetes)
- Kubernetes on EC2

**Metrics collected**:
- Container CPU and memory utilization
- Container network metrics
- Storage metrics
- Task/pod-level metrics
- Node-level metrics

**Performance monitoring**:
- Identify container resource constraints
- Detect memory leaks or CPU throttling
- Compare performance across containers/tasks

**Cost**:
- Custom metrics for container metrics ($0.30 per metric per month)
- Log ingestion for container logs (standard CloudWatch Logs pricing)
- Typical cost: $5-15 per container per month depending on log volume

**Setup**:
- ECS: Enable Container Insights in cluster settings
- EKS: Deploy CloudWatch Agent and Fluentd as DaemonSets

### Lambda Insights

Lambda Insights provides performance monitoring for Lambda functions:

**Metrics collected**:
- Cold start duration
- Memory utilization (actual usage vs allocated)
- CPU utilization
- Network throughput
- Init duration

**Use cases**:
- Optimize memory allocation (reduce over-provisioning)
- Identify cold start impact
- Detect resource constraints causing throttling

**Setup**:
- Add Lambda Insights layer to function
- Grant permissions to publish metrics

**Cost**:
- $0.0000002 per request ($0.20 per 1 million requests)
- Additional custom metrics costs

### Application Insights

Application Insights provides automated monitoring for applications:

**How it works**:
- Monitors application components (EC2, RDS, Lambda, etc.)
- Automatically detects problems (high error rates, slow performance)
- Correlates metrics, logs, and traces
- Creates CloudWatch dashboards automatically

**Supported application types**:
- .NET applications on IIS
- Java applications
- SQL Server databases
- Custom applications

**Setup**:
- Define application (group of related resources)
- Application Insights configures monitoring automatically
- Creates alarms and dashboards

**Cost**: $0.001 per resource per hour (~$0.75 per resource per month)

## Cross-Account Observability

CloudWatch supports cross-account monitoring for centralized observability:

### Monitoring Account Architecture

**Pattern**: Central monitoring account receives metrics and logs from multiple source accounts (development, staging, production).

**Benefits**:
- Security teams monitor all accounts without individual access
- Centralized dashboards across organization
- Reduced IAM complexity (users access monitoring account only)
- Cost attribution across accounts

### Setup

**Source accounts**:
1. Create IAM role allowing monitoring account to assume it
2. Configure sharing (CloudWatch console or API)

**Monitoring account**:
1. Create sink to receive data from source accounts
2. Create cross-account dashboards and alarms

**Permissions**:
- Source account role allows `cloudwatch:PutMetricData`, `logs:PutLogEvents`
- Monitoring account has read permissions on shared metrics/logs

### Cost Allocation

Costs accrue to the account generating the metrics/logs (source accounts), not the monitoring account.

**Billing**:
- Source account: Pays for metric generation, log ingestion
- Monitoring account: Pays only for dashboards, alarms, Logs Insights queries

## Integration Patterns

CloudWatch integrates with many AWS services:

### Auto Scaling Integration

**Use case**: Scale EC2 instances or ECS tasks based on CloudWatch alarms

Example: Add instances when average CPU > 70% for 5 minutes

**Step Scaling**: Define multiple thresholds (add 1 instance at 70%, add 3 at 90%)
**Target Tracking**: Maintain target value (keep CPU at 60%)

**Custom metrics**: Scale on application metrics (request queue depth, active connections)

### Lambda Integration

**Automatic logs**: Lambda sends logs to CloudWatch Logs automatically
**Custom metrics**: Publish custom metrics with Embedded Metric Format
**Alarms trigger Lambda**: CloudWatch alarm → SNS → Lambda function for remediation

Example: Alarm detects disk full → SNS → Lambda cleans up old files

### EventBridge Integration

**CloudWatch Events** (legacy) is now EventBridge:
- Trigger actions on AWS state changes (EC2 state change, Auto Scaling event)
- Schedule tasks (cron/rate expressions)
- Trigger Lambda, Step Functions, SNS, SQS

**Event patterns**:
```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {
    "state": ["terminated"]
  }
}
```

Trigger automation when instances terminate unexpectedly.

### Third-Party Integration

**Metric Streams**: Stream metrics to third-party observability platforms (Datadog, New Relic, Dynatrace, Splunk)

**How it works**:
- Create metric stream
- Send to Kinesis Data Firehose
- Firehose delivers to HTTP endpoint or S3

**Use cases**:
- Send CloudWatch metrics to existing observability platform
- Long-term metric storage in S3 (CloudWatch retains max 15 months)
- Real-time metric processing

**Cost**:
- Metric stream: $0.003 per 1,000 metric updates
- Firehose delivery costs
- Cheaper than API polling for high-volume metrics

## Cost Optimization Strategies

CloudWatch costs can grow quickly without optimization:

### Metric Cost Optimization

**Reduce custom metric cardinality**:
- Avoid high-cardinality dimensions (user IDs, request IDs)
- Aggregate before publishing (publish p50/p99/p100 instead of individual latencies)

Example: Instead of publishing `ResponseTime` for each of 1 million user requests, publish percentile metrics (`ResponseTime_p50`, `ResponseTime_p99`) aggregated over 1-minute intervals = 2 metrics vs 1 million.

**Use metric filters on logs**:
- Extract metrics from logs instead of publishing custom metrics
- Cost: Log ingestion ($0.50/GB) + metric ($0.30/month) vs custom metric publishing (API calls + metric storage)
- Cheaper when log volume is low and metrics would be numerous

**Disable unused metrics**:
- Stop publishing metrics for decommissioned resources
- Disable detailed monitoring on EC2 if not needed ($2.10/instance/month savings)

**Metric math for derived metrics**:
- Use metric math in alarms/dashboards instead of publishing calculated metrics
- Example: Calculate error rate as `m1 / m2 * 100` in alarm instead of publishing `ErrorRate` metric

### Log Cost Optimization

**Adjust retention periods**:
- Default is never expire (expensive for high-volume logs)
- Set aggressive retention for debug logs (7 days), longer for audit logs (1 year)

Cost comparison for 100 GB/day:
- Never expire: ~$1,500/month after 1 month, ~$18,000/month after 1 year
- 30-day retention: ~$1,500/month (constant)
- 7-day retention: ~$350/month

**Filter before ingestion**:
- Use CloudWatch Agent filters to exclude debug logs
- Log only errors in production, verbose logs in development

**Archive to S3**:
- Use subscription filter to send logs to S3 via Firehose
- Query with Athena when needed
- Cost: S3 storage $0.023/GB vs CloudWatch Logs $0.50/GB

**Compression**:
- CloudWatch compresses logs automatically
- Use structured logging (JSON) for better compression ratios

**Sample logs**:
- For extremely high-volume logs, sample percentage (e.g., 10% of requests)
- Use sampling header to correlate sampled traces

### Dashboard Cost Optimization

**Consolidate dashboards**:
- Use fewer dashboards with more widgets
- First 3 dashboards free, then $3/dashboard/month

**Reduce dashboard metrics**:
- Each dashboard includes 50 metrics free
- Additional metrics cost $0.30/month
- Use metric math to combine metrics instead of displaying each separately

### Alarm Cost Optimization

**Use composite alarms**:
- Reduce total alarms by combining with boolean logic
- Cost: $0.10 per standard alarm vs $0.50 per composite alarm
- Net savings if replacing 6+ standard alarms with 1 composite

**Reduce alarm evaluation frequency**:
- Longer evaluation periods reduce API calls
- 5-minute evaluation vs 1-minute = 5× fewer evaluations

**Disable alarms for non-production**:
- Disable alarms outside business hours for development environments
- Re-enable via Lambda on schedule

## Performance Optimization

### Query Performance

**Logs Insights optimization**:
- Filter by time range (reduces data scanned)
- Filter by log group (don't query all groups if targeting specific service)
- Use indexed fields (`@timestamp`, `@message`) for faster searches
- Parse JSON once with `parse` command, then use extracted fields

Slow query (scans entire message):
```
fields @timestamp, @message
| filter @message like /user=12345/
```

Fast query (parses JSON, filters on field):
```
fields @timestamp, user_id, action
| filter user_id = "12345"
```

**Metric query optimization**:
- Request only needed statistics (don't fetch Average, Sum, Min, Max if you only need Average)
- Use longer periods when precision isn't critical (1-hour data points for daily dashboards)
- Batch `GetMetricData` API calls (fetch multiple metrics in one call)

### Ingestion Performance

**Log batching**:
- CloudWatch Logs API supports batching up to 10,000 events or 1 MB per request
- Batch logs from application before sending to reduce API calls
- CloudWatch Agent batches automatically

**Metric batching**:
- `PutMetricData` supports up to 1,000 metrics per request (40 KB limit)
- Batch custom metrics before publishing

**Embedded Metric Format**:
- Publish metrics via structured logs
- CloudWatch extracts metrics asynchronously
- Reduces API calls (single log write publishes logs and metrics)

## Security Best Practices

### IAM Permissions

**Principle of least privilege**:
- Grant `cloudwatch:PutMetricData` only for specific namespaces
- Grant `logs:CreateLogGroup` and `logs:CreateLogStream` only for specific log group patterns
- Restrict `logs:PutLogEvents` to specific log streams

**Read-only access**:
- Use `CloudWatchReadOnlyAccess` managed policy for monitoring teams
- Restrict alarm/dashboard modification to operations teams

**Cross-account access**:
- Use IAM roles for cross-account observability
- Enable resource-based policies on log groups for specific accounts

### Log Data Protection

**Sensitive data**:
- Never log passwords, API keys, credit cards, PII
- Use log filtering to redact sensitive fields before ingestion
- Implement application-level filtering (don't rely on CloudWatch filtering)

**Encryption**:
- CloudWatch Logs encrypts data at rest with AWS-managed keys by default
- Use customer-managed KMS keys for compliance requirements
- KMS-encrypted logs cost same as default encryption

**Access control**:
- Restrict `logs:FilterLogEvents` permission (allows reading log data)
- Use resource-based policies to restrict access to specific log groups
- Audit access with CloudTrail (who queried which logs)

### Alarm Security

**Prevent alarm suppression**:
- Restrict `cloudwatch:DisableAlarmActions` permission
- Monitor alarm state changes with CloudTrail
- Alert when alarms are disabled or modified

**SNS topic security**:
- Restrict SNS `Publish` permission to CloudWatch service principal
- Encrypt SNS topics with KMS for sensitive alerts
- Use HTTPS endpoints for SNS subscriptions

## When to Use CloudWatch vs Alternatives

### CloudWatch Strengths

**Use CloudWatch when**:
- Monitoring AWS-native services (70+ services publish metrics automatically)
- Centralizing logs across AWS services (Lambda, RDS, VPC Flow Logs)
- Building on AWS without third-party dependencies
- Cost-conscious monitoring for smaller deployments (<100 instances)
- Simple alerting and dashboards meet requirements
- Compliance requires data stays in AWS

### Third-Party Observability Platforms

**Consider Datadog, New Relic, Dynatrace when**:
- Monitoring hybrid environments (AWS + on-premises + other clouds)
- Advanced APM features (distributed tracing, code-level profiling, user session replay)
- Superior user experience and pre-built dashboards
- Sophisticated alerting (anomaly detection, alert grouping, intelligent routing)
- Application performance management for complex microservices

**Cost comparison** (approximate for 100 EC2 instances):
- CloudWatch: $500-1,500/month (basic monitoring + logs + dashboards)
- Datadog: $1,500-5,000/month (infrastructure + APM + logs)
- New Relic: $2,000-6,000/month (similar to Datadog)

Third-party platforms cost 2-5× more but provide richer features and better UX. Organizations with complex observability needs often use both (CloudWatch for AWS-native metrics, third-party for APM and advanced analysis).

### Prometheus and Grafana

**Consider Prometheus + Grafana when**:
- Running Kubernetes workloads (Prometheus is Kubernetes-native)
- Open-source preference (no vendor lock-in)
- Custom metric types (histograms, summaries not supported in CloudWatch)
- High-cardinality metrics (user-level metrics, per-pod metrics)
- Cost-conscious with operational expertise (self-managed is cheaper but requires ops overhead)

**AWS-managed options**:
- Amazon Managed Service for Prometheus (AMP): Managed Prometheus-compatible service
- Amazon Managed Grafana (AMG): Managed Grafana for visualization

**Cost**: AMP charges for metric samples ingested and queried. Typically comparable to CloudWatch for Kubernetes workloads.

### CloudWatch vs X-Ray

CloudWatch and X-Ray serve different purposes:

**CloudWatch**: Metrics and logs (what happened, when, how many times)
**X-Ray**: Distributed tracing (why is this request slow, which service caused the error)

**Use both**:
- CloudWatch: Detect high latency with metrics (`p99 ResponseTime > 1000ms`)
- X-Ray: Investigate root cause (database query slow, downstream service timeout)

X-Ray covered in separate guide: [AWS X-Ray for System Architects](/study-guides/infrastructure/aws/aws-xray.html)

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Cost Management Is Critical</p>
<p>CloudWatch costs can grow quickly without optimization. Default settings like never-expire logs and high-cardinality custom metrics lead to unexpected bills.</p>
</div>

### High Costs from Unbounded Metrics

**Problem**: Publishing custom metrics with high-cardinality dimensions creates thousands of metrics unexpectedly.

Example: Metric `RequestLatency` with dimensions `{UserId, Endpoint}` and 10,000 users × 50 endpoints = 500,000 metrics = $30,000/month.

**Solution**:
- Aggregate before publishing (publish percentiles instead of individual measurements)
- Remove high-cardinality dimensions (publish by `Endpoint` only, not `UserId`)
- Use logs for high-cardinality data, metrics for aggregates

### Log Retention Set to Never Expire

**Problem**: Default log retention is never expire. High-volume applications generate terabytes of logs per month, costing tens of thousands of dollars.

**Solution**: Set log retention policies immediately after creating log groups. Use automation (Lambda, CloudFormation) to set retention on new log groups.

**Implementation**: EventBridge rule triggers Lambda when new log group created → Lambda sets retention to 30 days.

### Missing Data Treated as Breaching

**Problem**: Alarm configured to treat missing data as bad triggers false alarms when metrics are sparse (e.g., error count metrics have no data points when there are no errors).

**Solution**: Configure missing data handling appropriately:
- Sparse metrics (errors, specific events): Treat as good (not breaching)
- Continuous metrics (CPU, requests): Treat as bad (missing data indicates problem)

### Alarms Without Actions

**Problem**: Alarms created but no SNS topic configured. Alarm triggers but nobody knows.

**Solution**:
- Always configure at least one action (SNS notification)
- Test alarm by manually setting to ALARM state (`SetAlarmState` API)
- Monitor alarm state changes with CloudTrail

### Logs Insights Query Scans Entire Retention

**Problem**: Query runs against log group with 1 year retention, scans terabytes of data, times out after 15 minutes.

**Solution**:
- Always specify time range filter (last 1 hour, 1 day)
- Use smallest time range needed to answer question
- Consider separate log groups for different retention needs (error logs 1 year, debug logs 7 days)

### Over-Alerting on Anomaly Detection

**Problem**: Anomaly detection alarms create too many false positives from normal metric variance.

**Solution**:
- Tune anomaly detection band width (wider band = fewer alerts)
- Require multiple consecutive breaches before alarming
- Combine anomaly detection with static thresholds (anomaly AND > absolute value)

### Unoptimized Dashboard Costs

**Problem**: Organization creates 100 dashboards (one per team/service), costing $300/month when 10 dashboards would suffice.

**Solution**:
- Consolidate dashboards (use filters/variables to show different services)
- Use cross-account dashboards instead of duplicating per account
- Delete unused dashboards

### No Cross-Region Visibility

**Problem**: Application runs in multiple regions, but each region has separate dashboards and alarms. During incidents, engineers check multiple regions manually.

**Solution**:
- Create cross-region dashboards (dashboards can show metrics from multiple regions)
- Use CloudWatch cross-account observability for centralized monitoring account
- Deploy alarms in all regions with SNS topics that forward to central notification system

## Key Takeaways

**CloudWatch is the foundation of AWS observability**: Over 70 AWS services publish metrics automatically, making CloudWatch essential for monitoring AWS workloads. You get immediate visibility without instrumentation.

**Cost management requires proactive configuration**: Default settings (never-expire logs, high-cardinality custom metrics) lead to unexpected costs. Set log retention policies immediately, avoid high-cardinality dimensions, and monitor your CloudWatch bill.

**Logs Insights provides SQL-like log analysis at scale**: Query terabytes of logs in seconds to investigate incidents. Use time range filters and structured logging (JSON) for best performance and lowest cost.

**Alarms require thoughtful configuration**: Missing data handling, evaluation periods, and composite alarms determine whether you get actionable alerts or alert fatigue. Test alarms and refine thresholds based on operational experience.

**Cross-account observability centralizes monitoring**: Organizations with multiple AWS accounts should use cross-account CloudWatch to give security and operations teams visibility without granting account access.

**Metric math and filters reduce custom metric costs**: Extract metrics from logs with metric filters, calculate derived metrics with metric math, and aggregate before publishing to minimize custom metric costs.

**CloudWatch integrates deeply with AWS automation**: Alarms trigger Auto Scaling, Lambda remediation, and Systems Manager automation. Use these integrations to build self-healing architectures.

**Consider hybrid observability strategies**: CloudWatch excels at AWS-native monitoring but third-party tools (Datadog, New Relic) provide superior APM and user experience. Many organizations use both: CloudWatch for infrastructure metrics, third-party for application performance management.

**Retention and aggregation balance cost and utility**: Short-term detailed logs (7-30 days), long-term aggregated metrics (15 months), and S3 archives for compliance (years) provide cost-effective observability at different time scales.

**Observability is not just monitoring, it's operational intelligence**: CloudWatch provides the raw data (metrics, logs, traces with X-Ray). Your dashboards, alarms, and queries turn that data into operational intelligence that drives decisions and automation.
