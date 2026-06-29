---
title: "AWS Lambda for System Architects"
layout: guide
category: AWS
subcategory: Compute Services
description: "Comprehensive guide to AWS Lambda covering event-driven patterns, performance optimization, cost strategies, security, and when to use serverless vs alternatives"
tags: [aws, serverless, lambda, event-driven, cost-optimization, fundamentals]
---

## What Problems Lambda Solves

AWS Lambda provides event-driven compute capacity without managing servers, addressing fundamental infrastructure challenges that organizations face with traditional compute models.

**Infrastructure challenges solved:**

**Operational overhead elimination**: No server provisioning, patching, or infrastructure management. AWS automatically manages availability and fault tolerance by running functions across multiple Availability Zones. You write code and AWS handles everything else.

**Cost inefficiency for variable workloads**: Pay only for compute time consumed, billed per millisecond. For sporadic workloads, Lambda costs are up to 75% less than EC2. No charges for idle capacity. A function invoked 100 times per day for 1 second each costs $0.06/month. The same workload on EC2 (running 24/7) costs $15+/month.

**Scaling complexity**: Automatic scaling from zero to thousands of concurrent executions without configuration. As of 2023, each function can burst to 1,000 concurrent executions instantly, scaling 12x faster than previous generations. No Auto Scaling Groups, no capacity planning.

**Event-driven architecture**: Native integration with 200+ AWS event sources without custom polling logic. S3 uploads, DynamoDB changes, API Gateway requests, and SQS messages all trigger Lambda automatically.

### When EC2 is Better

**Consistent, predictable high workloads**: If your application runs continuously with high utilization, EC2 with Reserved Instances or Savings Plans is more cost-effective. Lambda excels at variable workloads while EC2 excels at sustained load.

**Full server control requirements**: Applications requiring custom OS configurations, kernel modules, or legacy dependencies incompatible with Lambda runtimes need EC2.

<div class="callout callout--note">
<p class="callout__title">Hard Limit</p>
<p><strong>Execution times exceeding 15 minutes</strong>: Lambda has a hard 15-minute timeout. Batch jobs, long-running analytics, or workflows exceeding this limit require EC2, ECS, or Step Functions.</p>
</div>

**Very high, sustained CPU requirements**: Applications with constant high CPU utilization benefit from dedicated EC2 capacity pricing models.

## Lambda Fundamentals

### Event-Driven Architecture Patterns

Lambda functions are triggered by events from AWS services or custom applications. Understanding invocation models is critical for designing reliable, cost-effective serverless architectures.

#### Synchronous (Request-Response) Pattern

**How it works**: Caller invokes Lambda and waits for response. Lambda processes event immediately and returns result.

**Event sources**:
- Amazon API Gateway (HTTP APIs, REST APIs, WebSocket APIs)
- Application Load Balancer (ALB)
- Amazon CloudFront (Lambda@Edge)
- AWS SDK (`Invoke` API with `RequestResponse` invocation type)
- Amazon Cognito (custom authentication flows)
- Amazon Lex (conversational bots)

**Characteristics**:
- 6 MB payload limit (request + response combined)
- No automatic retries; caller responsible for retry logic
- Errors returned immediately to caller (function error → 502 Bad Gateway from API Gateway)
- Use for user-facing APIs, synchronous workflows, real-time processing

**Example flow**:
```
User → API Gateway (POST /orders) → Lambda (processOrder) → DynamoDB PutItem → Lambda returns {orderId: 123} → API Gateway returns 201 Created
```

#### Asynchronous (Fire-and-Forget) Pattern

**How it works**: Caller invokes Lambda asynchronously. Lambda places event in internal queue and returns 202 Accepted immediately. Function processes event later.

**Event sources**:
- Amazon S3 (object created/deleted events)
- Amazon SNS (topic messages)
- Amazon EventBridge (scheduled events, custom events)
- AWS CodeCommit (repository triggers)
- Amazon SES (incoming email)
- AWS CloudFormation (custom resources)

**Characteristics**:
- 256 KB event payload limit
- Automatic retries: 2 attempts (1 minute between first two, 2 minutes between second and third)
- Maximum event age: Configurable up to 6 hours
- Events discarded after max retries or max age
- 2xx response means event queued, not processed

**Example flow**:
```
User uploads image → S3 → Event queued → Lambda processes async → Resizes image → Saves to S3 thumbnail bucket
```

**Error handling**: Configure Destinations (on success/failure) to route events to SQS, SNS, EventBridge, or another Lambda function. Destinations provide richer metadata than traditional Dead Letter Queues (DLQs).

#### Event Source Mapping (Poll-Based) Pattern

**How it works**: Lambda polls event source on your behalf and invokes function with batches of records.

**Event sources**:
- Amazon SQS (Standard and FIFO queues)
- Amazon Kinesis Data Streams
- Amazon DynamoDB Streams
- Amazon MSK (Managed Kafka)
- Self-managed Apache Kafka
- Amazon MQ (RabbitMQ, ActiveMQ)

**Characteristics**:
- Lambda manages polling automatically
- Configurable batch size (1-10,000 records depending on source)
- Configurable batch window (0-300 seconds): Wait to accumulate records before invoking
- Supports partial batch failures (return specific failed records for retry)

**Concurrency behavior**:
- **SQS Standard**: Scales up to 1,000 concurrent executions processing batches in parallel
- **SQS FIFO**: Processes messages in order; limited concurrency to number of message groups
- **Kinesis/DynamoDB Streams**: One concurrent execution per shard
- **Kafka**: Configurable event pollers (2024 Provisioned Mode)

**Example flow**:
```
Producer → SQS Queue → Lambda polls every N seconds → Receives batch of 10 messages → Processes → Deletes from queue
```

### Execution Lifecycle

Lambda functions execute in three phases:

**INIT Phase (Cold Start)**:
- Download code and layers (max 250 MB unzipped)
- Start runtime environment (Node.js, Python, Java, .NET, etc.)
- Run initialization code outside handler
- Only occurs for new execution environments or after scaling

**INVOKE Phase**:
- Run handler function
- Process event
- Return response
- Occurs for every invocation

**SHUTDOWN Phase**:
- Clean up resources
- Environment terminated after period of inactivity (typically 15-60 minutes)

<div class="callout callout--tip">
<p class="callout__title">Execution Environment Reuse</p>
<p>Lambda reuses environments when possible to improve performance. Subsequent invocations skip the INIT phase. Database connections, SDK clients, and cached data persist across invocations in the same environment. Functions must be stateless; there's no guarantee of reuse.</p>
</div>

### Cold Starts vs Warm Starts

**Cold Start**: Occurs when function hasn't been invoked recently or scaling creates new execution environment. Includes INIT + INVOKE phases.

**Latency**:
- Node.js/Python: 100-500ms
- Java/.NET (historical): 1-3 seconds due to JVM/CLR initialization
- VPC-enabled functions: Additional 50-100ms (minimal penalty with Hyperplane networking)

**Warm Start**: Reuses existing execution environment. Only INVOKE phase executes. Latency is single-digit milliseconds to ~100ms. Database connections, cached data, and initialized SDK clients are available immediately.

### Concurrency Model

**Account-level concurrency**:
- Default regional limit: 1,000 concurrent executions (soft limit; request increase via support)
- Shared across all functions in region
- New accounts have reduced limits initially

**Function-level scaling (2023 improvement)**:
- Each function scales independently at 1,000 executions every 10 seconds
- Burst limit: 1,000 concurrent executions instantly
- After burst, adds 1,000 every 10 seconds until account limit reached
- 12x faster scaling than previous generation

**Reserved Concurrency**:
- Allocates dedicated concurrency pool for specific function
- Guarantees availability but reduces concurrency for other functions
- Use sparingly—only for absolutely critical functions requiring guaranteed capacity
- Common mistake: Assigning reserved concurrency to every function unnecessarily

<div class="callout callout--warning">
<p class="callout__title">Concurrency Throttling</p>
<p>When the limit is reached, additional invocations are throttled. Synchronous invocations return 429 error. Asynchronous invocations retry automatically with exponential backoff for up to 6 hours.</p>
</div>

## Current Limitations and Constraints

### Hard Limits (Cannot Be Increased)

| Constraint | Limit | Notes |
|------------|-------|-------|
| **Maximum execution time** | 15 minutes (900 seconds) | Per invocation; use Step Functions for longer workflows |
| **Memory allocation** | 128 MB to 10,240 MB | 1 MB increments; CPU scales proportionally with memory |
| **Deployment package size (compressed)** | 50 MB (direct upload), 250 MB (S3) | Excludes layers |
| **Deployment package size (unzipped)** | 250 MB | Includes layers; use container images if exceeded |
| **Container image size** | 10 GB | Alternative to ZIP packages when dependencies exceed limits |
| **Synchronous payload** | 6 MB (request + response) | Applies to API Gateway, synchronous SDK invocations |
| **Asynchronous payload** | 256 KB | Applies to S3, SNS, EventBridge triggers |
| **/tmp ephemeral storage** | 512 MB (default) to 10 GB | Configurable; billed for storage > 512 MB |
| **Environment variables** | 4 KB total | All variables combined |
| **File descriptors** | 1,024 | Per execution environment |
| **Execution processes/threads** | 1,024 | Per execution environment |

### Soft Limits (Can Be Increased)

| Constraint | Default Limit | Notes |
|------------|---------------|-------|
| **Concurrent executions** | 1,000 per region | Account-wide; shared across all functions |
| **Function storage** | 75 GB | Combined size of all deployment packages and layers |

### Response Streaming Limits (2024)

- First 6 MB has uncapped bandwidth
- After 6 MB: 2 MB/s maximum rate
- Use for large payload responses (generating PDFs, large data exports, streaming results)

### Key Scaling Characteristics

- **Burst concurrency**: 1,000 executions instantly per function
- **Sustained scaling**: +1,000 executions every 10 seconds per function
- **Independent function scaling**: Each function scales independently without competing for burst capacity

## Performance Optimization

### Memory and CPU Relationship

Lambda allocates CPU power linearly in proportion to configured memory:

- **At 1,792 MB**: Function receives equivalent of 1 full vCPU
- **At 3,584 MB**: 2 vCPUs (can use multiple threads effectively)
- **At 10,240 MB**: ~5.7 vCPUs

**Optimization strategy**: Under-allocating memory causes longer execution times, potentially increasing total cost despite lower per-GB-second rate. Over-allocating wastes money on unused resources.

**Testing approach**:
1. Start with reasonable baseline (512 MB or 1,024 MB)
2. Test at higher memory levels (1,536 MB, 2,048 MB, 3,072 MB)
3. Measure: Duration × Memory × Price per GB-second
4. Choose configuration with lowest total cost, not lowest memory

**Example**:
- 512 MB, 2,000 ms execution → Cost: $0.0000166667
- 1,024 MB, 800 ms execution → Cost: $0.0000133334 (20% cheaper despite 2x memory)

### Function Initialization Best Practices

**Initialize outside handler (static initialization)**:

```csharp
// Good: Initialize outside handler
private static AmazonDynamoDBClient _dynamoClient = new AmazonDynamoDBClient();
private static HttpClient _httpClient = new HttpClient();
private static IConfiguration _config;

static MyFunction()
{
    // Load configuration once per execution environment
    _config = LoadConfigurationFromParameterStore();
}

public async Task<APIGatewayProxyResponse> FunctionHandler(APIGatewayProxyRequest request, ILambdaContext context)
{
    // Use pre-initialized clients
    // Reused across invocations in same execution environment
}
```

**Anti-pattern: Initialize inside handler**:

```csharp
// Bad: Creates new connections every invocation
public async Task<APIGatewayProxyResponse> FunctionHandler(APIGatewayProxyRequest request, ILambdaContext context)
{
    var dynamoClient = new AmazonDynamoDBClient(); // Recreated every time
    var httpClient = new HttpClient(); // New connection pool every time
    // Wastes initialization time and resources
}
```

**What to initialize statically**:
- AWS SDK clients (DynamoDB, S3, SQS, SNS)
- HTTP clients (configure connection pooling)
- Database connections (use connection pooling for RDS)
- Configuration loaded from Parameter Store or Secrets Manager
- Cached static assets in /tmp directory

**What NOT to store statically**:
- Request-specific variables
- User data or session state
- Temporary computation results (unless intentionally caching)

### Cold Start Mitigation (2024 Solutions)

#### Lambda SnapStart (Preferred for Java/.NET)

**What it is**: Lambda takes a Firecracker microVM snapshot of initialized function state. On cold start, restores from snapshot instead of re-initializing.

**Benefits**:
- Reduces cold start latency by up to 90%
- Java: 2,000ms → 200ms
- .NET: 1,500ms → 150ms
- No code changes required
- No additional cost

**How to enable**: Toggle SnapStart setting in Lambda console for function versions.

<div class="callout callout--note">
<p class="callout__title">SnapStart Limitations</p>
<ul>
<li>Cannot use with Provisioned Concurrency</li>
<li>Cannot use with Amazon EFS or ephemeral storage &gt; 512 MB</li>
<li>Only supported for Java 11+ and .NET 8+</li>
</ul>
</div>

#### Provisioned Concurrency (For Critical Latency Requirements)

**What it is**: Pre-initializes specified number of execution environments and keeps them warm.

**Benefits**:
- Responds in double-digit milliseconds
- Eliminates cold starts for provisioned capacity
- Works with Application Auto Scaling (schedule-based or metric-based)

**Cost**: ~2x standard Lambda pricing ($0.0000041667 per GB-second US East). Use only when SnapStart is insufficient or unavailable for your runtime.

**When to use**:
- User-facing APIs with strict SLAs (e.g., <100ms p99 latency)
- SnapStart insufficient (Node.js, Python runtimes don't support SnapStart)
- Predictable traffic spikes (scale up before peak, scale down after)

#### Optimize Dependencies

**Minimize package size**:
- Use tree-shaking and bundling tools (webpack, esbuild for Node.js)
- Remove unused libraries and dependencies
- Split large monolithic functions into smaller, specialized ones

**Lazy-load non-critical libraries**: Load inside handler for code paths that rarely execute. Trades initialization time for occasional slower execution.

**Example (Node.js)**:
```javascript
// Good: Lazy-load rarely-used library
exports.handler = async (event) => {
    if (event.action === 'generatePDF') {
        const PDFDocument = require('pdfkit'); // Only loaded when needed
        // Generate PDF
    }
    // Normal processing without PDF library overhead
};
```

#### Right-size Memory Allocation

Higher memory = more CPU = potentially faster initialization. Test to find optimal balance between cold start time and cost.

## Cost Optimization

### Pricing Model (2024/2025)

**Request charges**:
- $0.20 per 1 million requests
- Free tier: 1 million requests/month (perpetual)

**Duration charges (x86 architecture)**:
- $0.0000166667 per GB-second
- Billed in 1 ms increments
- Free tier: 400,000 GB-seconds/month (perpetual)

**Duration charges (arm64/Graviton2)**:
- $0.0000133333 per GB-second (20% cheaper than x86)
- Free tier applies equally

**Provisioned Concurrency**:
- $0.0000041667 per GB-second (US East)
- Charged for provisioned capacity even if not invoked
- Duration charges apply when invoked (20% discount for arm64)

### Graviton2 Processors (arm64)

**Cost and performance benefits**:
- 20% reduction in duration charges vs x86
- 34% better price-performance overall (combines lower cost + faster execution)
- Stacks with AWS Compute Savings Plans (additional 17% savings)

**Migration**:
- **Interpreted languages** (Node.js, Python, Ruby): Work without code changes—just update architecture setting
- **Container-based functions**: Rebuild image for arm64 platform
- **Compiled languages** (Java, .NET, Go, Rust): Recompile for arm64 target
- Check dependencies for arm64 compatibility (rare issue in 2024)

**Real-world example**:
Function running 10 million times/month at 512 MB and 1,000 ms duration:
- x86 cost: $8.53/month
- arm64 cost: $6.82/month (20% savings)
- At scale (100M requests/month): $85 → $68 = $17/month saved

### Right-Sizing Memory

**Memory optimization workflow**:

1. **Enable CloudWatch Lambda Insights** to track actual memory usage
2. **Run function under realistic load** (production traffic or load testing)
3. **Analyze "Max Memory Used" metric** in CloudWatch
4. **Test configurations**: Current, +50%, +100%
5. **Calculate cost**: (Average duration in seconds) × (Memory in GB) × (Price per GB-second) + (Request count × $0.0000002)
6. **Choose configuration with lowest total cost**

**Key insight**: Higher memory often results in lower total cost despite higher per-GB-second rate because faster execution reduces total duration.

### Cost Comparison: Lambda vs EC2

**For variable/unpredictable workloads**:
- Lambda: Lowest cost (pay only for actual usage)
- EC2: 3x more expensive (paying for idle capacity during low traffic)
- ECS: 4.5x more expensive (worst for variable workloads)

**For consistent high traffic (24/7 near-constant load)**:
- EC2 with Reserved Instances: Most cost-effective
- Lambda: Higher cost due to continuous execution charges
- Breakeven point: ~50% average utilization

### Additional Cost Optimization Strategies

**Use AWS Compute Savings Plans**: Commit to 1-year or 3-year usage for 17% discount on Lambda compute.

**Reduce CloudWatch Logs costs (2025 tiered pricing)**:
- $0.50/GB for first 10 GB/month
- $0.25/GB beyond 10 GB
- Implement log sampling for high-volume functions
- Use log retention policies (7 days for debug logs, 30 days for audit)

**Avoid over-provisioning Provisioned Concurrency**: Use Application Auto Scaling to adjust based on actual traffic patterns. Provisioning 100 warm environments when you need 20 wastes money.

**Minimize cross-region data transfer**: Keep Lambda and data sources (S3, DynamoDB) in the same region. Cross-region data transfer costs $0.02/GB.

**Replace simple integration Lambdas with EventBridge Pipes**: For point-to-point integrations without custom logic, EventBridge Pipes costs $0.40 per 1M requests vs Lambda's ~$2-20. Up to 98% savings.

## Security Best Practices

### IAM Roles for Lambda Execution

**Execution Role (function → AWS services)**: Every Lambda function has an IAM execution role that grants permissions to AWS services.

**Best practices**:
- **Least privilege**: Grant only permissions required for specific function operations
- **Function-specific roles**: Don't share roles across unrelated functions
- **Avoid managed policies like PowerUserAccess**: Create custom policies with minimal permissions
- **Regular audits**: Review permissions quarterly; remove unused policies

**Example execution role (minimal)**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Orders"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/my-function:*"
    }
  ]
}
```

**Resource-Based Policy (services → function)**: Controls which services and accounts can invoke the function. Use for API Gateway, S3 triggers, cross-account access.

### VPC Integration and When to Use It

**When VPC integration is necessary**:
- Accessing RDS databases in private subnets
- Connecting to ElastiCache clusters
- Accessing internal APIs on EC2 instances without public endpoints
- Compliance requirements mandate private network access

**When VPC is NOT necessary**:
- DynamoDB, S3, SNS, SQS (use IAM for access control; no VPC needed)
- Public APIs and SaaS services (Lambda has internet access by default outside VPC)

**Current VPC performance (2024)**: VPC cold start penalty is minimal (~50-100ms additional latency). AWS resolved historical issues (10-15 second ENI creation delay) using Hyperplane technology. VPC is no longer a significant performance factor in architecture decisions.

**VPC configuration best practices**:

**Use VPC Endpoints for AWS services**:
- Create VPC endpoints for S3, DynamoDB, Secrets Manager
- Keeps traffic within AWS network; no NAT Gateway costs
- Security group must allow outbound HTTPS (port 443)

**NAT Gateway for internet access**:
- Required if function needs to call external APIs
- Place Lambda in private subnet, route traffic through NAT Gateway in public subnet
- Cost: $0.045/hour + $0.045/GB data processed (~$32/month base + data transfer)

**Example: Lambda in VPC accessing RDS + Secrets Manager**:

Lambda security group outbound rules:
- Allow TCP 3306 (MySQL) to RDS security group
- Allow TCP 443 to VPC endpoint security group (Secrets Manager)

VPC endpoint security group inbound rules:
- Allow TCP 443 from Lambda security group

### Secrets Management

**Do NOT use environment variables for sensitive data**:
- Visible in console and API calls
- Stored unencrypted (AWS encrypts at rest, but accessible to anyone with console access)
- No rotation mechanism

**Use AWS Secrets Manager or Parameter Store (SecureString)**:

**Secrets Manager advantages**:
- Automatic secret rotation with Lambda rotation functions
- Versioning and rollback
- Fine-grained access control
- Audit logging via CloudTrail
- Cross-region replication

**Parameter Store advantages**:
- Lower cost: Free for standard parameters (up to 10,000)
- Integrated with Systems Manager
- Suitable for non-rotated secrets (API keys, configuration)

**Best practice implementation**:

```csharp
// Retrieve secrets during initialization (outside handler)
private static readonly AmazonSecretsManagerClient _secretsClient = new AmazonSecretsManagerClient();
private static string _dbPassword;

static MyFunction()
{
    // Retrieved once per execution environment; cached for subsequent invocations
    var request = new GetSecretValueRequest { SecretId = "prod/db/password" };
    var response = _secretsClient.GetSecretValueAsync(request).Result;
    _dbPassword = response.SecretString;
}
```

**Secrets Manager Lambda Extension (2024 recommended)**:
- Local HTTP endpoint caches secrets in execution environment
- Reduces latency and Secrets Manager API calls (lowers cost)
- Automatically refreshes secrets based on TTL
- Add Lambda layer: `arn:aws:lambda:region:secretsmanager-layer`

## Integration Patterns

### Synchronous Invocation Error Handling

**Characteristics**: Caller waits for response; no automatic retries.

**Error handling strategies**:
- Function error → API Gateway returns 502 Bad Gateway (default)
- Timeout → API Gateway returns 504 Gateway Timeout
- Implement custom error responses in function code
- Use try-catch blocks and return structured error responses

**Example (API Gateway integration)**:
```csharp
public async Task<APIGatewayProxyResponse> FunctionHandler(APIGatewayProxyRequest request, ILambdaContext context)
{
    try
    {
        var result = await ProcessRequest(request);
        return new APIGatewayProxyResponse
        {
            StatusCode = 200,
            Body = JsonSerializer.Serialize(result)
        };
    }
    catch (ValidationException ex)
    {
        return new APIGatewayProxyResponse
        {
            StatusCode = 400,
            Body = JsonSerializer.Serialize(new { error = ex.Message })
        };
    }
    catch (Exception ex)
    {
        context.Logger.LogError($"Unexpected error: {ex}");
        return new APIGatewayProxyResponse
        {
            StatusCode = 500,
            Body = JsonSerializer.Serialize(new { error = "Internal server error" })
        };
    }
}
```

### Asynchronous Invocation Error Handling

**Automatic retries**: Lambda retries twice (1 minute between first two attempts, 2 minutes between second and third).

**Configuration options**:
- **Retry attempts** (0-2): Reduce for idempotent operations
- **Maximum event age** (60s - 6 hours): Lower for time-sensitive events

**Destinations (preferred over DLQ)**:
- **On Success**: Send to SQS, SNS, EventBridge, Lambda
- **On Failure**: Send to SQS, SNS, EventBridge, Lambda
- Includes error message, stack trace, request/response payloads

**Best practice**: Use Destinations instead of Dead Letter Queues (DLQs). Destinations provide richer metadata and support more targets.

### Event Source Mapping Error Handling

**SQS**:
- Function error → Message returns to queue after visibility timeout
- Configure `maxReceiveCount` on SQS queue (recommended: ≥5)
- Messages exceeding max receives sent to Dead Letter Queue
- Use `ReportBatchItemFailures` to return specific failed messages (partial batch failure)

**Kinesis/DynamoDB Streams**:
- Function error → Lambda retries batch until success or data expires (24 hours Kinesis, configurable DynamoDB)
- Configure `MaximumRetryAttempts` and `MaximumRecordAgeInSeconds` to limit retries
- Use `BisectBatchOnFunctionError` to split failed batch and isolate poison records
- Configure `DestinationConfig` to send failed batches to SQS or SNS

## Observability

### CloudWatch Logs Integration

**Automatic integration**: All Lambda functions automatically send logs to CloudWatch Logs without configuration.

**Log groups**: Format is `/aws/lambda/<function-name>`. Log streams created per execution environment.

**Best practices**:

**Structured logging (JSON format)**:
```javascript
// Node.js example
console.log(JSON.stringify({
    event: 'order_created',
    orderId: '12345',
    amount: 99.99,
    customerId: 'cust-789',
    requestId: context.requestId // Include correlation ID
}));
```

**Include correlation IDs**: Extract request ID from context (`context.RequestId`) and include in every log statement for tracing across services.

**Log sampling for high-volume functions**: Log every request at DEBUG level only in non-production. Log errors, warnings, and sampled percentage (1-10%) in production to reduce costs.

**Set retention policies**: Default is indefinite (expensive). Recommended: 7 days for debug logs, 30-90 days for audit logs.

### Lambda Insights

CloudWatch Lambda Insights provides enhanced monitoring beyond basic metrics.

**Metrics provided**:
- Function-level: Invocations, duration, errors, throttles
- System-level: CPU time, memory utilization, network performance, disk I/O
- Cold starts vs warm starts

**Use cases**:
- Identify memory over-provisioning (allocated 3GB, using only 512MB)
- Identify CPU bottlenecks (CPU near 100%, duration high → increase memory for more CPU)
- Monitor cold start frequency (if high, consider SnapStart or Provisioned Concurrency)

**Enable**: Toggle "Enhanced Monitoring" in Lambda console or add Lambda Insights layer. Small additional cost (~$0.001 per invocation).

### AWS X-Ray for Distributed Tracing

X-Ray visualizes request flow across distributed applications.

**Enable**: Toggle "Active Tracing" in Lambda console. Lambda automatically instruments function with X-Ray SDK. No code changes required for basic tracing.

**What X-Ray captures**:
- Service map showing request flow (API Gateway → Lambda → DynamoDB → S3)
- Latency at each hop
- Error rates per service
- Subsegments showing initialization vs execution time

**Best practice**: Link X-Ray traces with CloudWatch Logs by including trace ID in log statements. Query CloudWatch Logs Insights by trace ID to see detailed logs for specific requests.

### Custom Metrics

**Embedded Metric Format (EMF), Recommended**:
Print JSON to stdout; Lambda automatically extracts metrics. No API calls; faster and cheaper than PutMetricData.

```javascript
// Node.js example
console.log(JSON.stringify({
    _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [{
            Namespace: "MyApp",
            Dimensions: [["FunctionName"]],
            Metrics: [{ Name: "OrdersProcessed", Unit: "Count" }]
        }]
    },
    FunctionName: "processOrders",
    OrdersProcessed: 42
}));
```

**Recommended metrics**:
- Business metrics: Orders processed, payments failed, users registered
- Performance metrics: External API latency, batch sizes processed
- Operational metrics: DLQ message count, retry attempts

## Development Best Practices

### Function Handler Design

**Core principle**: Separate handler from business logic.

**Thin handler pattern**:
```csharp
// Handler delegates to testable business logic
public async Task<APIGatewayProxyResponse> FunctionHandler(APIGatewayProxyRequest request, ILambdaContext context)
{
    var orderId = request.PathParameters["id"];
    var order = await _orderService.GetOrderAsync(orderId);

    return new APIGatewayProxyResponse
    {
        StatusCode = 200,
        Body = JsonSerializer.Serialize(order)
    };
}
```

Business logic in separate class (`OrderService`) with unit tests independent of Lambda runtime.

### Lambda Layers for Shared Dependencies

Lambda Layers package dependencies or custom runtime code separately from function code.

**Benefits**:
- Share common code across multiple functions (logging utilities, database helpers)
- Reduce deployment package size (move heavy dependencies to layer)
- Version management (update layer without redeploying all functions)

**Limitations**:
- Maximum 5 layers per function
- Layers count toward 250 MB unzipped limit
- Layers are immutable (new version required for updates)
- Region-specific (must publish to each region separately)

**Common use cases**:
- Shared libraries (boto3, requests, NumPy)
- Custom utilities (logging wrapper, authentication helper)
- AWS SDK versions (override default SDK with specific version)
- Secrets Manager extension (cache secrets locally)

### Container Image Support

Lambda supports container images up to 10 GB as an alternative to ZIP deployment packages.

**When to use container images**:
- Dependencies exceed 250 MB ZIP limit (ML models, large binaries)
- Existing container-based workflows (build once, deploy to Lambda and ECS)
- Custom runtime requirements (specific OS libraries, compiled binaries)

**When to use ZIP packages**:
- Smaller functions (<50 MB compressed)
- Faster deployment (ZIP upload faster than container image push to ECR)
- Simpler workflow (no Docker build step)

**Container image requirements**:
- Implement Lambda Runtime API (AWS provides base images for all runtimes)
- Expose handler via `CMD` instruction
- Use AWS-provided base images or custom images compatible with Lambda Runtime API

## When to Use Lambda vs Alternatives

### Decision Framework

| Factor | Lambda | ECS (Fargate) | EC2 |
|--------|--------|---------------|-----|
| **Workload pattern** | Sporadic, event-driven, unpredictable | Long-running containers, batch jobs | Consistent high load, predictable |
| **Execution time** | < 15 minutes | No limit | No limit |
| **Cost model** | Pay per request + duration | Pay for provisioned CPU/memory | Pay for instance hours |
| **Cost efficiency** | Best for variable workloads | 4.5x more than Lambda for variable | 3x more than Lambda for variable; best for sustained |
| **Management overhead** | Zero (fully managed) | Low (Fargate manages infrastructure) | High (patch OS, manage scaling) |
| **Cold start** | Yes (50-2000ms) | Yes (~10-30s container start) | No (always running) |
| **Scaling** | Automatic, instant burst to 1,000 | Scales based on metrics (slower) | Manual or Auto Scaling (slower) |

### Lambda vs Step Functions

**When to use Lambda alone**:
- Single-step processing (S3 upload → resize image → save)
- Simple event-driven workflows
- Latency-sensitive applications (Step Functions add orchestration overhead)

**When to use Step Functions**:
- Complex workflows with multiple steps, branching, error handling
- Long-running processes (hours to days; Step Functions supports up to 1 year)
- Human approval steps (wait for external signal)
- Parallel execution patterns (fan-out/fan-in)
- Retry logic with exponential backoff and circuit breakers

**Example**: Order processing with validation → inventory check → payment → confirmation → warehouse update benefits from Step Functions orchestration. Simple image resize operation uses Lambda alone.

### Lambda vs EventBridge Pipes

EventBridge Pipes (2022+) provides point-to-point integration between AWS services with filtering, enrichment, and transformation, all without Lambda code.

**When to use Lambda**:
- Custom business logic (complex validation, algorithmic processing)
- External API calls with custom error handling
- Operations requiring multiple AWS SDK calls

**When to use EventBridge Pipes**:
- Simple point-to-point integrations (SQS → Kinesis, DynamoDB Stream → SNS)
- Filtering events without processing
- Simple transformations (extract fields, rename keys)
- High-volume, low-complexity workflows

**Cost comparison** (1M events):
- EventBridge Pipes: $0.40
- Lambda (minimal logic): ~$2-5
- Savings: Up to 98% with Pipes for simple integrations

## Common Pitfalls

### Lambda Monoliths

**Anti-pattern**: Single Lambda function handles all application logic (all API Gateway routes, all event types).

**Problems**:
- Large deployment package → slower cold starts
- Difficult to apply least-privilege IAM (function needs permissions for all operations)
- Harder to test, maintain, and debug
- No granular concurrency control or scaling

**Solution**: Create specialized functions per operation. `/orders POST` → `createOrder` function. `/orders GET` → `listOrders` function. Each has minimal code, dependencies, and IAM permissions.

### Synchronous Lambda-to-Lambda Calls

**Anti-pattern**: Lambda A synchronously invokes Lambda B and waits for response.

**Problems**:
- Paying double (both functions running; billed for both)
- Cascading failures (if B fails, A fails)
- Timeout risk (A must wait for B; if B slow, A may timeout)
- Throttling (B's concurrency limits affect A)

**Solution**:
- Asynchronous invocation (Lambda A invokes Lambda B async, fire-and-forget)
- SQS decoupling (Lambda A → SQS Queue → Lambda B polls)
- Step Functions (orchestrate A and B; only one runs at a time)
- Direct integration (Can Lambda A call downstream service directly without Lambda B?)

### Recursive Loops

**Anti-pattern**: Lambda writes to S3 → S3 event triggers Lambda → Lambda writes to same bucket → Infinite loop.

**Problems**:
- Runaway scaling (consume all account concurrency)
- Massive costs (millions of invocations)
- Potential account suspension

**Solution**:
- Filter events (configure S3 event notification for specific prefix/suffix)
- Separate buckets (Lambda writes to different bucket than trigger source)
- Idempotency checks (Lambda detects and breaks loops)
- Reserved concurrency (limit function concurrency to cap maximum runaway cost)

### Missing Error Handling

**Anti-pattern**: Function fails silently; no logs, no DLQ, no retries.

**Problems**:
- Data loss (events discarded after retries exhausted)
- No visibility into failures
- Difficult to debug and recover

**Solution**:
1. Log errors with exception details, context, and input event
2. Configure Destinations (async invocations) to send failed events to SQS
3. Configure DLQs (SQS/Kinesis event sources) to quarantine poison messages
4. Set CloudWatch Alarms on error metrics → SNS → PagerDuty
5. Return partial batch failures (SQS/Kinesis) to retry only failed records

### Memory Over-Provisioning

**Anti-pattern**: Configure all functions with 3GB memory "to be safe" without testing.

**Problems**:
- Higher cost (memory correlates to price per GB-second)
- If function only uses 512 MB, paying for 2.5 GB unused

**Solution**: Enable Lambda Insights, test under realistic load, set memory to 10-20% above peak usage, re-evaluate periodically.

### VPC Configuration Without VPC Endpoints

**Anti-pattern**: Lambda in VPC needs S3 access → Uses NAT Gateway → $32/month + $0.045/GB data transfer.

**Problems**:
- Unnecessary cost for AWS service access
- Additional latency (traffic routes through NAT Gateway → internet → S3)

**Solution**: Create VPC Endpoints for S3, DynamoDB, Secrets Manager. Traffic stays within AWS network; no NAT Gateway costs. 100 GB/month S3 transfer: $36.50 via NAT Gateway vs $0 via VPC Endpoint.

## Key Takeaways

**1. Lambda excels at event-driven, variable workloads**: Automatic scaling from zero to thousands of concurrent executions without configuration. Pay only for compute time consumed. For sporadic workloads, Lambda costs up to 75% less than EC2. For sustained high load, EC2 with Reserved Instances is more cost-effective.

**2. Understand the three invocation models**: Synchronous (request-response, 6 MB payload), Asynchronous (fire-and-forget, 256 KB payload, automatic retries), Event Source Mapping (poll-based, batch processing). Each has different error handling, retry behavior, and concurrency characteristics.

**3. Cold starts are manageable**: Use Lambda SnapStart (Java/.NET) for 90% reduction. Use Provisioned Concurrency for critical latency requirements. Optimize initialization code (move SDK clients, database connections outside handler). Higher memory = more CPU = faster initialization.

**4. Cost optimization requires multiple strategies**: Use Graviton2 (arm64) for 20% savings. Right-size memory based on actual usage (higher memory often reduces total cost). Enable Compute Savings Plans for 17% discount. Reduce CloudWatch Logs costs with retention policies and log sampling. Replace simple integration Lambdas with EventBridge Pipes (98% cost reduction).

**5. Security starts with least-privilege IAM**: Create function-specific execution roles with minimal permissions. Use Secrets Manager or Parameter Store (not environment variables) for sensitive data. Use VPC only when accessing private resources (RDS, ElastiCache). Use VPC Endpoints for AWS services to avoid NAT Gateway costs.

**6. Observability is built-in but requires configuration**: CloudWatch Logs automatic but configure retention policies. Enable Lambda Insights for system-level metrics (CPU, memory, cold starts). Enable X-Ray Active Tracing for distributed tracing. Use Embedded Metric Format for custom business metrics.

**7. Development best practices matter**: Separate handler from business logic (testable code). Initialize SDK clients, database connections outside handler (reused across invocations). Use Lambda Layers for shared dependencies. Use container images when dependencies exceed 250 MB. Deploy with SAM (serverless-first) or CDK (multi-service).

**8. Choose the right compute service**: Lambda for event-driven, <15 minutes, variable workloads. ECS for long-running containers. EC2 for sustained high load. Step Functions for complex workflows. EventBridge Pipes for simple integrations without code.

**9. Avoid common anti-patterns**: No Lambda monoliths (create specialized functions). No synchronous Lambda-to-Lambda calls (use async or SQS). No recursive loops (filter events, separate buckets). Always implement error handling (Destinations, DLQs, CloudWatch Alarms). Right-size memory (test, don't guess).

**10. Recent 2024 improvements**: 12x faster scaling (1,000 concurrent executions instantly). SnapStart for .NET 8+. Application Signals for Lambda (Python/Node.js). Provisioned Mode for Kafka. S3 as failed-event destination. CloudWatch Logs tiered pricing (June 2025).
