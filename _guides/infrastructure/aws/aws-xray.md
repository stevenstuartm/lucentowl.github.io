---
title: "AWS X-Ray for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "Comprehensive guide to AWS X-Ray covering distributed tracing, service maps, trace analysis, integration patterns, performance optimization, and troubleshooting strategies for microservices architectures"
tags: [aws, observability, distributed-tracing, xray, monitoring, microservices, performance, fundamentals]
---

## What Problems X-Ray Solves

X-Ray is AWS's distributed tracing service that addresses critical observability challenges in modern architectures:

**Root cause analysis for distributed systems**: A request traverses Lambda function → API Gateway → DynamoDB → SQS → another Lambda. The request takes 3 seconds, but which component caused the delay? X-Ray shows you that the DynamoDB query consumed 2.8 seconds due to a missing index.

**Performance bottleneck identification**: CloudWatch metrics tell you that p99 latency is 2 seconds. X-Ray traces show you why: 30% of requests wait 1.5 seconds for an external API that returns cached data. You implement client-side caching and drop p99 to 400ms.

**Dependency visualization**: Your microservices architecture has grown to 40 services. Which services call which? What happens if the payment service goes down? X-Ray's service map shows all dependencies automatically, revealing that 12 services depend on the payment service and would fail without proper circuit breakers.

**Error correlation across services**: Users report checkout failures. Application logs show errors in the order service, but the root cause is a configuration change in the inventory service that started returning 500 errors. X-Ray traces connect the dots across service boundaries.

**Understanding request flow**: A new engineer joins the team and asks "How does checkout work?" Instead of reading documentation that's six months out of date, you show them X-Ray traces that visualize the actual request flow through 8 services, including retry logic and fallback paths.

**Identifying inefficient patterns**: X-Ray reveals that the product listing API makes 50 sequential DynamoDB queries (N+1 problem). You refactor to batch requests, reducing latency from 800ms to 120ms.

**Multi-region debugging**: Requests route through CloudFront → ALB in us-east-1 → Lambda → DynamoDB Global Table replicating to eu-west-1. Latency spikes for European users. X-Ray traces show cross-region DynamoDB reads instead of local reads. You fix the routing logic.

## Service Fundamentals

### What is Distributed Tracing

**Traditional logging limitations**: Each service logs independently. Correlating logs across services requires matching request IDs manually and jumping between log streams. For a request touching 10 services, you're searching through 10 log streams.

**Distributed tracing solution**: Traces follow a single request through the entire system, capturing timing, metadata, and errors at each step. One trace shows the complete request lifecycle across all services.

**Trace components**:
- **Trace**: The complete journey of one request through the system
- **Segments**: Work done by a single service (e.g., Lambda execution, API Gateway handling)
- **Subsegments**: Granular operations within a segment (e.g., DynamoDB query, HTTP call)
- **Annotations**: Key-value pairs for filtering traces (e.g., `user_type=premium`, `region=us-east-1`)
- **Metadata**: Additional context that doesn't affect filtering (request body, response payload)

### How X-Ray Works

**Instrumentation**: Add X-Ray SDK to your application code. The SDK captures timing data, HTTP requests, database calls, and errors.

**Trace ID propagation**: X-Ray generates a trace ID for each request and passes it through HTTP headers (`X-Amzn-Trace-Id`). Every service along the path includes this trace ID in its segment.

**Daemon collection**: The X-Ray daemon runs alongside your application (as sidecar container, Lambda layer, or EC2 agent). It collects segments from the SDK and sends them to X-Ray service.

**Service assembly**: X-Ray receives segments from multiple services, assembles them into complete traces using trace IDs, and builds the service map.

**Querying and visualization**: Use X-Ray console, API, or CloudWatch ServiceLens to query traces, filter by criteria, and visualize request flows.

### AWS Service Integration

Many AWS services support X-Ray natively without code changes:

**API Gateway**: Enable X-Ray tracing in stage settings. API Gateway automatically creates segments for requests.

**Lambda**: Enable active tracing in function configuration. Lambda runtime includes X-Ray SDK and daemon.

**ECS/EKS**: Deploy X-Ray daemon as sidecar container or DaemonSet. Application containers send segments to daemon.

**Elastic Beanstalk**: Enable X-Ray in environment configuration. Platform includes daemon.

**App Runner**: Enable X-Ray in service settings.

**Step Functions**: Step Functions automatically traces execution with X-Ray when enabled.

## X-Ray Concepts

### Traces

A trace represents a single request's journey through your distributed system:

**Trace structure**:
```
Trace ID: 1-5f84c3a2-7c4d8e9f2a1b3c5d6e7f8901
Duration: 1,247ms
Status: OK (200)

Segments:
  1. API Gateway [0-15ms]
  2. Lambda: ProcessOrder [15-950ms]
     Subsegments:
       - DynamoDB: GetUser [20-180ms]
       - Lambda: ValidatePayment [200-850ms]
       - DynamoDB: CreateOrder [860-930ms]
  3. SQS: Send notification [950-960ms]
  4. Lambda: SendEmail [960-1,247ms]
```

**Trace timeline**: Visual representation showing which operations happened when, where time was spent, and which operations ran in parallel.

**Trace details**: Click on any segment to see HTTP request/response, errors, SQL queries, external API calls.

### Segments

Segments represent work done by a single service:

**Segment content**:
- Service name
- Start time and end time (duration calculated)
- HTTP request and response data (method, URL, status code)
- Errors and exceptions
- Annotations and metadata
- Subsegments for downstream calls

**Automatic segments**: API Gateway, Lambda, and other AWS services create segments automatically.

**Manual segments**: For EC2, ECS, or on-premises applications, your code creates segments with X-Ray SDK.

Example segment creation (Node.js):
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const segment = AWSXRay.getSegment();
```

### Subsegments

Subsegments provide granular detail within a segment:

**Common subsegments**:
- Database queries (DynamoDB, RDS, Aurora)
- HTTP calls to downstream services
- AWS SDK calls (S3, SQS, SNS)
- Custom operations you want to time

**Creating custom subsegments** (Node.js):
```javascript
const subsegment = segment.addNewSubsegment('validateInventory');
try {
  // Your code here
  subsegment.close();
} catch (error) {
  subsegment.addError(error);
  subsegment.close();
  throw error;
}
```

**Why subsegments matter**: A Lambda function segment shows 2 seconds total. Subsegments reveal: DynamoDB query (100ms), external API call (1,800ms), S3 read (50ms). The external API is the bottleneck.

### Annotations

Annotations are indexed key-value pairs used for filtering traces:

**Annotation examples**:
- `customer_tier: "premium"`
- `checkout_type: "express"`
- `ab_test_group: "variant_b"`
- `region: "us-east-1"`
- `payment_method: "credit_card"`

**Use annotations for**:
- Filtering traces in console ("Show me all premium customer requests")
- Creating CloudWatch alarms based on trace metrics
- Analyzing performance by cohort (premium vs free users)

**Limits**: 50 annotations per segment, values must be strings/numbers/booleans.

**Adding annotations** (Node.js):
```javascript
segment.addAnnotation('customer_tier', 'premium');
segment.addAnnotation('order_value', 149.99);
```

### Metadata

Metadata is non-indexed additional context:

**Metadata examples**:
- Request/response payloads
- User details
- Configuration values
- Debug information

**Metadata is not searchable**: Use annotations for filterable data, metadata for context when viewing specific traces.

**Limits**: 64 KB per segment total (annotations + metadata combined).

## Instrumentation

### SDK Integration

**Supported languages**:
- Node.js
- Python
- Java
- .NET
- Go
- Ruby

**Installation** (Node.js):
```bash
npm install aws-xray-sdk-core
```

**Basic instrumentation**:
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const http = AWSXRay.captureHTTPs(require('http'));
```

This automatically traces AWS SDK calls and HTTP requests.

### Lambda Instrumentation

**Enable active tracing**:
- Console: Configuration → Monitoring → Enable active tracing
- CloudFormation: `Properties.TracingConfig.Mode: Active`
- SAM: `Tracing: Active`

**Lambda includes X-Ray daemon**: No need to run daemon separately.

**Instrumentation** (Node.js):
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

exports.handler = async (event) => {
  // X-Ray automatically traces this function
  const segment = AWSXRay.getSegment();
  segment.addAnnotation('user_id', event.userId);

  // DynamoDB call is traced automatically
  const result = await dynamodb.getItem({...}).promise();

  return { statusCode: 200, body: JSON.stringify(result) };
};
```

**IAM permissions**: Lambda execution role needs `xray:PutTraceSegments` and `xray:PutTelemetryRecords`.

### ECS/EKS Instrumentation

**Deploy X-Ray daemon as sidecar**:

ECS task definition:
```json
{
  "containerDefinitions": [
    {
      "name": "app",
      "image": "my-app:latest",
      "environment": [
        {"name": "AWS_XRAY_DAEMON_ADDRESS", "value": "xray-daemon:2000"}
      ]
    },
    {
      "name": "xray-daemon",
      "image": "amazon/aws-xray-daemon",
      "portMappings": [{"containerPort": 2000, "protocol": "udp"}]
    }
  ]
}
```

Kubernetes DaemonSet:
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: xray-daemon
spec:
  template:
    spec:
      containers:
      - name: xray-daemon
        image: amazon/aws-xray-daemon
        ports:
        - containerPort: 2000
          protocol: UDP
```

**Application code**: Same as Lambda (capture AWS SDK and HTTP calls).

### EC2 Instrumentation

**Install X-Ray daemon**:
```bash
# Amazon Linux 2
sudo yum install aws-xray-daemon
sudo systemctl start xray
```

**Configure daemon endpoint**:
```bash
export AWS_XRAY_DAEMON_ADDRESS=127.0.0.1:2000
```

**Application instrumentation**: Same SDK code as Lambda/ECS.

## Service Map

The service map visualizes your distributed architecture automatically:

### Map Generation

**How it works**: X-Ray analyzes traces and builds a graph of services and their dependencies. Each node is a service, each edge is a call relationship.

**Map updates**: Service map updates within 1-2 minutes as new traces arrive.

**Retention**: Service map shows services from last 6 hours by default, configurable up to 30 days.

### Map Components

**Nodes**:
- **Client**: External clients making requests
- **AWS Services**: API Gateway, Lambda, DynamoDB, S3, etc.
- **EC2/ECS Services**: Your applications
- **External Services**: Third-party APIs (Stripe, SendGrid, etc.)

**Node colors**:
- Green: Healthy (no errors)
- Yellow: Some errors (< 5%)
- Red: High error rate (≥ 5%)
- Purple: Throttled requests

**Edges**: Lines between nodes show request flow. Thickness indicates request volume.

### Service Details

**Click on a node** to see:
- Request count and rate
- Average/p50/p95/p99 latency
- Error rate and count
- Throttle rate
- Alarms associated with service
- Response time distribution histogram

**Drill down**: Click "View traces" to see individual traces for that service.

### Filtering the Map

**Time range**: Last 5 minutes, 1 hour, 6 hours, 1 day, custom range

**Annotations**: Filter by annotation values (e.g., show only `customer_tier=premium`)

**Focus mode**: Click "Focus on" to hide unrelated services and show only dependencies for selected service.

## Trace Analysis

### Searching Traces

**Filter by**:
- Time range
- Response time (e.g., traces > 2 seconds)
- HTTP status code (e.g., 4xx or 5xx errors)
- Annotations (e.g., `customer_tier=premium`)
- Partial URLs (e.g., `/api/checkout`)

**Filter expressions**:
```
service("my-api") AND http.status = 500
responsetime > 5
annotation.customer_tier = "premium" AND http.status = 200
```

**Trace list**: Shows matching traces with duration, status, and timeline preview.

### Trace Timeline

**Timeline view**: Visual representation of request flow through services.

**Reading timelines**:
- Horizontal axis: Time
- Each bar: Service or subsegment
- Bar length: Duration
- Bars stacked vertically: Sequential operations
- Bars side-by-side: Parallel operations

**Example timeline insights**:
- Long gap between subsegments = inefficiency (sequential operations that could be parallel)
- Thin bars scattered across timeline = many small operations (potential N+1 query)
- One thick bar dominating timeline = bottleneck

### Analytics

**Trace analytics** provides aggregate insights:

**Response time distribution**: Histogram showing how many traces fall into latency buckets (0-100ms, 100-200ms, etc.)

**Use cases**:
- Identify latency outliers (why do 1% of requests take 10× longer?)
- Compare latency distributions before/after deployments
- Understand typical vs worst-case performance

**Group traces by**:
- Service
- HTTP method
- Response code
- Custom annotations

Example: Compare checkout latency for premium vs free users by grouping by `customer_tier` annotation.

### Insights

**X-Ray Insights** uses machine learning to detect anomalies:

**Fault detection**: Increased error rates in a service
**High latency detection**: Unusual latency patterns
**Throttling detection**: Increased throttling

**Insight details**:
- When anomaly started
- Baseline vs anomaly metrics
- Affected services
- Example traces showing issue

**Insights timeline**: Shows when anomalies occurred over last 24 hours.

## Sampling

X-Ray samples traces to balance visibility and cost:

### Sampling Rules

**Default sampling**:
- First request each second: Always sampled (reservoir)
- Additional requests: 5% sampled (rate)

This ensures you see at least one trace per second even at low traffic, plus a statistical sample at high traffic.

**Custom sampling rules**:

```json
{
  "version": 2,
  "rules": [
    {
      "description": "Sample all errors",
      "host": "*",
      "http_method": "*",
      "url_path": "*",
      "fixed_target": 0,
      "rate": 1.0,
      "priority": 1,
      "service_name": "*",
      "service_type": "*",
      "resource_arn": "*",
      "attributes": {
        "http.status": "5*"
      }
    },
    {
      "description": "Sample premium users at 100%",
      "priority": 10,
      "fixed_target": 1,
      "rate": 1.0,
      "attributes": {
        "customer_tier": "premium"
      }
    },
    {
      "description": "Sample regular traffic at 10%",
      "priority": 100,
      "fixed_target": 1,
      "rate": 0.10
    }
  ]
}
```

**Rule priority**: Lower number = higher priority. First matching rule applies.

**Fixed target (reservoir)**: Number of requests per second to always sample.

**Rate**: Percentage of additional requests to sample (0.0 to 1.0).

### Sampling Strategies

**Sample all errors**: Ensures you have traces for every failure, even rare ones.

**Sample high-value requests**: 100% sampling for premium users, critical endpoints, or high-value transactions.

**Sample normal traffic lightly**: 5-10% sampling for typical requests provides statistical visibility without excessive cost.

**Sample based on response time**: Some SDKs support sampling based on latency (sample all slow requests).

**Time-based sampling**: Increase sampling during incidents or deployments.

### Sampling Cost Trade-offs

**Higher sampling rate**:
- More complete visibility
- Better statistical confidence
- Higher cost (traces ingested and analyzed)

**Lower sampling rate**:
- Lower cost
- Risk of missing intermittent issues
- Less confidence in percentile calculations

**Typical strategy**: 100% error sampling + 100% high-value customer sampling + 5-10% baseline sampling.

## Integration Patterns

### API Gateway + Lambda

**Automatic tracing**:
1. Enable X-Ray in API Gateway stage settings
2. Enable active tracing in Lambda function
3. API Gateway creates segment for request
4. Lambda creates segment for execution
5. Segments automatically linked via trace ID

**Trace shows**:
- API Gateway request handling time
- Lambda cold start vs warm start
- Lambda execution time
- Downstream calls from Lambda (DynamoDB, S3, etc.)

**Best practice**: Add annotations for API endpoint, user type, request region.

### Microservices Communication

**HTTP propagation**:
- Service A calls Service B via HTTP
- X-Ray SDK adds `X-Amzn-Trace-Id` header
- Service B extracts header and continues trace

**Node.js example** (Service A):
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const http = AWSXRay.captureHTTPs(require('http'));

// HTTP call automatically includes trace header
http.get('http://service-b/api/data', (res) => {
  // Response handling
});
```

**Service B** extracts trace context automatically when using X-Ray SDK.

### Asynchronous Messaging

**SQS integration**:
- Service A sends message to SQS
- Service A includes trace ID in message attributes
- Service B receives message and continues trace

**Example** (sending):
```javascript
const segment = AWSXRay.getSegment();
const traceHeader = segment.trace_id;

await sqs.sendMessage({
  QueueUrl: queueUrl,
  MessageBody: JSON.stringify(data),
  MessageAttributes: {
    'AWSTraceHeader': {
      DataType: 'String',
      StringValue: traceHeader
    }
  }
}).promise();
```

**Example** (receiving):
```javascript
const traceHeader = message.MessageAttributes.AWSTraceHeader.StringValue;
AWSXRay.setSegment(traceHeader);
```

**SNS and EventBridge**: Similar pattern; propagate trace ID via message attributes.

### Step Functions Integration

**Enable tracing**: Step Functions automatically traces execution when X-Ray is enabled.

**Trace shows**:
- Each state execution
- State transitions
- Lambda invocations from states
- Wait times between states

**Use case**: Visualize long-running workflows, identify slow states, debug failed executions.

### CloudWatch ServiceLens

ServiceLens combines X-Ray traces with CloudWatch metrics and logs:

**Unified view**:
- Service map from X-Ray
- Metrics from CloudWatch (requests, latency, errors)
- Logs from CloudWatch Logs
- Alarms and anomalies

**Correlation**: Click on a service to see metrics, traces, and logs together. During an incident, you see the error rate spike (metric), example traces showing failures (X-Ray), and error messages (logs) in one place.

## Performance Optimization

### SDK Overhead

**X-Ray SDK overhead**:
- Minimal CPU impact (typically <1%)
- Network overhead: Segments sent to daemon via UDP (low latency)
- Memory: Negligible for typical workloads

**Lambda cold starts**: X-Ray SDK adds ~50-100ms to cold start. Not significant compared to typical cold start times (1-3 seconds).

### Daemon Performance

**X-Ray daemon batching**: Daemon batches segments before sending to X-Ray service (reduces API calls).

**Daemon resource usage**:
- CPU: <5% for typical workloads
- Memory: ~50-100 MB
- Network: ~10-50 KB per traced request

**Daemon placement**:
- Lambda: Included in runtime, no configuration needed
- ECS/EKS: Sidecar container or DaemonSet (sidecar = per-task overhead, DaemonSet = per-node overhead)
- EC2: Runs as background service

### Sampling Optimization

**Reduce trace volume**: Lower sampling rate reduces:
- Traces ingested (cost)
- Daemon CPU and network usage
- Application SDK overhead (fewer segments created)

**Target high-value traces**: Sample 100% of errors and critical paths, 5% of normal traffic.

## Cost Optimization Strategies

### Pricing Model

**X-Ray pricing**:
- **Traces recorded**: $5 per 1 million traces (first 100,000 free per month)
- **Traces retrieved**: $0.50 per 1 million traces retrieved
- **Traces scanned**: $0.50 per 1 million traces scanned

**Example costs**:
- 10 million requests/month at 10% sampling = 1 million traces = $5/month
- 100 million requests/month at 10% sampling = 10 million traces = $50/month
- 1 billion requests/month at 5% sampling = 50 million traces = $250/month

### Sampling Strategies for Cost

**Reduce sampling rate**: 5% sampling instead of 10% = 50% cost reduction.

**Sample errors aggressively**: 100% error sampling ensures you never miss failures, minimal cost impact (errors should be rare).

**Sample by endpoint**: Sample critical endpoints at 100%, non-critical at 5%.

**Sample by customer tier**: Sample premium users at 100%, free users at 5%.

**Time-based sampling**: Increase sampling during business hours or after deployments, decrease overnight.

### Trace Retention

**Trace retention**: X-Ray retains traces for 30 days (not configurable).

**Archive traces**: Export traces to S3 for long-term retention and compliance.

**Use CloudWatch Logs**: For long-term retention of request details, log important request data to CloudWatch Logs and use X-Ray for active investigation.

### Data Transfer Costs

**X-Ray API calls**: Minimal cost (traces sent to regional endpoint).

**Cross-region tracing**: Traces stay in the region where segments are created. Multi-region applications have traces in each region. No cross-region data transfer for tracing.

## Security Best Practices

### IAM Permissions

**Minimal permissions for applications**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords"
      ],
      "Resource": "*"
    }
  ]
}
```

**Read permissions for operators**:
```json
{
  "Effect": "Allow",
  "Action": [
    "xray:GetSamplingRules",
    "xray:GetSamplingTargets",
    "xray:GetSamplingStatisticSummaries",
    "xray:GetServiceGraph",
    "xray:GetTraceGraph",
    "xray:GetTraceSummaries",
    "xray:BatchGetTraces"
  ],
  "Resource": "*"
}
```

**Restrict by resource tags**: Use resource tags and IAM conditions to restrict access to specific applications.

### Data Protection

**Sensitive data in traces**:
- X-Ray segments may contain HTTP request/response data
- Metadata can contain request bodies and user information
- Annotations and metadata are stored unencrypted

**Best practices**:
- Never log passwords, API keys, credit card numbers, PII
- Sanitize request/response data before adding as metadata
- Use annotations for high-level categorization, not sensitive values
- Implement application-level filtering to redact sensitive fields

**Encryption**:
- X-Ray encrypts data in transit (TLS)
- Data at rest encryption with AWS-managed keys (no customer-managed keys support)

### Access Control

**Restrict trace access**: Use IAM policies to limit who can view traces.

**Example**: Developers can view traces for their services only:
```json
{
  "Effect": "Allow",
  "Action": "xray:BatchGetTraces",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "xray:ServiceName": "my-team-service"
    }
  }
}
```

**Cross-account tracing**: X-Ray supports cross-account tracing when services in different accounts call each other. Requires proper IAM roles and trust relationships.

### Compliance

**Trace retention**: 30 days automatic retention. For compliance requiring longer retention, export traces to S3.

**Audit access**: Use CloudTrail to log X-Ray API calls (who accessed which traces, when).

## When to Use X-Ray vs Alternatives

### X-Ray Strengths

**Use X-Ray when**:
- Building on AWS with AWS-native services (Lambda, API Gateway, DynamoDB)
- Minimal third-party dependencies
- Cost-conscious distributed tracing (low cost at moderate scale)
- Tight integration with CloudWatch and ServiceLens desired
- Serverless architectures (Lambda, API Gateway, Step Functions)
- Quick setup without operational overhead (managed service)

### Third-Party APM Tools

**Consider Datadog, New Relic, Dynatrace when**:
- Advanced APM features (code-level profiling, user session tracking, real-user monitoring)
- Hybrid/multi-cloud environments (AWS + Azure + GCP + on-premises)
- Richer trace analysis and visualization
- Integrated metrics, logs, and traces in one platform
- Superior user experience and dashboards
- Advanced anomaly detection and alerting

**Cost comparison** (approximate for 100M requests/month):
- X-Ray at 10% sampling: ~$50/month
- Datadog APM: $500-2,000/month (includes metrics and logs)
- New Relic: $500-2,500/month

Third-party tools cost 10-50× more but provide significantly richer features.

### Open-Source Distributed Tracing

**Consider Jaeger, Zipkin when**:
- Open-source preference (no vendor lock-in)
- Self-hosted infrastructure (cost control at very high scale)
- Custom trace storage and retention policies
- Integration with OpenTelemetry ecosystem
- Multi-cloud portability

**Trade-offs**:
- Operational overhead (running Jaeger/Zipkin infrastructure)
- Less AWS-native integration
- DIY setup and instrumentation

**AWS-managed option**: Amazon Managed Service for Grafana supports Jaeger and Tempo data sources.

### OpenTelemetry

**AWS Distro for OpenTelemetry (ADOT)**: Supports sending traces to X-Ray using OpenTelemetry SDK.

**Benefits**:
- Vendor-neutral instrumentation (switch from X-Ray to Jaeger without code changes)
- Broader ecosystem and language support
- Standard trace format

**Use ADOT when**:
- Want flexibility to switch tracing backends
- Prefer OpenTelemetry standard over vendor SDKs
- Multi-cloud portability required

**Trade-off**: Slightly more complex setup than native X-Ray SDK.

### Complementary Tools

**X-Ray + CloudWatch**: X-Ray for traces, CloudWatch for metrics and logs. Use ServiceLens for unified view.

**X-Ray + third-party**: Some organizations use X-Ray for AWS-native services and third-party APM for custom applications. Complexity trade-off for best-of-breed tools.

## Common Pitfalls

### Missing Trace Context Propagation

**Problem**: Services don't propagate trace IDs, creating disconnected traces instead of unified request flow.

Example: Service A calls Service B via HTTP but doesn't include `X-Amzn-Trace-Id` header. X-Ray shows two separate traces instead of one connected trace.

**Solution**: Use X-Ray SDK to capture HTTP libraries (`captureHTTPs`). SDK automatically propagates trace headers.

**Asynchronous messaging**: Manually propagate trace ID via message attributes for SQS, SNS, EventBridge.

### Over-Sampling in Production

**Problem**: 100% sampling in high-traffic production environments creates excessive cost and daemon overhead.

Example: 1 billion requests/month at 100% sampling = 1 billion traces = $5,000/month.

**Solution**:
- Use sampling rules to sample 5-10% of normal traffic
- Sample 100% of errors and high-value requests
- Reserve high sampling for development and staging environments

### Ignoring Annotations

**Problem**: Traces have no annotations, making filtering impossible. During incident, you can't filter by customer tier, region, or feature flag.

**Solution**: Add strategic annotations for common filter criteria:
- User type (free, premium, enterprise)
- Region or availability zone
- Feature flags (A/B test variants)
- API version
- Environment (if traces from multiple environments go to same X-Ray region)

### Sensitive Data in Traces

**Problem**: Traces contain passwords, credit card numbers, or PII in metadata or HTTP headers.

Example: Request payload includes credit card number. X-Ray stores it in segment metadata. Compliance violation.

**Solution**:
- Sanitize request/response data before logging
- Configure X-Ray SDK to exclude sensitive headers
- Avoid logging request bodies that might contain sensitive data
- Implement application-level redaction

### Missing Error Handling

**Problem**: Application code throws exceptions without marking segments as errors. X-Ray shows success even though request failed.

**Solution**: Catch exceptions and add errors to segments:
```javascript
try {
  // Your code
} catch (error) {
  const segment = AWSXRay.getSegment();
  segment.addError(error);
  throw error;
}
```

X-Ray SDK automatically captures uncaught exceptions in most cases, but explicit error handling ensures proper trace marking.

### Daemon Not Running

**Problem**: Application instrumented with X-Ray SDK but daemon not running or unreachable. Segments never reach X-Ray service.

**Symptoms**:
- No traces appear in X-Ray console
- Application logs show "failed to send segment" errors

**Solution**:
- Verify daemon is running (ECS sidecar, Kubernetes DaemonSet, EC2 service)
- Check network connectivity (application can reach daemon on UDP port 2000)
- Check IAM permissions (daemon has `xray:PutTraceSegments` permission)
- Enable X-Ray SDK debug logging to see segment sending attempts

### Not Using Service Map for Architecture Review

**Problem**: Service map available but never used for architecture review or documentation.

**Missed opportunity**: Service map automatically documents your architecture as it actually works, not as you think it works. It reveals unexpected dependencies, circular calls, and underutilized services.

**Solution**: Regular architecture review using service map:
- Identify unexpected dependencies (should Service A really call Service D directly?)
- Find missing circuit breakers (what happens if Service B fails?)
- Discover inefficient patterns (Service C makes 50 calls to Service D per request)

### Inadequate Sampling for Rare Issues

**Problem**: Low sampling rate (1%) misses intermittent errors that happen 0.1% of the time.

Example: Payment processing has a 0.1% error rate (1 in 1,000 requests). With 1% sampling, you only capture 0.001% of errors in traces.

**Solution**: Use sampling rules to sample all errors (100%) regardless of normal sampling rate. Custom sampling rule with priority 1 that matches error status codes.

## Key Takeaways

**X-Ray provides distributed tracing for AWS services and custom applications**: It follows requests across Lambda, API Gateway, DynamoDB, and custom microservices, showing you the complete request flow and identifying bottlenecks.

**Service map automatically visualizes your architecture**: The service map shows dependencies, request volumes, error rates, and latency without manual documentation. It's your living architecture diagram.

**Traces answer "why is this request slow?"**: CloudWatch metrics tell you that latency is high. X-Ray traces show you which specific operation took 2 seconds and why.

**Strategic sampling balances cost and visibility**: Sample 100% of errors and critical requests, 5-10% of normal traffic. This ensures you capture important traces without excessive cost.

**Annotations enable powerful filtering**: Add annotations for user type, region, feature flags, and other dimensions. During incidents, filter traces to specific customer segments or deployment versions.

**Propagate trace context across services**: For HTTP calls, use X-Ray SDK's captured HTTP libraries. For async messaging, manually propagate trace IDs via message attributes.

**X-Ray integrates deeply with AWS services**: Lambda, API Gateway, Step Functions, and App Runner support X-Ray with minimal configuration. Enable active tracing and get immediate visibility.

**ServiceLens unifies metrics, traces, and logs**: CloudWatch ServiceLens combines X-Ray traces with CloudWatch metrics and logs for complete operational visibility.

**Third-party APM tools provide richer features**: Datadog, New Relic, and Dynatrace cost 10-50× more than X-Ray but offer code-level profiling, advanced analytics, and superior UX. Consider trade-offs based on budget and requirements.

**OpenTelemetry provides vendor neutrality**: AWS Distro for OpenTelemetry lets you instrument once with standard SDK and send traces to X-Ray, Jaeger, or other backends without code changes.

**X-Ray is cost-effective for AWS-native serverless architectures**: At $5 per million traces, X-Ray is inexpensive for serverless workloads with moderate traffic. Costs scale linearly with traced requests.

**Use X-Ray for operational intelligence, not just monitoring**: The service map, trace analysis, and insights reveal architectural inefficiencies, unexpected dependencies, and optimization opportunities that metrics alone miss.
