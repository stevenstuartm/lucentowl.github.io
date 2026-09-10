---
title: "Azure Functions: Advanced Patterns"
layout: guide
category: Azure
subcategory: Serverless Architecture
description: "Durable Functions orchestration patterns on the isolated worker model, the five hosting options and how to choose between them, custom handlers, retry and concurrency behavior, and the design constraints that come with stateful serverless"
tags: [durable-functions, serverless, orchestration, flex-consumption, event-driven, advanced]
---

## What Are Azure Functions

[Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/){:target="_blank" rel="noopener noreferrer"} is Azure's event-driven serverless compute service. You write functions in C#, JavaScript, TypeScript, Python, Java, PowerShell, Go, or a custom handler in any language, and they respond to events such as HTTP requests, timers, queue messages, or Service Bus messages. Azure manages the servers, scaling, and operational infrastructure while you focus on business logic.

This guide covers advanced patterns and hosting decisions for production workloads.

**All C# examples use the isolated worker model.** [Support for the in-process model ends 10 November 2026](https://learn.microsoft.com/en-us/azure/azure-functions/migrate-dotnet-to-isolated-model){:target="_blank" rel="noopener noreferrer"}. The two models have different type names, and mixing them is the most common source of code that reads correctly and doesn't compile: isolated worker uses `[Function]` with `Microsoft.Azure.Functions.Worker.Extensions.*` packages, in-process uses `[FunctionName]` with `Microsoft.Azure.WebJobs.Extensions.*`. Durable orchestrators take `TaskOrchestrationContext` in the isolated model and `IDurableOrchestrationContext` in-process.

### What Problems Azure Functions Solves

**Without Azure Functions:**
- Event-driven workloads require infrastructure sized for peak demand
- Small, isolated units of work carry container or VM overhead
- Scaling up and down is manual or requires autoscale rules you write and tune
- Teams manage infrastructure alongside code

**With Azure Functions:**
- Event-driven scaling, including scale to zero on the serverless plans
- Pay for execution rather than idle infrastructure
- Built-in bindings for common Azure services replace connection and serialization boilerplate
- A stateless execution model that scales horizontally without coordination
- Durable Functions add state management and orchestration when you need them

### How Azure Functions Differs from AWS Lambda

Architects familiar with AWS Lambda should understand these structural differences:

| Concept | AWS Lambda | Azure Functions |
|---------|-----------|-----------------|
| **Stateful orchestration** | Step Functions, a separate service with its own state machine language | Durable Functions, an extension of Functions where the workflow is ordinary code |
| **Hosting** | One managed runtime; you tune memory and concurrency | Five hosting options with different scaling, networking, and billing models |
| **Service integration** | Event source mappings and the SDK | Declarative triggers and bindings, including output bindings |
| **Custom runtimes** | Layers and custom runtimes | Custom handlers: any language that can serve HTTP |
| **Monitoring** | CloudWatch | Application Insights, instrumented through OpenTelemetry |

---

## Durable Functions

### What Durable Functions Provide

[Durable Functions](https://learn.microsoft.com/en-us/azure/durable-task/durable-functions/durable-functions-overview){:target="_blank" rel="noopener noreferrer"} is an extension to Azure Functions that adds stateful orchestration, checkpointing, and long-running coordination. Plain functions are stateless and short-lived; Durable Functions maintain state across many invocations and give guarantees about execution order and failure handling. The workflow is written as ordinary control flow (loops, conditionals, `await`), and the runtime persists its progress.

### Core Concepts

**Orchestrator functions** coordinate the workflow. An orchestrator defines the sequence of activities, handles branching, and holds workflow state. Orchestrators must be deterministic, because the runtime re-executes them from the beginning every time the workflow advances.

**Activity functions** do the actual work: call an API, write to a database, send an email. They can be non-deterministic because they run once and their output is recorded.

**Entity functions** hold durable state addressed by a unique identifier, similar to a virtual actor. You signal them with one-way messages or call them and await a result.

**Client functions** start and manage orchestrations. A client function, usually HTTP-triggered, schedules an instance and gets back an instance ID.

**Task hub** is the container for all of this: the history, the queues, and the entity state for one app. Every function app configured against the same task hub shares that state, so a staging app and a production app must use different task hubs or they will consume each other's work items.

### How Replay Works

Every action an orchestrator takes, whether scheduling an activity, creating a timer, or receiving an external event, is appended to the orchestration history. When the workflow needs to advance, the runtime runs the orchestrator function *from the top*, replaying the recorded history to rebuild local state, and only then executes the next new action.

```
  ┌───────────────────┐   schedule instance   ┌───────────────────────────┐
  │  Client function  │──────────────────────▶│         Task hub          │
  │  (HTTP, queue, …) │                       │  history + work queues    │
  └───────────────────┘                       └──┬─────────────────▲──────┘
                                                 │                 │
                           dispatch work item    │                 │  append
                                                 ▼                 │  event
                                  ┌──────────────────────────┐     │
                                  │  Orchestrator function   │─────┘
                                  │  replays the full history│
                                  │  on every dispatch       │
                                  └────────────┬─────────────┘
                                               │ schedule activity
                                               ▼
                                  ┌──────────────────────────┐
                                  │    Activity function     │
                                  │  runs once, result is    │
                                  │  written to the history  │
                                  └──────────────────────────┘
```

Two consequences follow directly from this loop, and they explain most of the rules below. First, the orchestrator must be deterministic: if `DateTime.UtcNow` or `Guid.NewGuid()` returns something different on replay, the runtime's view of what already happened diverges from the code's. Use `context.CurrentUtcDateTime` and `context.NewGuid()` instead, and push anything genuinely non-deterministic into an activity. Second, everything passed into and out of activities is serialized into the history, so large payloads make every subsequent replay more expensive.

### Orchestration Patterns

**Function chaining** runs activities in sequence, with each result feeding the next. The orchestrator reads like ordinary imperative code.

```csharp
[Function(nameof(ProcessOrder))]
public static async Task<int> ProcessOrder(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    int validated = await context.CallActivityAsync<int>("ValidateOrder");
    int charged = await context.CallActivityAsync<int>("ChargeCard", validated);
    return await context.CallActivityAsync<int>("ShipOrder", charged);
}
```

**Fan-out/fan-in** runs activities in parallel and waits for all of them. The orchestrator's input comes from `context.GetInput<T>()`, not from a method parameter. The only parameters an orchestrator takes are its trigger binding and, optionally, `FunctionContext`.

```csharp
[Function(nameof(ProcessBatch))]
public static async Task ProcessBatch(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    string[] items = context.GetInput<string[]>() ?? Array.Empty<string>();

    Task<long>[] tasks = items
        .Select(item => context.CallActivityAsync<long>("ProcessItem", item))
        .ToArray();

    long[] results = await Task.WhenAll(tasks);
    await context.CallActivityAsync("Consolidate", results.Sum());
}
```

**Async HTTP API** handles long-running work that a client wants to monitor. The starter returns immediately with a status URL and the client polls it, which is the standard 202-plus-`Location` polling consumer pattern. This is also the answer to the 230-second HTTP response ceiling described under Hosting Models.

```csharp
[Function(nameof(StartLongRunningWork))]
public static async Task<HttpResponseData> StartLongRunningWork(
    [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req,
    [DurableClient] DurableTaskClient client)
{
    string instanceId = await client.ScheduleNewOrchestrationInstanceAsync(
        "LongRunningOrchestrator");

    return client.CreateCheckStatusResponse(req, instanceId);
}
```

`CreateCheckStatusResponse` supports only `HttpRequestData` and `HttpResponseData`. If your app uses ASP.NET Core integration with `HttpRequest` and `IActionResult`, this API is not available to that function.

**Monitoring** polls a condition on a durable timer until it becomes true. Give the loop a deadline: an unbounded monitor is an orchestration that never completes and whose history never stops growing.

```csharp
[Function(nameof(MonitorJob))]
public static async Task MonitorJob(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    string jobId = context.GetInput<string>()!;
    DateTime expiry = context.CurrentUtcDateTime.AddHours(2);

    while (context.CurrentUtcDateTime < expiry)
    {
        JobStatus status = await context.CallActivityAsync<JobStatus>(
            "CheckJobStatus", jobId);

        if (status.IsComplete)
        {
            await context.CallActivityAsync("OnJobComplete", jobId);
            return;
        }

        await context.CreateTimer(
            context.CurrentUtcDateTime.AddSeconds(30), CancellationToken.None);
    }

    await context.CallActivityAsync("OnJobTimedOut", jobId);
}
```

**Human interaction** pauses the orchestration until an external event arrives. `WaitForExternalEventAsync` waits indefinitely by default, so race it against a durable timer and cancel the timer when the event wins. Otherwise the pending timer keeps the instance alive after the work is done.

```csharp
[Function(nameof(ApprovalWorkflow))]
public static async Task ApprovalWorkflow(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    string approvalId = context.GetInput<string>()!;
    await context.CallActivityAsync("NotifyApprover", approvalId);

    using var cts = new CancellationTokenSource();
    Task<bool> approvalTask = context.WaitForExternalEventAsync<bool>("ApprovalReceived");
    Task timeoutTask = context.CreateTimer(
        context.CurrentUtcDateTime.AddDays(1), cts.Token);

    Task winner = await Task.WhenAny(approvalTask, timeoutTask);

    if (winner == approvalTask)
    {
        cts.Cancel();
        bool approved = await approvalTask;
        await context.CallActivityAsync(
            approved ? "ProcessApproved" : "ProcessRejected", approvalId);
    }
    else
    {
        await context.CallActivityAsync("ProcessExpired", approvalId);
    }
}
```

External events are delivered at least once, so include an ID in the payload that lets the orchestrator deduplicate. An event raised against an instance ID that doesn't exist is silently discarded.

**Sub-orchestrations** let one orchestrator call another, which is how you decompose a workflow that has grown too large to reason about, and how you keep any single history bounded.

```csharp
[Function(nameof(ParentOrchestrator))]
public static async Task<string> ParentOrchestrator(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    string staged = await context.CallSubOrchestratorAsync<string>("StageOne");
    return await context.CallSubOrchestratorAsync<string>("StageTwo", staged);
}
```

### When Durable Functions Are Worth It, and When They Aren't

Durable Functions earn their complexity when you need to coordinate multiple services over minutes to days, retry individual steps with independent policies, or keep workflow state without standing up a database and a scheduler to hold it.

They are the wrong tool in three situations. If the work is a single step with a retry, the trigger's own retry behavior is simpler. If the workflow is mostly connector calls to SaaS systems rather than your own code, Logic Apps gives you the same durability without the replay constraints. And if the workflow must be edited while instances are in flight, note that changing an orchestrator's code changes what its history replays into, so in-flight instances written against the old shape can fail. The usual mitigations are versioning the orchestrator name and letting old instances drain, or deploying to a new task hub.

### Storage Backends

Durable Functions persist history, entity state, and internal messages to a [storage provider](https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-storage-providers){:target="_blank" rel="noopener noreferrer"} you choose. The choice is not reversible: there is no supported migration between backends, so switching means standing up a new app.

| Backend | Position | Notes |
|---|---|---|
| **Durable Task Scheduler** | Recommended, fully managed | Highest throughput, managed identity support, includes a monitoring dashboard |
| **Azure Storage** | Default, no setup | Uses queues, tables, and blobs in the app's storage account; consumption-priced; most mature |
| **MSSQL** | Bring your own SQL Server | The only option for disconnected environments; **entities are not supported on .NET isolated** |
| **Netherite** | Being retired | [Support ends 31 March 2028](https://azure.microsoft.com/updates/?id=489009){:target="_blank" rel="noopener noreferrer"}; not supported on Flex Consumption |

New apps should default to the Durable Task Scheduler. Azure Storage remains a reasonable choice when you want the app's own storage account to be the only dependency.

---

## Hosting Models

Azure Functions has five hosting options. They differ in how they scale, what networking they support, how they bill, and how long a function may run.

**Flex Consumption** is the plan Microsoft directs new serverless apps to. It scales from zero to 1,000 instances, makes per-function scaling decisions rather than app-wide ones, supports virtual network integration, and lets you reduce cold starts with always-ready instances. Instance memory is fixed at 512 MB, 2,048 MB, or 4,096 MB.

**Premium** keeps at least one instance warm at all times, runs on larger workers (EP1, EP2, and EP3 give 1, 2, and 4 vCPU with 3.5, 7, and 14 GB), and supports deployment slots and Hybrid Connections. It bills on core-seconds and memory across both active and prewarmed instances, so the floor is never zero.

**Dedicated (App Service plan)** runs functions on an App Service plan you size and scale yourself, at App Service rates regardless of whether functions execute. It is the plan for continuous load, for reusing an existing plan, and for App Service Environment isolation.

**Container Apps** runs a containerized function app in a managed environment, including on GPU compute. Scaling is event-driven, and scale to zero depends on the minimum replica count you set. Container Apps uses revisions rather than deployment slots.

**Consumption** is the legacy plan. Windows Consumption is still generally available; Linux Consumption is closed to new apps, and the option retires **30 September 2028**. Apps still on the end-of-life v3 runtime on Linux Consumption stop running **30 September 2026**.

### Hosting Plan Comparison

| Aspect | Flex Consumption | Premium | Dedicated | Container Apps | Consumption (legacy) |
|--------|-----------------|---------|-----------|----------------|----------------------|
| **Scale to zero** | Yes | No | No | Yes, with min replicas 0 | Yes |
| **Max instances** | 1,000 | 100 Windows, 20-100 Linux | 10-30, 100 on ASE | 300-1,000 | 200 Windows, 100 Linux |
| **Timeout, default / max** | 30 min / unbounded | 30 min / unbounded | 30 min / unbounded | 30 min / unbounded | 5 min / 10 min |
| **Memory per instance** | 512 MB, 2 GB, or 4 GB | 3.5-14 GB | 1.75-256 GB | Varies | 1.5 GB |
| **VNet integration (outbound)** | Yes | Yes | Yes | Yes | No |
| **Private endpoints (inbound)** | Yes | Yes | Yes | No | No |
| **Deployment slots** | Not supported | 3 | 1-20 | Revisions instead | 2 |
| **Container support** | No | Linux | Linux | Container-only | No |
| **Billing** | Executions, active memory, always-ready instances | Core-seconds and memory, active and prewarmed | App Service plan rate | Container Apps plan | Executions, time, memory |

Two limits apply on every plan regardless of the timeout above. An HTTP-triggered function has **230 seconds** to respond, because of the Azure Load Balancer idle timeout, so longer work needs the async HTTP pattern. And the language worker process has a non-configurable **60-second** startup timeout.

The "unbounded" maximums are not a promise that an execution runs forever. Flex Consumption and Premium give a running execution a 60-minute grace period during scale-in, and every plan gives 10 minutes during platform updates. Dedicated requires **Always On** for an unbounded timeout to mean anything.

### Choosing a Plan

```
Do you need a custom container image or GPU compute?
├── yes ──▶ Container Apps
└── no
    │
    Do you have a Windows-only dependency?
    (v1 runtime, full .NET Framework, Windows-only PowerShell modules)
    ├── yes ──▶ Dedicated on Windows, or Consumption on Windows (legacy)
    └── no
        │
        Is load continuous, or do you need fixed billing,
        or an App Service Environment?
        ├── yes ──▶ Dedicated
        └── no
            │
            Do you need deployment slots, Hybrid Connections,
            or more than 4 GB per instance?
            ├── yes ──▶ Premium
            └── no  ──▶ Flex Consumption      (default for new apps)
```

### What Is Scoped to What

Several settings behave in ways that only make sense once you know where they sit in the hierarchy: **subscription → hosting plan → function app → function**.

A **hosting plan** holds one function app on Flex Consumption, up to 100 on Premium, and an unbounded number on Dedicated, so on Premium and Dedicated, one app's traffic spike scales the plan its neighbors are also running on.

**`host.json` is scoped to the function app, not the function.** Concurrency settings such as `maxConcurrentCalls`, retry defaults, and everything under `extensions` apply to every function in the app. A throughput-hungry function and a fragile one cannot be tuned separately in the same app; splitting them into separate apps is the mechanism for that.

Concurrency limits are **per instance**, not per app. A `maxConcurrentCalls` of 16 across 50 instances is 800 concurrent messages arriving at your downstream service.

A **task hub** is scoped to whichever apps point at it, which is why staging and production must not share one.

---

## Custom Handlers and Polyglot Runtimes

### What Custom Handlers Enable

[Custom handlers](https://learn.microsoft.com/en-us/azure/azure-functions/functions-custom-handlers){:target="_blank" rel="noopener noreferrer"} let you write functions in any language that can serve HTTP. The Functions host stays in charge of triggers and bindings; your process only has to answer HTTP requests. This is how Rust, Go, C++, or anything else runs as a function without waiting for a native runtime.

### How Custom Handlers Work

```
  trigger event                                            output bindings
  (queue message, timer, HTTP request)                     (blob, queue, …)
        │                                                        ▲
        ▼                                                        │
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Functions host process                                              │
  │   1. receives the trigger and binds its input data                  │
  │   2. POSTs a JSON payload to your handler                           │
  │   4. reads Outputs and ReturnValue from the reply and writes them   │
  └──────────────┬───────────────────────────────────▲──────────────────┘
                 │ POST /<FunctionName>              │ 200 + JSON
                 │ localhost:%FUNCTIONS_CUSTOMHANDLER_PORT%
                 ▼                                   │
  ┌──────────────────────────────────────────────────┴──────────────────┐
  │ Your HTTP server, any language                                      │
  │   3. does the work                                                  │
  └─────────────────────────────────────────────────────────────────────┘
```

You point the host at your executable in `host.json`:

```json
{
  "version": "2.0",
  "customHandler": {
    "description": {
      "defaultExecutablePath": "server",
      "arguments": [ "--port", "%FUNCTIONS_CUSTOMHANDLER_PORT%" ]
    },
    "enableForwardingHttpRequest": false
  }
}
```

Setting `enableForwardingHttpRequest` to `true` forwards the original HTTP request to your handler rather than the wrapped payload, which is what you want when the function is only an HTTP trigger with an HTTP output and your server already speaks HTTP the way you need.

### When to Use Custom Handlers

**Use them when** you need a language the runtime doesn't support natively, you have an existing HTTP service to expose through Functions triggers and bindings, or you need a library that exists only in one ecosystem.

**Avoid them when** a supported runtime already does the job. You take on the process lifecycle, the startup cost of your own binary, an extra local HTTP hop per invocation, and manual payload handling that the language workers do for you.

---

## Deployment Strategies

### Slots and the Zero-Downtime Question

[Deployment slots](https://learn.microsoft.com/en-us/azure/azure-functions/functions-deployment-slots){:target="_blank" rel="noopener noreferrer"} are separate live instances of your app that you swap into production. Consumption gets 2 slots including production, Premium 3, and Dedicated 1-20. **Flex Consumption does not support slots**, and Container Apps uses revisions instead.

Note what that means in practice: the plan Microsoft recommends for new serverless apps is the one without slots. On Flex Consumption you get zero-downtime deployment through [site update strategies](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-site-updates){:target="_blank" rel="noopener noreferrer"}, which roll new instances in gradually rather than swapping a warmed slot into place.

Use slots where the plan offers them, but be precise about what they buy:

- Instances are warmed before the swap, so a swapped-in app doesn't cold-start on its first request
- The swap is a routing change, so no incoming trigger is dropped
- Rolling back is another swap
- **A swap does not guarantee zero downtime.** Executions in flight can be terminated, and scaled-out apps can see degraded availability during the swap

Settings related to triggers and bindings must be marked as **deployment slot settings**, meaning sticky, *before* the first swap, or events will be routed to the wrong instance after it. Virtual network integration, hybrid connections, service endpoints, and private endpoints never swap by design.

### Zip Deploy and Containers

[Zip deployment](https://learn.microsoft.com/en-us/azure/azure-functions/deployment-zip-push){:target="_blank" rel="noopener noreferrer"} pushes a packaged build directly to the app and is the normal path from a CI/CD pipeline. For container-hosted functions, deployment follows the ordinary image workflow: build, push to a registry, point the app at the new tag, and let the platform pull and restart.

---

## Concurrency, Throttling, and Performance

### Per-Instance Concurrency

Each instance runs many invocations at once, and the limits are set per trigger type rather than globally. This is [fixed per-instance concurrency](https://learn.microsoft.com/en-us/azure/azure-functions/functions-concurrency){:target="_blank" rel="noopener noreferrer"}, the default model. Most triggers configure it in `host.json`; Kafka and Cosmos DB configure it in the function declaration.

The defaults that most often need changing:

| Trigger | Setting | Default |
|---|---|---|
| Service Bus, single message | `maxConcurrentCalls` | 16, **multiplied by the instance's core count** |
| Service Bus, sessions | `maxConcurrentSessions` | 8 |
| Service Bus, batch | `maxMessageBatchSize` | 1,000 |
| Queue Storage | `batchSize` | 16, maximum 32 |
| HTTP on Flex Consumption | per-instance concurrency | 4 at 512 MB, 16 at 2 GB, 32 at 4 GB; 1 for Python |

The core multiplier on `maxConcurrentCalls` catches people out. On a two-core worker, the default 16 is 32 concurrent messages per instance.

**Dynamic concurrency** is the alternative. Turn it on in `host.json` and the host learns the right level per function by watching CPU and thread pressure, overriding your configured values:

```json
{
  "version": "2.0",
  "concurrency": {
    "dynamicConcurrencyEnabled": true,
    "snapshotPersistenceEnabled": true
  }
}
```

It is off by default, supported only for the Blob Storage, Queue Storage, and Service Bus triggers on version 5.x extensions, and it starts each function at a concurrency of one and climbs. That learning period is the cost. `snapshotPersistenceEnabled`, on by default, persists what it learned so new instances don't start from one again.

### Throttling Downstream

Functions scale on the depth of *your* trigger source, which has nothing to do with what your database or downstream API can absorb. A queue backlog will happily scale you to 200 instances pointed at a SQL database sized for ten connections.

**How to handle it:**
- Cap per-instance concurrency deliberately rather than accepting defaults, remembering that the effective total is the per-instance value times the instance count
- Cap the instance count itself on plans that allow it, such as Flex Consumption, Premium, and Container Apps
- Retry with backoff, and let Durable Functions own the retry policy for multi-step work
- Partition across multiple namespaces or storage accounts when a single entity's own limits are the ceiling
- Alert on downstream throttling metrics, not only on function failures

### Cold Starts

A cold start happens when an instance has to start the runtime and load your code, which happens on scale from zero and on each newly added instance. **Microsoft publishes no cold start duration figures**, and every number in circulation comes from a third-party benchmark against a particular app. Measure your own.

What the platform documents is which plans expose cold starts and what reduces them: always-ready instances on Flex Consumption and Premium, Always On for Dedicated, and a minimum replica count of one or more on Container Apps. On your side, the levers are keeping the deployment package small, deferring expensive initialization until it is needed, and avoiding work in the constructor path that every instance pays for.

---

## Error Handling and Retry Policies

### Retry Is Not Uniform Across Triggers

This is the part of Functions most often described wrong. Only four trigger types support [Functions retry policies](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-error-pages){:target="_blank" rel="noopener noreferrer"}, the runtime-enforced kind you declare with an attribute. Everything else relies on the binding extension or the source service.

| Trigger | Where retry comes from | Behavior |
|---|---|---|
| **Cosmos DB, Event Hubs, Kafka, Timer** | Functions retry policies | The runtime reruns the execution; configured per function |
| **Service Bus** | Binding extension | `host.json` settings on extension 5.x; older versions rely on the queue's max delivery count and the dead-letter queue |
| **Queue Storage** | Binding extension | `maxDequeueCount`, default 5, then the message moves to the poison queue |
| **Blob Storage** | Binding extension | Poison blobs, configured through the queues section of `host.json` |
| **Event Grid** | The event subscription | Event Grid retries with backoff and dead-letters to a **blob container** |

Two things follow. First, a retry policy attribute on a Service Bus or Queue trigger does nothing, because those triggers are not in the supported list. Second, the retry count for the policy-based triggers is held in instance memory, so an instance failure loses it: treat the maximum as best effort and design for idempotency regardless.

Event Hubs deserves a specific warning. Checkpoints are not written until the retry policy for an execution finishes, so a retrying batch pauses progress on its entire partition.

### Durable Functions Retry

Durable Functions apply retry policies to individual activities and sub-orchestrations, which is the finest-grained retry available anywhere in Functions.

```csharp
TaskOptions options = TaskOptions.FromRetryPolicy(new RetryPolicy(
    maxNumberOfAttempts: 5,
    firstRetryInterval: TimeSpan.FromSeconds(1),
    backoffCoefficient: 2.0,
    maxRetryInterval: TimeSpan.FromMinutes(1),
    retryTimeout: TimeSpan.FromMinutes(10)));

string result = await context.CallActivityAsync<string>("MyActivity", input, options);
```

`retryTimeout` is the one people miss: it bounds the total time spent retrying, which matters more than the attempt count once `backoffCoefficient` starts pushing the intervals out.

When you need to decide per exception rather than per count (retry a timeout, give up immediately on a validation error), use a retry handler instead of a policy:

```csharp
TaskOptions options = TaskOptions.FromRetryHandler(retryContext =>
{
    if (retryContext.LastFailure.IsCausedBy<ArgumentException>())
    {
        return false;
    }

    return retryContext.LastAttemptNumber < 5;
});

try
{
    await context.CallActivityAsync("FlakyActivity", options: options);
}
catch (TaskFailedException)
{
    // reached when the handler returns false
}
```

### Dead-Letter Patterns

When retries are exhausted, the message has to go somewhere you will actually look.

- Service Bus dead-letters automatically once max delivery count is reached, and also on lock expiry and message expiry
- Queue Storage moves the message to `<queue-name>-poison` after `maxDequeueCount` attempts
- Event Grid dead-letters to a blob container you configure on the subscription, not to a queue
- Blob triggers write poison blobs through the same queue mechanism

None of these alert anyone. Put a function on the poison queue and on the dead-letter queue that at minimum logs the payload and raises a metric, and alert on the depth of both.

---

## Advanced Bindings and Triggers

### Custom Bindings

Azure Functions ships [binding extensions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings){:target="_blank" rel="noopener noreferrer"} for common Azure services, and you can build your own as NuGet packages. Build one when a cross-cutting concern (an internal service client, a shared authorization step, a house data format) appears in enough functions that the boilerplate outweighs the cost of maintaining an extension. For anything less, dependency injection is the simpler answer.

### Event Grid Triggers

[Event Grid triggers](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-event-grid-trigger){:target="_blank" rel="noopener noreferrer"} respond to system and custom events with a push model, so Event Grid delivers to your function rather than your function polling. Retry, backoff, and dead-lettering are configured on the event subscription rather than in your app, and filtering by event type, subject prefix or suffix, or advanced attributes happens before delivery, so you are not billed for events you would have discarded.

The Event Grid blob trigger is also the recommended blob trigger implementation, and the only one Flex Consumption supports. The default `LogsAndContainerScan` implementation polls storage logs and can lag by minutes.

### Service Bus and Queue Storage Triggers

[Service Bus triggers](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-service-bus){:target="_blank" rel="noopener noreferrer"} bring ordering through sessions, a built-in dead-letter queue, scheduled delivery, and transactions across entities. Queue Storage is the cheaper, simpler option: a plain competing-consumers queue with at-least-once delivery, no ordering guarantee, and no publish-subscribe of any kind. If you need fan-out to multiple subscribers, that is a Service Bus topic or Event Grid, not a storage queue.

Use extension 5.x for either. The legacy Service Bus SDKs (`WindowsAzure.ServiceBus`, `Microsoft.Azure.ServiceBus`, and `com.microsoft.azure.servicebus`) and the SBMP protocol are retired on **30 September 2026**.

### Kafka Triggers

Azure Functions supports [Kafka triggers and bindings](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-kafka){:target="_blank" rel="noopener noreferrer"} against the Event Hubs Kafka endpoint or a self-managed cluster, on Flex Consumption, Premium, and Dedicated, but **not on Consumption**. On Premium you must enable runtime scale monitoring for the app to scale beyond one instance.

Two practical constraints: managed identity is not supported for Kafka connections, so credentials come from Key Vault or App Configuration; and consumption is offset-based within a consumer group, which means partition count caps parallelism and functions must be idempotent.

---

## Stateful vs Stateless Design

### Stateless Functions Are the Default

Each invocation is independent, which is what makes horizontal scaling free of coordination and makes failures cheap: a queue-triggered processor that crashes leaves the message to be redelivered.

The cost is that state lives somewhere else, and multi-step work becomes a set of functions coordinating through messages, which means you own the correlation, the timeouts, and the compensation logic.

### Stateful Design with Durable Functions

An orchestrator holds workflow state in its history, so a multi-step approval flow with timeouts and human decisions is one readable method rather than a table of workflow rows and a timer job. The price is the determinism constraint, a history that grows with every step, and the versioning problem described earlier.

### Entity Functions for Shared State

Entities hold mutable state addressed by a key and process their operations one at a time, which makes them the right tool for counters, per-user session state, resource locks, and aggregations that would otherwise need optimistic concurrency against a database.

In the isolated worker model, the cleanest form derives from `TaskEntity<TState>`, which deserializes state into the `State` property and supports constructor injection:

```csharp
public class Counter : TaskEntity<int>
{
    public void Add(int amount) => this.State += amount;

    public Task Reset()
    {
        this.State = 0;
        return Task.CompletedTask;
    }

    public Task<int> Get() => Task.FromResult(this.State);

    [Function(nameof(Counter))]
    public static Task Run([EntityTrigger] TaskEntityDispatcher dispatcher)
        => dispatcher.DispatchAsync<Counter>();
}
```

The entry point **must be `static`**, and it must not be named `RunAsync`, because `ITaskEntity` already defines an instance method by that name and the ambiguity surfaces as a runtime error rather than a compile error.

An orchestrator signals an entity one-way, or calls it and awaits the result:

```csharp
var entityId = new EntityInstanceId("Counter", "myCounter");

await context.Entities.SignalEntityAsync(entityId, "Add", 1);
int currentValue = await context.Entities.CallEntityAsync<int>(entityId, "Get");
```

Two constraints on the isolated model shape how far you can take entities. Interface-based typed proxies are in-process only, so isolated access is string-based and unchecked at compile time. And the MSSQL backend does not support entities on .NET isolated at all.

---

## Performance Optimization

### Code Optimization

**Dependency injection** keeps expensive clients alive across invocations instead of rebuilding them per call. Registering `HttpClient` through `IHttpClientFactory` also gets you connection reuse and rotation, which matters because socket exhaustion is the classic Functions failure under load.

```csharp
public class RateFunctions
{
    private readonly HttpClient _httpClient;

    public RateFunctions(IHttpClientFactory factory)
        => _httpClient = factory.CreateClient();

    [Function(nameof(GetRates))]
    public async Task<HttpResponseData> GetRates(
        [HttpTrigger(AuthorizationLevel.Function, "get")] HttpRequestData req)
    {
        // the client and its connection pool are reused across invocations
        string payload = await _httpClient.GetStringAsync("https://api.example.com/rates");

        HttpResponseData response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteStringAsync(payload);
        return response;
    }
}
```

**Lazy initialization** defers loading anything large (a model, a lookup table, a compiled ruleset) until a code path actually needs it, so instances that never hit that path never pay for it.

**Async throughout.** Blocking on a `Task` inside a function ties up a thread the host needs for other concurrent invocations on the same instance, which turns a concurrency setting into a deadlock risk.

### Monitoring

[Application Insights](https://learn.microsoft.com/en-us/azure/azure-functions/functions-monitoring){:target="_blank" rel="noopener noreferrer"} is integrated with Functions and is where execution time, failures, and dependency calls land. Connect it with a **connection string**, not an instrumentation key.

Instrumentation is OpenTelemetry now. Functions turns it on in `host.json`:

```json
{
  "version": "2.0",
  "telemetryMode": "OpenTelemetry"
}
```

This is **not supported for C# in-process apps**, which is one more reason the November 2026 in-process deadline is a thing to plan around rather than defer.

Watch execution duration against the plan's timeout, failure rate split by function rather than app-wide, dependency call counts (an N+1 inside a fan-out multiplies by the batch size), the depth of every poison and dead-letter queue, and instance count against the plan's ceiling. An app pinned at its maximum instance count is throttled whether or not anything is failing.

---

## Comparison with AWS and Google Cloud

### vs AWS Lambda and Step Functions

| Aspect | Azure Functions + Durable | AWS Lambda + Step Functions |
|--------|--------------------------|---------------------------|
| **Where orchestration lives** | In your code, as an extension of the compute service | In a separate service, as a state machine definition |
| **Orchestration authoring** | Ordinary control flow in the app's language | Amazon States Language, declarative |
| **State durability** | Event-sourced history in a storage backend you choose | Managed by Step Functions |
| **Service integration** | Declarative triggers and bindings, including outputs | Event source mappings; SDK calls for outputs |
| **Hosting choice** | Five plans with different scaling and networking | One managed runtime, tuned by memory and concurrency |

The trade-off is the one that first row implies. Writing the workflow as code means it can be unit-tested, refactored, and reviewed like code; it also means the workflow inherits the replay determinism constraint and the versioning problem, neither of which a declarative state machine has.

### vs Google Cloud

Google's equivalent split is Cloud Run functions for compute and Cloud Workflows for orchestration, again a separate declarative service, so the structural contrast above applies to both hyperscaler competitors. Cloud Run functions configure memory per function, where Azure sets it per plan or per instance size. That is the difference that most often forces a redesign during a migration: an Azure function app is sized as a unit, so one memory-hungry function pulls the whole app's instance size up with it.

---

## Common Pitfalls

### Pitfall 1: Non-Deterministic Orchestrator Code

**Problem:** Using `DateTime.UtcNow`, `Guid.NewGuid()`, random numbers, or direct I/O inside an orchestrator.

**Result:** On replay the code takes a different path than the history records, and the orchestration fails or corrupts its state.

**Solution:** Use `context.CurrentUtcDateTime` and `context.NewGuid()`, and move anything genuinely non-deterministic into an activity function, whose result is recorded once and replayed thereafter.

---

### Pitfall 2: Treating the C# In-Process Model as Current

**Problem:** New code written against `[FunctionName]`, `IDurableOrchestrationContext`, and the `Microsoft.Azure.WebJobs.Extensions.*` packages.

**Result:** The app sits on a model that loses support on **10 November 2026**, cannot use OpenTelemetry telemetry mode, and needs every function signature rewritten to migrate.

**Solution:** Start new apps on the isolated worker model, and schedule the migration for existing ones rather than treating the deadline as distant.

---

### Pitfall 3: Scaling Faster Than Downstream Services

**Problem:** Functions scale on trigger backlog depth while a database, an API, or a partitioned service stays the size it was.

**Result:** Throttled calls, timeouts inside functions, a growing trigger backlog that scales the app further, and a failure that looks like a Functions problem.

**Solution:** Set per-instance concurrency deliberately, cap the app's maximum instance count, and monitor downstream throttling metrics. The effective concurrency is the per-instance limit times the instance count.

---

### Pitfall 4: Large State in Orchestration History

**Problem:** Passing large objects into orchestrators, or returning large results from activities.

**Result:** Every replay reads and deserializes the whole history, so orchestrations get slower as they progress, and storage costs climb with them.

**Solution:** Pass identifiers and let activities fetch what they need. For long-running or eternal orchestrations, use `ContinueAsNew` to reset the history, or split the work into sub-orchestrations that each keep a bounded history.

---

### Pitfall 5: Assuming a Retry Policy Applies

**Problem:** Adding a retry policy attribute to a Service Bus or Queue Storage trigger and assuming failures retry the way it says.

**Result:** Nothing retries the way you configured. Delivery counts and dead-lettering govern instead, silently, with different limits.

**Solution:** Check the trigger against the retry table above. Only Cosmos DB, Event Hubs, Kafka, and Timer honor retry policies; everything else is configured on the binding extension or the source service.

---

### Pitfall 6: Expecting Slots on Flex Consumption

**Problem:** Designing a blue-green deployment around slot swaps, then choosing Flex Consumption because it is the recommended serverless plan.

**Result:** No slots exist on that plan, and the deployment design has to be rebuilt late.

**Solution:** Decide the plan and the deployment strategy together. Flex Consumption uses rolling site updates for zero-downtime deployment; slots are a Premium, Dedicated, and Consumption feature, and even there a swap does not guarantee zero downtime for executions already in flight.

---

## Key Takeaways

1. **Durable Functions turn a workflow into ordinary code, and replay is the price.** Every advance re-executes the orchestrator from the top against its recorded history. Determinism constraints, history growth, and the versioning problem all follow from that one mechanism.

2. **Write new C# on the isolated worker model.** In-process support ends 10 November 2026, it cannot use OpenTelemetry telemetry mode, and the type names differ enough that migration is a real edit rather than a package bump.

3. **Flex Consumption is the default for new serverless apps, and Consumption is legacy.** Flex scales to 1,000 instances, supports virtual network integration, and has no 10-minute timeout ceiling, but it has no deployment slots, so pick the plan and the deployment strategy together.

4. **Two limits ignore your timeout setting.** HTTP responses cap at 230 seconds on every plan, and the language worker gets 60 non-configurable seconds to start.

5. **Retry behavior is per trigger, not per platform.** Only Cosmos DB, Event Hubs, Kafka, and Timer honor Functions retry policies. Everything else uses delivery counts, poison queues, or the source service's own retry.

6. **Concurrency limits are per instance and `host.json` is per app.** The number that reaches your database is the per-instance limit times the instance count, and you cannot tune two functions differently inside one app.

7. **Choose the Durable storage backend deliberately, because you cannot change it.** Durable Task Scheduler is the recommended managed option; Netherite loses support 31 March 2028, and MSSQL does not support entities on .NET isolated.

8. **No one publishes Azure Functions cold start durations.** Microsoft documents which plans scale to zero and what mitigates it. Every figure you will find quoted is somebody else's benchmark, so measure your own app.

9. **Dead-letter destinations are all silent by default.** Poison queues, Service Bus dead-letter queues, and Event Grid's dead-letter blob container fill up without alerting anyone. Put a function and an alert on each one.

10. **Entities are the answer to shared mutable state, with isolated-model caveats.** They serialize operations per key, which handles counters and locks cleanly, but typed proxies are in-process only and MSSQL cannot back them on isolated.
