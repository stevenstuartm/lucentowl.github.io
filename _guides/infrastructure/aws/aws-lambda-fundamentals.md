---
title: "AWS Lambda for System Architects"
layout: guide
category: AWS
subcategory: Compute Services
description: "How Lambda runs code and what that means for design: execution environments and cold starts, the three invocation models and their retry and failure handling, concurrency and scaling, SnapStart and provisioned concurrency, pricing, VPC access and secrets, function design, and the newer Managed Instances and durable functions."
tags: [lambda, serverless, cold-starts, concurrency, event-source-mapping, snapstart, fundamentals]
---

## What Lambda Is

A **Lambda function** is code plus a small amount of configuration: a runtime (such as .NET, Java, Python, or Node.js), a memory size, a timeout, and an **execution role** that sets what the code may call in AWS. The timeout defaults to 3 seconds, which is too short for many first deployments, so set it deliberately. You upload the code, and Lambda runs it when something invokes the function. There are no servers to size, patch, or scale, and when nothing invokes the function, nothing runs and nothing is charged.

A function is a Regional resource. Lambda runs it across the Availability Zones of its Region without any placement choices from you, and most of its limits, including the concurrency quota described below, apply per account per Region.

Each invocation runs inside an **execution environment**, an isolated micro virtual machine (a Firecracker microVM) that holds one copy of your runtime and code. An environment handles one invocation at a time. When more requests arrive than the existing environments can take, Lambda creates more environments, and when traffic falls, it removes them. Almost everything that distinguishes Lambda from a long-running server follows from that model:

- A new environment has to start before it can serve, which is the **cold start**.
- Scaling means adding environments, and the number of environments busy at once is the function's **concurrency**.
- Nothing in an environment is guaranteed to survive, so the function keeps its state somewhere else.
- A standard function's invocation can run for at most **15 minutes**.

Lambda is the wrong compute for steady, high utilization that never drops, for work that needs one invocation to run longer than 15 minutes, and for software that needs control of the operating system. Containers and EC2 fit those better, and the Lambda Managed Instances and durable functions options near the end of this guide stretch Lambda toward the first two.

---

## The Execution Environment

### Init, Invoke, and Shutdown

An environment moves through three phases:

| Phase | What happens | Limit |
|---|---|---|
| **Init** | Lambda starts any extensions (companion processes, usually added as layers, that run beside your code for jobs like caching secrets or shipping telemetry), bootstraps the runtime, and runs your function's static initialization code (everything outside the handler) | 10 seconds for standard on-demand functions. If Init doesn't finish, Lambda retries it on the first invocation under the function timeout |
| **Invoke** | Lambda calls your handler with the event and waits for it to return | The function timeout, up to 900 seconds (15 minutes) |
| **Shutdown** | Lambda signals extensions to clean up, then removes the environment | 0 to 2,000 ms, depending on which extensions are registered |

Init is billed. Since August 1, 2025, Lambda charges for Init duration on every function type, at the normal duration rate. Before that, Init was free for ZIP-packaged functions on managed runtimes, and older cost advice that treated heavy initialization as free no longer holds.

If an invocation crashes or times out, Lambda resets the environment. The next invocation that lands on it runs Init again first, and that extra time shows up inside the reported duration rather than as a separate Init entry.

### Cold Starts and Reuse

After an invocation, Lambda freezes the environment and keeps it for a while in case another request arrives. A request that finds a frozen environment skips Init entirely and runs only the handler, which is a **warm start**. A request that finds none waits for Lambda to create an environment and run Init first, which is a **cold start**.

AWS reports that cold starts typically affect under 1% of invocations and last from under 100 ms to over a second, depending on runtime, package size, and how much work the initialization code does. They cluster in two places: functions that are invoked rarely, whose environments are gone by the next request, and moments when traffic climbs, since each new environment starts cold.

Reuse is what pays back the cost of static initialization. Objects created outside the handler, such as SDK clients, HTTP clients, and database connections, survive into later invocations on the same environment, and so do files in `/tmp`. Background work that the handler started and didn't finish also resumes on the next invocation, so finish it before returning. None of this is guaranteed. Lambda recycles environments every few hours even for functions invoked continuously, so treat anything cached in an environment as an optimization that may vanish.

The same model explains concurrency. Each environment serves one request at a time, so when a second request arrives while the first is still running, Lambda has to start a second environment for it.

{% include figure.html id="aws-lambda-environment-reuse" %}

---

## How a Function Is Invoked

Every Lambda integration uses one of three invocation models. They differ in who waits, where retries happen, and where a failed event ends up, and choosing the integration usually chooses the model for you.

{% include figure.html id="aws-lambda-invocation-models" %}

### Synchronous Invocation

The caller sends the event and waits for the function's response. API Gateway, Application Load Balancers, Lambda function URLs (a built-in HTTPS endpoint per function), Cognito triggers, Lambda@Edge, and the SDK's `Invoke` call with the `RequestResponse` type all work this way.

- **Payload:** 6 MB for the request and 6 MB for the response, each.
- **Retries:** Lambda doesn't retry a failed synchronous invocation. The error goes back to the caller, and retrying is the caller's decision.
- **Throttling:** when the function is out of concurrency, the caller gets a `429` error.

**Response streaming** lets a synchronous function send its response in pieces as they're produced, which improves time to first byte and raises the response limit to 200 MB. The first 6 MB streams at full speed and the rest at up to 2 MB per second. Node.js managed runtimes support it natively, and other languages need a custom runtime or the open-source Lambda Web Adapter. Streaming works through function URLs, the `InvokeWithResponseStream` API, and API Gateway proxy integrations. Inside a VPC, AWS documents that function URLs don't support streaming, so VPC clients stream through the SDK call and an interface endpoint for Lambda. A streamed invocation keeps running, and billing, even if the client disconnects.

### Asynchronous Invocation

The caller hands the event to Lambda and gets an immediate `202` acknowledgment. Lambda places the event on an internal queue and invokes the function from there. S3 event notifications, SNS, EventBridge, and the SDK's `Invoke` call with the `Event` type use this model.

- **Payload:** 1 MB.
- **Function errors:** Lambda retries twice by default, waiting one minute before the first retry and two minutes before the second. You can lower retries to 0 or 1.
- **Throttles and service errors:** Lambda returns the event to its queue and keeps retrying with backoff (from 1 second up to 5 minutes between attempts) until the event reaches its **maximum age**, 6 hours by default. You can lower the maximum age to as little as 60 seconds.
- **Duplicates:** the internal queue is eventually consistent, so a function can receive the same event more than once even when nothing failed.

An event that exhausts its retries or its maximum age is discarded unless you capture it, using settings on the function, version, or alias. An **on-failure destination** receives a record with the original event, the error, and the response. It can be an SQS queue, an SNS topic, an S3 bucket, another function, or an EventBridge bus. The older **dead-letter queue** setting (an SQS queue or SNS topic) receives only the event, without the error details, and can be set only at the function level, not per version or alias. Prefer the destination. An **on-success destination** can also route the results of successful invocations onward.

### Event Source Mappings

For queues and streams, Lambda does the reading. An **event source mapping** is a Lambda-managed poller that reads records from the source, groups them into batches, and invokes the function synchronously with each batch. SQS, Kinesis Data Streams, DynamoDB Streams, Amazon MSK and self-managed Kafka, Amazon MQ, and Amazon DocumentDB change streams all work this way.

A mapping can wait up to 5 minutes (the **batch window**) to fill a batch, and each batch must fit in the 6 MB synchronous payload. Delivery is at least once, so duplicates are possible here too.

How the mapping scales and handles a failed batch depends on whether the source is a queue or a stream. A queue hands out messages independently, and a message that has been read stays hidden from other readers for the queue's **visibility timeout**, then reappears unless it was deleted. A stream is an ordered log split into **shards**, where each record's **partition key** decides its shard and records within a shard must be read in order.

| | SQS | Kinesis and DynamoDB Streams |
|---|---|---|
| **Parallelism** | Standard queues: starts at 5 concurrent invocations and adds up to 300 per minute, up to 1,250. FIFO queues: at most one batch per message group at a time | One batch per shard at a time by default. A **parallelization factor** of up to 10 processes more batches per shard while keeping order per partition key |
| **Limiting it** | A per-mapping **maximum concurrency** (2 to 1,000), or **provisioned mode** with a minimum and maximum number of dedicated pollers for faster scaling | Shard count and parallelization factor |
| **When a batch fails** | The whole batch returns to the queue and reappears after the visibility timeout | Lambda retries the batch until it succeeds or the records expire, which by default can take as long as the stream retains data, and the shard makes no progress in the meantime |
| **Partial batch response** | Only the messages reported as failed return to the queue | The mapping checkpoints at the first failed record and retries from there, so records after it are processed again |
| **Containing failures** | Set a dead-letter queue on the source queue, not the function | Cap `MaximumRetryAttempts` and `MaximumRecordAgeInSeconds`, turn on `BisectBatchOnFunctionError` to split a failing batch, and set an on-failure destination (SQS, SNS, or S3) on the mapping itself |

Two SQS settings matter on every mapping. Set the queue's visibility timeout to at least six times the function timeout, plus the batch window, so a throttled batch can be retried before its messages reappear. Lambda rejects a mapping whose function timeout is longer than the visibility timeout. And set the queue's `maxReceiveCount` to at least 5, so a message gets several attempts before it moves to the dead-letter queue. A visibility timeout shorter than the work lets messages reappear while an invocation is still processing them, and another invocation then processes them again.

On a stream, one record that always fails holds back everything behind it on its shard. The `IteratorAge` metric, how far the mapping trails the newest record, climbs while it waits, and it's the signal to alarm on. A stream's on-failure destination belongs to the mapping, so a destination set on the function never sees stream failures.

Kafka mappings also offer a provisioned mode with a minimum and maximum number of pollers, billed separately, for workloads that need steady throughput through sudden spikes.

A **partial batch response** tells the mapping which records failed instead of failing the whole batch. It takes the `ReportBatchItemFailures` setting on the mapping plus a handler that returns the failed IDs. For SQS:

```csharp
using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;

// Tells Lambda how to convert the JSON event to SQSEvent and the response back.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

public class Function
{
    public async Task<SQSBatchResponse> FunctionHandler(SQSEvent sqsEvent, ILambdaContext context)
    {
        var failures = new List<SQSBatchResponse.BatchItemFailure>();

        foreach (var message in sqsEvent.Records)
        {
            try
            {
                await ProcessMessageAsync(message);
            }
            catch (Exception ex)
            {
                context.Logger.LogError($"Message {message.MessageId} failed: {ex.Message}");
                failures.Add(new SQSBatchResponse.BatchItemFailure { ItemIdentifier = message.MessageId });
            }
        }

        // Only the listed messages return to the queue; the rest are deleted.
        return new SQSBatchResponse(failures);
    }

    private Task ProcessMessageAsync(SQSEvent.SQSMessage message) => Task.CompletedTask;
}
```

Because the asynchronous model and event source mappings both deliver at least once, make handlers **idempotent**, so that processing the same event twice leaves the same result as processing it once. A common approach records each event ID in a DynamoDB table with a conditional write, and skips events whose ID is already there. Powertools for AWS Lambda ships an idempotency utility that does this.

---

## Versions and Aliases

The function you edit is the unpublished version, `$LATEST`, whose code and configuration change with every update. **Publishing** a version freezes a numbered, immutable copy of both. An **alias** is a named pointer to a version, such as `prod` pointing to version 7, and callers that invoke the alias follow it when you repoint it. An alias can also split traffic between two versions by weight, which is how a canary release sends 10% of requests to a new version before moving the rest.

Several features covered below work only on published versions or aliases, including provisioned concurrency and SnapStart, so production callers should invoke an alias rather than `$LATEST`. Asynchronous invocation settings and destinations can be set per version or alias too.

---

## Concurrency and Scaling

**Concurrency** is the number of invocations running at the same instant, which for standard functions equals the number of busy execution environments. Estimate it as the request rate times the average duration. A function that takes 200 ms at 500 requests per second needs about 100 concurrent environments. The same traffic at 2 seconds per request needs 1,000.

Concurrency is limited at three levels:

- **The account quota.** Each account gets 1,000 concurrent executions per Region by default, shared by every function in that Region and raisable to tens of thousands. New accounts start with a lower quota that AWS raises automatically as usage grows.
- **The scaling rate.** Each function can add 1,000 execution environments every 10 seconds, independently of other functions in the account.
- **Requests per second.** Lambda also caps requests per second at 10 times the concurrency quota, so the default 1,000 allows 10,000 per second across the account. Very short functions hit this cap first. A 20 ms function at 30,000 requests per second needs a concurrency of only 600, but it needs a quota of 3,000 to be allowed the request rate.
- **Per-function settings,** described below.

When a request needs an environment and none can be created, the invocation is **throttled**. Synchronous callers get a `429`. Asynchronous events go back to Lambda's queue and are retried for up to the maximum event age. Event source mappings slow their polling and retry.

**Reserved concurrency** sets aside part of the account quota for one function, across all its versions, and also caps that function at the reserved amount. Use it for two opposite reasons: to guarantee that a critical function can always scale to a level, or to stop a function from overwhelming something downstream, such as a database that accepts only 100 connections. Reserving concurrency removes it from the pool every other function shares, so reserving it for every function mostly starves the rest. Lambda always keeps 100 units unreserved for functions without a reservation. Setting it to 0 stops the function from running at all, which is the quickest way to halt a runaway function.

**Provisioned concurrency** keeps a number of environments initialized ahead of time, so requests up to that number never see a cold start and start in double-digit milliseconds. It's configured on a published version or alias, charged for as long as it's configured whether or not requests arrive, and can follow a schedule or a utilization target through Application Auto Scaling. Requests beyond the provisioned number spill over to normal on-demand environments.

---

## Reducing Cold Start Latency

### Keep Initialization Lean

Most of a cold start is your own initialization code, so the first fix is in the function. Load only the libraries the function uses, keep the deployment package small, and do expensive setup once in static initialization rather than on every invocation. In .NET, Lambda creates one instance of the handler class per execution environment, so the constructor runs once per environment and its fields are reused by every invocation on it:

```csharp
using Amazon.DynamoDBv2;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

public class Function
{
    // Created once per execution environment and reused by every warm invocation.
    private readonly IAmazonDynamoDB _dynamo;
    private readonly OrderService _orders;

    public Function()
    {
        _dynamo = new AmazonDynamoDBClient();
        _orders = new OrderService(_dynamo);
    }

    public async Task<APIGatewayProxyResponse> FunctionHandler(
        APIGatewayProxyRequest request, ILambdaContext context)
    {
        // Request-specific values stay local to the handler.
        var order = await _orders.GetOrderAsync(request.PathParameters["id"]);
        return new APIGatewayProxyResponse { StatusCode = 200, Body = order.ToJson() };
    }
}
```

The handler stays thin and delegates to `OrderService`, which holds the business logic and can be unit-tested without Lambda. Request data, user data, and anything that must not leak between invocations belong in handler-local variables, never in fields.

Memory also affects cold starts, because Lambda allocates CPU in proportion to memory, and initialization is often CPU-bound.

### SnapStart

**SnapStart** runs Init once, when you publish a function version, and saves a snapshot of the initialized environment's memory and disk. New environments then resume from the snapshot instead of initializing from scratch, which can bring a multi-second startup to under a second.

- **Runtimes:** Java 11 and later, Python 3.12 and later, and .NET 8 and later. Node.js, Ruby, and OS-only runtimes aren't supported.
- **Versions only:** it applies to published versions and aliases that point to them, never to `$LATEST`.
- **Incompatible with** provisioned concurrency, Amazon EFS, and ephemeral storage above 512 MB.
- **Cost:** no extra charge for Java. For Python and .NET, each published version pays a snapshot caching charge (minimum 3 hours) and a charge each time an environment restores from it.

A snapshot is shared by every environment restored from it, so anything unique that the initialization code created is no longer unique. Random seeds, generated IDs, and secrets created during Init must be generated after restore instead, in an after-restore **runtime hook** (code Lambda runs right after resuming from the snapshot). Network connections opened during Init may also be dead after a restore. Connections made by AWS SDK clients usually resume on their own, while other connections should be checked and reopened.

### Choosing a Mitigation

| Situation | Use |
|---|---|
| Occasional cold starts are acceptable | Lean initialization and adequate memory, nothing else |
| Supported runtime, and cold starts must drop without paying for idle capacity | SnapStart |
| Strict latency target on every request, or a runtime SnapStart doesn't support | Provisioned concurrency, scheduled or scaled with traffic |

---

## Memory, CPU, and Cost

### Pricing

Lambda charges for requests and for **duration**, measured in GB-seconds. A GB-second is one GB of configured memory running for one second, and run time is billed per millisecond. In US East (N. Virginia):

| Charge | Price |
|---|---|
| Requests | $0.20 per million |
| Duration, x86 | $0.0000166667 per GB-second (first pricing tier) |
| Duration, arm64 | About 20% less than x86 |
| Provisioned concurrency | $0.0000041667 per GB-second while configured, plus $0.0000097222 per GB-second of duration when used |
| Ephemeral storage above 512 MB | $0.0000000309 per GB-second |
| Free tier | 1 million requests and 400,000 GB-seconds per month |

Duration prices fall in tiers as an account's monthly usage on one architecture in one Region grows. Compute Savings Plans cut duration and provisioned concurrency charges by up to 17%, but not request charges.

The **arm64** architecture runs on AWS Graviton2 processors. Code in interpreted languages usually runs unchanged, and so does portable .NET code, while native dependencies, layers, extensions, and container images all need arm64 builds. .NET code published as ReadyToRun or Native AOT is compiled for one architecture and has to be rebuilt for arm64. Lambda aliases can split traffic between an x86 and an arm64 version to compare them before switching.

### Tuning Memory

Memory is the only size setting, from 128 MB to 10,240 MB in 1 MB steps, and CPU comes with it in proportion. At 1,769 MB a function gets the equivalent of one full vCPU. Above that it gets more than one, which only helps code that runs work on several threads.

Because CPU scales with memory, the cheapest setting is often not the smallest one. A CPU-bound function that takes 2,000 ms at 512 MB and 800 ms at 1,024 MB uses 1.0 GB-seconds in the first case and 0.8 in the second, so the larger setting is 20% cheaper and faster. The only way to find the curve for a given function is to measure it. The `REPORT` line that Lambda logs after each invocation shows duration and maximum memory used, AWS Compute Optimizer, once opted in, recommends memory sizes for x86 functions configured at 1,792 MB or less, and the open-source [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning){:target="_blank" rel="noopener noreferrer"} tool runs a function at several memory sizes and charts cost against speed.

### Logging Costs

Every function writes its output to CloudWatch Logs by default, and for chatty, high-volume functions the log bill can rival the compute bill. Three settings control it. The **log format** can be plain text or JSON. The **log level** filter drops application and system log lines below a chosen level before they're stored, which works with JSON format. And the **destination** can be switched from CloudWatch Logs to Amazon S3 or Data Firehose. CloudWatch log groups keep data forever unless a retention period is set, so set one on every function's log group.

---

## Security

### Execution Roles and Resource Policies

Two policies govern every function, one in each direction:

- The **execution role** is what the function's code can do. Lambda assumes it for each invocation, and the code's AWS SDK calls use its credentials.
- The **resource-based policy** on the function is who can invoke it. When you add an S3 notification, an API Gateway route, or another account as a caller, a statement here grants that caller `lambda:InvokeFunction`.

Give each function its own execution role, scoped to the actions and resources that function uses. A role shared across functions accumulates the union of their permissions, and a compromised function inherits all of them. A minimal role for a function that reads and writes one table and writes to its own log group, which the deployment template creates in advance:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/Orders"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/order-api:*"
    }
  ]
}
```

### Secrets and Environment Variables

Environment variables (4 KB in total per function) suit configuration such as table names and feature flags. Lambda encrypts them at rest with a KMS key, an AWS managed one by default, but anyone allowed to read the function's configuration sees them in plain text. That makes them the wrong place for passwords and API keys.

Store secrets in Secrets Manager or Parameter Store, grant the execution role read access to the specific secret, and cache the value inside the environment instead of fetching it on every invocation. The **AWS Parameters and Secrets Lambda Extension**, added as an AWS-provided layer, runs a local HTTP endpoint on port 2773 that caches values for 300 seconds by default. Powertools for AWS Lambda offers the same caching as a library in .NET, Java, Python, and TypeScript. With either one, a rotated secret reaches the function within one cache lifetime, so shorten the cache time if rotation needs to take effect faster.

### VPC Access

A function that isn't attached to a VPC can reach the internet and public AWS endpoints, but not private resources such as an RDS database in a private subnet. Attaching the function to a VPC gives it that private access and takes the internet away.

{% include figure.html id="aws-lambda-vpc-access" %}

Four details shape how that works in practice:

- Lambda connects the function through a **Hyperplane ENI** (a Lambda-managed network interface) for each combination of subnet and security group. Functions that use the same combination share one. A new function stays in the `Pending` state, uninvocable, while its ENI is created, which can take several minutes, and it happens when the function is configured, not on each invocation.
- A function idle for 14 days loses its ENI and becomes `Inactive`. The next invocation fails while the ENI is recreated.
- A VPC-attached function has no internet access even in a public subnet. It needs a route through a NAT gateway for internet calls, and VPC endpoints to reach AWS services such as S3, DynamoDB, or Secrets Manager without NAT processing charges.
- The EC2 network permissions the execution role needs for the ENI are also available to the function's code. AWS recommends adding a deny statement keyed on `lambda:SourceFunctionArn` so the code can't use them.

Attach a function to a VPC only when it needs something that lives there. A function that uses only DynamoDB, S3, SQS, and public APIs gains nothing from it, and pays in NAT charges and one more thing to configure.

---

## Designing Functions

### Packaging and Layers

A function ships as a ZIP archive or a container image:

| | ZIP archive | Container image |
|---|---|---|
| **Size** | 50 MB zipped for a direct upload (larger through S3), 250 MB unzipped including layers | 10 GB uncompressed |
| **Shared dependencies** | Up to 5 layers | Built into the image; layers aren't supported |
| **Fits** | Most functions | Large dependencies such as ML models, or teams already building container images |

A **layer** is a versioned ZIP of libraries or tools that several functions attach. Layer versions are immutable, published per Region, and built for the architectures they declare, and they count toward the function's 250 MB unzipped limit. Layers suit shared runtime tools like the secrets extension. For your own shared code, a package from your normal build (a NuGet package, for example) is easier to version and test than a layer.

### Stateless, Idempotent Handlers

A handler should assume it has never run before and may run again on the same event. Session state, uploaded files, and work in progress belong in DynamoDB, S3, or ElastiCache, never in `/tmp` or in memory, because the next request may land on a different environment. `/tmp` (512 MB by default, configurable up to 10,240 MB) is for scratch space and caches that are safe to lose.

### How Many Functions

Splitting an application into one function per operation gives each function a small package, its own least-privilege role, and its own concurrency and timeout settings. It also multiplies the number of things to deploy and monitor, and each function has its own cold starts. A single function that routes many operations, such as an ASP.NET Core API hosted in Lambda, keeps environments warm across all routes and deploys as one unit, at the cost of a broad role and one shared set of limits. Split along the lines where permissions, scaling, or timeouts differ, and keep closely related operations together.

### Work That Takes Longer Than 15 Minutes

A standard function can't outlast its 15-minute timeout, so long work has to be broken up or moved:

- **Split it into independent pieces.** A job that processes 10,000 images can put one message per image on an SQS queue and let an event source mapping process them in parallel, with retries and a dead-letter queue already in place. That's safer than a function looping over `Invoke` calls, which has no backpressure and loses events if it fails partway.
- **Orchestrate the steps.** Step Functions runs multi-step workflows outside Lambda, and Lambda durable functions (below) do it inside the function's own code.
- **Move it.** Work that genuinely runs for hours in one piece belongs on containers or EC2.

### Functions Calling Functions

A function that synchronously invokes another function and waits for its answer pays for both while they run, fails whenever the second fails or times out, and competes with it for the same concurrency. Invoke the second one asynchronously, put a queue between them, or orchestrate both with Step Functions or durable functions. Often the better question is whether the second function needs to exist at all, or whether the first can call the downstream service directly.

---

## Beyond Standard Functions

Lambda now has options that relax parts of the standard model. Each fits a narrower job:

| Option | What changes | Fits |
|---|---|---|
| **Lambda Managed Instances** | Functions run on EC2 instances in your account that Lambda provisions, patches, and scales through a **capacity provider**. One environment serves many invocations at once, scaling follows CPU utilization without cold starts, and capacity doesn't scale to zero. Priced as the EC2 instances plus a 15% management fee, with Savings Plans and Reserved Instances applying to the EC2 part. Asynchronous invocations and most event source mappings allow up to 90 minutes per invocation | High-volume, predictable traffic, or a need for particular instance types, where EC2 pricing beats per-request pricing |
| **Durable functions** | A function checkpoints each step through the durable execution SDK, available for .NET, Java, JavaScript, TypeScript, and Python. After a pause or failure it replays from the start, skipping completed steps, and a single execution can span up to a year. Waits suspend the function without compute charges. Operations and stored state are billed on top of normal duration | Multi-step workflows, human approvals, and long waits written as ordinary code rather than a state machine |
| **Lambda MicroVMs** | Separate stateful Firecracker VMs launched from a snapshot image and kept for up to 8 hours, under your control through start, suspend, and resume calls. Available in a subset of Regions | Running user-supplied or AI-generated code in isolation, such as agent sandboxes |

Managed Instances also change what the handler can assume. Several invocations share one environment at the same time, so fields and static state must be thread-safe, which a standard function never has to consider.

---

## What to Watch

The metrics that describe a function's health come from CloudWatch at no extra cost:

| Metric | Watch it for |
|---|---|
| `Errors` and `Throttles` | Failed invocations, and invocations refused for lack of concurrency |
| `Duration` | Latency, and how close invocations run to the timeout |
| `ConcurrentExecutions` | Headroom against reserved concurrency and the account quota |
| `IteratorAge` | How far a stream mapping has fallen behind the newest record |
| `AsyncEventAge` and `AsyncEventsDropped` | Asynchronous events waiting too long, or discarded |
| `DeadLetterErrors` and `DestinationDeliveryFailures` | Failed events that couldn't be captured, which means they're lost |

For latency across services, turn on active tracing with AWS X-Ray or instrument the function with OpenTelemetry. CloudWatch Lambda Insights adds per-environment CPU, memory, and network metrics for a charge.

---

## Common Pitfalls

### Recursive Loops

A function that writes back to the resource that triggers it invokes itself indefinitely. The classic case is a function triggered by uploads to an S3 bucket that writes its output to the same bucket. Lambda detects loops that pass through SQS, SNS, S3, and other Lambda functions, and stops the chain after about 16 invocations, sending the event to the function's on-failure destination or dead-letter queue if one is set. It can't see loops through other services such as DynamoDB. Write output to a different bucket or prefix than the trigger watches, and set a CloudWatch alarm on invocation spikes as a backstop.

### Guessing at Memory

Setting every function to a large memory size "to be safe" pays for capacity that isn't used, and leaving every function at the 128 MB default starves CPU-bound code and can cost more because it runs longer. Measure each function and set memory from the results.

---

## Key Takeaways

1. **Everything follows from the execution environment.** One environment serves one request at a time, starts cold, stays warm for a while, and may disappear at any moment. Cold starts, concurrency, and statelessness are all consequences of that.
2. **The invocation model decides failure handling.** Synchronous callers handle their own retries. Asynchronous events retry inside Lambda and need an on-failure destination to survive. Event source mappings retry batches, where partial batch responses and the source's own settings keep one bad record from stalling the rest.
3. **Delivery is at least once, so handlers must be idempotent.**
4. **Concurrency is request rate times duration.** It's limited by the Region's account quota and each function's scaling rate. Reserved concurrency both guarantees and caps a function, and provisioned concurrency buys pre-initialized environments.
5. **Fix cold starts in order.** Lean initialization first, SnapStart where the runtime supports it, provisioned concurrency where latency must be predictable.
6. **Memory buys CPU.** Measure duration across memory sizes, since the cheapest setting is often not the smallest, and remember that Init time is billed.
7. **Attach to a VPC only when the function needs private resources**, and give it endpoints or NAT for everything else it calls.
8. **The 15-minute limit applies to standard functions.** Split long work into queued pieces, orchestrate it with Step Functions or durable functions, or run it on Managed Instances or containers.
