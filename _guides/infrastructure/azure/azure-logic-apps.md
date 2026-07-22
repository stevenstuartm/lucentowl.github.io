---
title: "Azure Logic Apps & Durable Functions"
layout: guide
category: Azure
subcategory: Application Integration & Messaging
description: "Workflow orchestration on Azure comparing Logic Apps and Durable Functions, covering hosting tiers, connectors, the orchestrator replay model, durable entities, compensation, and choosing the right orchestration tool."
tags: [logic-apps, durable-functions, workflow-orchestration, durable-entities, saga-pattern, connectors, practical]
---

## What Are Logic Apps and Durable Functions

Azure provides two paths to building workflows that coordinate work across multiple systems, handle long-running processes, and manage approval flows and human interaction.

[Azure Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview){:target="_blank" rel="noopener noreferrer"} is a serverless workflow platform with a visual designer. You build workflows by connecting steps, configuring triggers and actions, and using the extensive built-in connector ecosystem to integrate with SaaS applications, Azure services, and on-premises systems.

[Azure Durable Functions](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview){:target="_blank" rel="noopener noreferrer"} is a code-first extension of Azure Functions that allows functions to coordinate with each other, maintain state across function calls, and express complex workflows in code. You write orchestrator functions that coordinate the execution of activity functions and entity functions.

Both run serverless with pay-per-execution pricing and automatic scaling. They solve the orchestration problem from opposite directions: Logic Apps favors visual, low-code composition while Durable Functions favors code-first control and precision.

### What Problems They Solve

**Without a workflow orchestration platform:**
- Building multi-step processes requires writing complex state management code or relying on message queues
- Long-running operations are difficult to monitor and resume after failures
- Integrating with external systems requires building and maintaining custom connectors
- Approval workflows require building custom logic to handle human interaction
- Error handling, retries, and compensation become boilerplate scattered across your code

**With Logic Apps:**
- Visual, low-code workflows eliminate boilerplate integration code
- 1,400+ pre-built connectors connect to SaaS, Azure, and on-premises systems instantly
- Built-in retry, timeout, and error handling policies
- Approval workflows handled by native approval connectors
- Visual tracing of workflow execution through Azure Portal
- Non-technical stakeholders can understand and modify workflows

**With Durable Functions:**
- Express complex workflows as C# or Python code you control entirely
- Reliable function coordination with automatic checkpointing
- Maintain state across multiple function invocations without explicit state management
- More efficient resource usage for high-volume, fine-grained orchestration
- Full testing support through unit test frameworks
- Version and deploy orchestration logic like regular code

### How They Differ from AWS

| Concept | AWS Step Functions | Azure Logic Apps | Azure Durable Functions |
|---------|-------------------|-----------------|-------------------------|
| **Model** | State machine JSON definition | Visual workflow designer or code | Code-first orchestration (C#, Python, JavaScript) |
| **Connectors** | AWS services + limited integrations | 1,400+ connectors (Microsoft, third-party SaaS) | No built-in connectors; compose from Functions or call HTTP APIs |
| **Pricing** | Per state transition | Per action execution (Consumption) or plan capacity (Standard) | Per function execution, plus backend storage transactions |
| **Long-running support** | 1 year (Standard workflows) | 90 days maximum run duration | Effectively unbounded; an orchestration can run for months |
| **Visual design** | Available in Console (basic) | Primary interface | Through VS Code or CLI |
| **Approval workflows** | Requires custom Lambda + SNS | Native approval actions | Manual implementation required |
| **Starter use case** | Gluing AWS services together | Integration with SaaS and third-party systems | Complex multi-step functions that need state |

---

## Logic Apps: Two Tiers

Azure Logic Apps comes in two tiers, and the split is structural rather than a matter of size. The unit of deployment differs: **a Consumption logic app resource holds exactly one workflow, while a Standard logic app resource holds many.** That single fact drives most of the operational differences below, because everything a Standard app owns (the plan, the storage account, the VNet integration, the private endpoints) is shared across every workflow inside it.

### Consumption Tier

Consumption tier is the original Logic Apps offering. It runs in a multi-tenant Azure environment, scales automatically, and you pay per action execution.

**Characteristics:**
- Runs on shared infrastructure (multi-tenant), where all logic apps across all Microsoft Entra tenants share the same compute, storage, and network
- One workflow per logic app resource
- Fully managed, with no infrastructure to configure
- Scales automatically to handle demand
- Pricing: per action execution + connector cost
- Best for: integration workflows where per-action billing stays comfortable and the shared platform's throughput ceiling is not in play

**When Consumption makes sense:**
- Building integrations with SaaS applications (Salesforce, SharePoint, Dynamics)
- Occasional batch jobs (daily, weekly reports)
- Alert and notification workflows
- Approval workflows with moderate throughput
- Proof-of-concept integrations

### Standard Tier (Single-Tenant)

Standard tier runs the Logic Apps runtime on infrastructure dedicated to you. There are three hosting options, and they are not interchangeable:

- **Workflow Service Plan** (single-tenant Azure Logic Apps) is the default. You pick a pricing tier and the plan hosts the runtime
- **App Service Environment v3**, Windows plans only, for full network isolation. You pay for the ASE plan regardless of how many logic apps run in it
- **Hybrid deployment** runs the Logic Apps runtime on your own infrastructure as an Azure Container Apps extension, for partially connected environments that need local processing and storage

**Characteristics:**
- Runs on dedicated infrastructure (single-tenant)
- Multiple stateful and stateless workflows per logic app resource, sharing its compute, storage, and network
- You control the scaling and auto-scale configuration
- Pricing: plan capacity, plus Azure Storage transactions for stateful workflows
- Native VNet integration and private endpoints, with your own static outbound IP
- Data stays in the deployment region, where Consumption replicates to the paired region

**When Standard makes sense:**
- High-volume workflows where per-action billing would dominate the cost
- Workflows that need built-in connectors for throughput and cost reasons (see below)
- Custom connectors or extensibility requirements
- Workflows that must reach resources inside a virtual network
- Workflows that must run on your own infrastructure
- Inline .NET, C# script, or PowerShell code, none of which Consumption supports

### Comparing the Tiers

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| **Infrastructure** | Multi-tenant, shared | Single-tenant, dedicated |
| **Workflows per resource** | Exactly one | Many, stateful and stateless |
| **Scaling** | Automatic | You configure the plan and autoscale |
| **Pricing model** | Pay per action | Pay for plan capacity + storage transactions |
| **Action throughput ceiling** | 100,000 executions per 5-minute rolling interval | No published per-app ceiling |
| **Max run duration** | 90 days | Stateful 90 days, stateless 5 minutes |
| **Inline code** | JavaScript only | JavaScript, .NET, C# scripts, PowerShell |
| **Customization** | Limited | Custom connectors, extensibility |
| **Networking** | Shared outbound IPs | VNet integration, private endpoints, static outbound IP |
| **Deployment** | Azure managed | Your deployment pipeline |
| **On-premises connectivity** | Requires the on-premises data gateway | Gateway, VNet integration, or hybrid deployment |

---

## Logic Apps: Connectors and Actions

A Logic Apps workflow is a sequence of triggers and actions. A trigger starts the workflow (when a file is created, when an email arrives, on a schedule). Actions perform work or call external systems.

### The Connector Ecosystem

Logic Apps connectors integrate with external systems. There are over 1,400 pre-built connectors covering most common services:

**Microsoft services:**
- Azure services: Event Grid, Service Bus, Blob Storage, SQL Database, Dynamics 365
- Microsoft 365: Outlook, Teams, SharePoint, Excel Online
- Power Platform: Power Automate, Power Apps

**SaaS applications:**
- Salesforce, Slack, Jira, Azure DevOps, Datadog
- Twilio, SendGrid, ServiceNow
- GitHub, GitLab

**On-premises and hybrid:**
- File shares (SMB, NFS)
- On-premises SQL Server
- Custom services via HTTP or custom connectors

### Built-in vs Managed Connectors

This split is the single most consequential thing to understand about Logic Apps cost and throughput, and it is also where the two tiers diverge most.

**Built-in connectors** run natively inside the Logic Apps runtime, in the same process as your workflow. No network hop to a shared connector service, no per-call connector charge.

Both tiers have the workflow-control built-ins:

- HTTP (call any REST API)
- Request and Response (receive inbound HTTP calls)
- Recurrence (schedule-based triggers)
- Data operations, control structures, and inline code
- Workflow (call another workflow with a callable endpoint)

**Standard tier adds built-in connectors for services that only exist as managed connectors on Consumption**, including Service Bus, Event Hubs, Blob Storage, SQL Server, Cosmos DB, and SFTP. Running those in-process is why Microsoft describes Standard as offering higher throughput and lower cost at scale. A workflow that drains a Service Bus queue thousands of times a day is a very different proposition depending on which tier it runs in, and that difference is invisible in the designer because the action looks the same.

**Managed connectors** are Microsoft-hosted proxies that run in multi-tenant Azure and call back into your workflow. Most require creating a connection and authenticating first. They carry a per-call charge, split into standard and premium classes, with premium covering connectors like Salesforce, Oracle, SAP, and IBM MQ.

**Cost implications:**
- Built-in connector operations bill as ordinary actions, with no separate connector charge
- Managed connector calls bill per call on Consumption, at standard or premium rates
- Moving a high-volume workflow to Standard can cut cost twice over: the plan replaces per-action billing, and the built-in equivalents replace per-call connector billing

### Using Connectors: The Designer Experience

Logic Apps provides a visual workflow designer where you:

1. **Define the trigger:** What starts the workflow (schedule, HTTP request, file created, email received)
2. **Add actions:** Drag and drop actions to compose your workflow
3. **Configure conditions:** Branch logic based on values or properties
4. **Set loops and error handling:** Retry policies, timeout settings, error paths
5. **View the code:** Switch to code view to edit the underlying JSON definition

**Example workflow:**
- Trigger: When an email arrives in Outlook with a specific subject
- Action: Parse the email body as JSON
- Action: Query an Azure SQL database based on the email content
- Condition: If the query returns results, send a Slack message
- Otherwise: Send an email notification
- For all: Store the result in Blob Storage

The visual designer makes simple workflows trivial to build. Complex conditional logic or high-volume processing becomes harder to manage visually and may be better suited to Durable Functions.

### Connectors vs Durable Functions

| Aspect | Logic Apps Connectors | Durable Functions |
|--------|----------------------|-------------------|
| **Setup** | Drag-drop, no coding | Write C# / Python / JavaScript |
| **SaaS integration** | 1,400+ pre-built | Manual HTTP calls or libraries |
| **Execution cost** | Per-action pricing (can be expensive at scale) | Per-function execution (cheaper for high throughput) |
| **Customization** | Limited to connector capabilities | Full programming language control |
| **Testing** | Unit testing available but basic | Full unit test framework support |
| **Versioning** | Version control for JSON definition | Version control for code |
| **Learning curve** | Low for simple workflows | Higher (requires coding) |

---

## Durable Functions: Orchestration Patterns

Durable Functions extends Azure Functions to add orchestration capabilities. An orchestrator function directs the execution of activity functions and waits for their completion without blocking compute resources.

### Core Concepts

**Orchestrator functions** are the conductors. They specify which activity functions to call, in what order, in parallel, or in more complex patterns. An orchestrator can also call **sub-orchestrations**, which lets you compose a large workflow out of a library of smaller ones or run many instances of one orchestrator in parallel. The orchestrator function is replayed many times during execution; you write it as if it runs once, and the framework handles the replay.

**Activity functions** are the workers. They do the actual work: call an API, update a database, send a message. An activity function has no orchestration context, so it cannot schedule other activities through the framework. Coordination lives in the orchestrator, where the framework can checkpoint it.

**Entity functions** maintain state across orchestrator invocations. Each entity is addressed by an entity ID (a name plus a key) and **runs its operations serially**, one at a time, which is what makes them safe to use as distributed counters or per-tenant state without your own locking.

**Durable timers** allow workflows to wait for specific times or durations without consuming function compute. On the Consumption plan, an orchestrator awaiting a timer or an external event incurs no execution billing no matter how long it waits.

**Task hubs** are the container for all of this. An instance ID must be unique within a task hub, and each task hub is an isolated set of orchestrations, entities, and queues in the backend. Two deployments sharing a storage account without distinct task hub names will interfere with each other.

### Durable Functions Patterns

#### Pattern 1: Function Chaining

Orchestrator calls activity functions sequentially, passing outputs from one to the next.

```csharp
[FunctionName("OrderProcessingOrchestrator")]
public static async Task<ShippingResult> RunOrchestrator(
    [OrchestrationTrigger] IDurableOrchestrationContext context)
{
    var orderId = context.GetInput<string>();

    // Call activities in sequence. The type parameter is required:
    // the non-generic overload returns Task, not Task<T>.
    var validationResult = await context.CallActivityAsync<ValidationResult>(
        "ValidateOrder", orderId);
    var paymentResult = await context.CallActivityAsync<PaymentResult>(
        "ProcessPayment", validationResult);
    var shippingResult = await context.CallActivityAsync<ShippingResult>(
        "ArrangeShipping", paymentResult);

    return shippingResult;
}
```

**Use case:** Order processing workflow where each step depends on the previous one.

#### Pattern 2: Fan-Out/Fan-In

Orchestrator calls multiple activity functions in parallel, then waits for all to complete.

```csharp
[FunctionName("ReportAggregationOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] IDurableOrchestrationContext context,
    ILogger log)
{
    var departmentIds = context.GetInput<string[]>();

    // Call activities in parallel
    var tasks = departmentIds.Select(deptId =>
        context.CallActivityAsync<DepartmentReport>("FetchDepartmentReport", deptId)
    ).ToList();

    // Wait for all to complete
    DepartmentReport[] results = await Task.WhenAll(tasks);

    // Aggregate results
    await context.CallActivityAsync("AggregateReports", results);
}
```

Fan-out parallelism is bounded by how many function instances the plan will run, not by the orchestrator. The orchestrator schedules all of the work at once and then waits, so a fan-out over 10,000 items does not hold 10,000 threads open anywhere.

**Use case:** Gathering data from multiple systems in parallel (reporting, data aggregation, batch processing).

#### Pattern 3: Async HTTP APIs

Durable Functions can expose HTTP endpoints that start long-running workflows and allow clients to poll or wait for completion.

```csharp
[FunctionName("StartLongRunningWorkflow")]
public static async Task<HttpResponseMessage> HttpStart(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestMessage req,
    [DurableClient] IDurableOrchestrationClient client,
    ILogger log)
{
    string input = await req.Content.ReadAsStringAsync();

    string instanceId = await client.StartNewAsync("MyOrchestrator", input);

    // Returns HTTP 202 with Location and Retry-After headers, so the
    // return type must be HttpResponseMessage, not IActionResult.
    return client.CreateCheckStatusResponse(req, instanceId);
}
```

The client receives HTTP 202 with URLs to check status, poll for results, raise an event, or terminate the workflow.

**Use case:** Long-running batch processing, report generation, data export that clients wait for.

#### Pattern 4: Human Interaction and Timeouts

Orchestrators can wait for human approval or external events before continuing. `WaitForExternalEvent<T>` takes only an event name and waits indefinitely, so a timeout is expressed by racing it against a durable timer with `Task.WhenAny`.

```csharp
[FunctionName("ApprovalWorkflowOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] IDurableOrchestrationContext context)
{
    var request = context.GetInput<PurchaseRequest>();

    // Submit for approval
    await context.CallActivityAsync("RequestApproval", request);

    using (var timeoutCts = new CancellationTokenSource())
    {
        DateTime deadline = context.CurrentUtcDateTime.AddHours(24);
        Task timeoutTask = context.CreateTimer(deadline, timeoutCts.Token);
        Task<bool> approvalTask = context.WaitForExternalEvent<bool>("ApprovalReceived");

        Task winner = await Task.WhenAny(approvalTask, timeoutTask);

        if (winner == approvalTask)
        {
            // Cancel the timer so the orchestration can complete
            timeoutCts.Cancel();

            if (approvalTask.Result)
            {
                await context.CallActivityAsync("ProcessRequest", request);
            }
            else
            {
                await context.CallActivityAsync("RejectRequest", request);
            }
        }
        else
        {
            await context.CallActivityAsync("EscalateRequest", request);
        }
    }
}
```

Cancelling the timer matters. An orchestration does not complete while a durable timer is still pending, so forgetting `timeoutCts.Cancel()` leaves an approved request sitting in a Running state until the deadline passes.

External events carry an **at-least-once** delivery guarantee, the same as activity results. A restart or a scale event can deliver the same approval twice, so include an ID in the event payload and deduplicate on it. An event raised against an instance ID that does not exist is silently discarded rather than erroring.

The **monitor** variant uses the same machinery with the loop inverted: poll an activity, sleep on a durable timer, repeat until a condition holds or a deadline passes. Because a pending timer costs nothing on Consumption, a monitor that checks every hour for a week is close to free, where the same thing built on a timer-triggered function pays for every wake-up.

**Use case:** Approval workflows, manual intervention steps, and long-running polling that would be wasteful as a scheduled job.

#### Pattern 5: Compensation (Saga Pattern)

Orchestrator calls activity functions that can roll back if a later step fails. There is no distributed transaction underneath, so "roll back" means calling a second activity that undoes the first.

```
  BookFlight ──ok──► BookHotel ──ok──► BookCar ──ok──► done
      │                  │                │
    fails              fails            fails
      │                  │                │
      ▼                  ▼                ▼
   nothing to      CancelFlight      CancelFlight
   compensate                        CancelHotel
      │                  │                │
      └──────────────────┴────────────────┘
                         │
                         ▼
              rethrow: orchestration ends Failed

  Each compensating call is itself an activity, so it gets
  the same checkpointing and retry policy as the forward path.
  A compensation that throws leaves the saga partially undone.
```

```csharp
[FunctionName("TravelBookingOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] IDurableOrchestrationContext context)
{
    var trip = context.GetInput<TripRequest>();

    try
    {
        await context.CallActivityAsync("BookFlight", trip);
        await context.CallActivityAsync("BookHotel", trip);
        await context.CallActivityAsync("BookCar", trip);
    }
    catch (Exception ex)
    {
        // Compensate: cancel everything
        await context.CallActivityAsync("CancelFlight", trip);
        await context.CallActivityAsync("CancelHotel", trip);
        await context.CallActivityAsync("CancelCar", trip);
        throw;
    }
}
```

The example above compensates every step unconditionally, and cancelling a hotel that was never booked usually fails. Track which steps actually succeeded and compensate only those, in reverse order. Compensating activities should also be idempotent, because they get retried like any other activity.

**Use case:** Transactions that span multiple services without distributed transactions, where compensation handles failure.

### State Management in Durable Functions

Durable Functions uses **event sourcing**. It does not store the orchestrator's current state; it stores an append-only history of everything the orchestration has done. Between activity calls the orchestrator is unloaded from memory entirely. When an activity completes, the orchestrator is re-executed **from the first line**, and every `await` that already has a recorded result returns that result immediately instead of re-scheduling the work.

```
  Attempt 1        history: [ExecutionStarted]
    line 1  run  ──► schedule ValidateOrder ──► checkpoint, unload
                                                     │
                                          ValidateOrder runs, returns
                                                     │
  Attempt 2        history: [.., TaskCompleted: ValidateOrder]
    line 1  REPLAY ──► result from history, no call
    line 2  run    ──► schedule ProcessPayment ──► checkpoint, unload
                                                     │
                                        ProcessPayment runs, returns
                                                     │
  Attempt 3        history: [.., TaskCompleted: ProcessPayment]
    line 1  REPLAY ──► from history
    line 2  REPLAY ──► from history
    line 3  run    ──► schedule ArrangeShipping ──► ...

  Every line above the current one runs again on every attempt.
```

Two consequences follow from that picture, and both surprise people reading the code as if it ran once.

**Orchestrator code must be deterministic.** On replay it has to make the same decisions it made the first time, or the framework's position in the history no longer matches the code's position. So no `DateTime.UtcNow` (use `context.CurrentUtcDateTime`), no `Guid.NewGuid()` (use `context.NewGuid()`), no `Random`, no reading configuration or a database to decide a branch.

**Orchestrators cannot do I/O at all.** Network calls, file access, and environment reads belong in activity functions, which run exactly once per scheduled call and have their results checkpointed. The sanctioned exception is `context.CallHttpAsync`, which the framework records like an activity result. Logging is the other trap: an orchestrator's log statements re-emit on every replay unless you use the replay-safe logger.

### Storage Providers

The history has to live somewhere, and the backend is a deployment-time choice you cannot change later. **There is no migration path between providers**, so switching means standing up a new app.

| Provider | Notes |
|---|---|
| **Durable Task Scheduler** | Azure-managed and **Microsoft's recommended option**. Highest throughput of the four, includes a monitoring dashboard, supports managed identity. Works with existing code unchanged |
| **Azure Storage** | The original default. Uses queues, tables, and blobs. Cheapest at low volume, best local emulation, most battle-tested. Moderate throughput, scales out to 16 nodes |
| **MSSQL** | Persists to SQL Server or Azure SQL. The option for disconnected or on-premises environments, and the only one with transactional consistency between event delivery and orchestrator state |
| **Netherite** | Built on Event Hubs and FASTER. Very high throughput, but **support ends 31 March 2028**. Do not start new work on it |

On the Flex Consumption plan, only Durable Task Scheduler and Azure Storage are supported.

Backend choice also affects billing. With the Azure Storage provider you pay for storage transactions on top of function executions, and a chatty orchestration with many short activities can spend more on transactions than on compute.

### Entity Functions for Distributed State

Entity functions maintain state without explicit state management code. They act like stateful objects, addressed by an entity ID and processing one operation at a time:

```csharp
[FunctionName("Counter")]
public static void Counter([EntityTrigger] IDurableEntityContext ctx)
{
    switch (ctx.OperationName.ToLowerInvariant())
    {
        case "add":
            ctx.SetState(ctx.GetState<int>() + ctx.GetInput<int>());
            break;
        case "subtract":
            ctx.SetState(ctx.GetState<int>() - ctx.GetInput<int>());
            break;
        case "get":
            ctx.Return(ctx.GetState<int>());
            break;
    }
}
```

Orchestrators call entity functions to read and update state:

```csharp
var entityId = new EntityId("Counter", "counter-1");

// Signal: one-way, fire and forget, no result
context.SignalEntity(entityId, "add", 5);

// Call: two-way, awaits the result
var value = await context.CallEntityAsync<int>(entityId, "get");
```

Who can do what is asymmetric, and it constrains the design more than the API surface suggests:

- **Orchestrators** can both signal and call, so they are the only place you get a response from an entity
- **Client functions** can signal an entity and read its persisted state, but cannot call it
- **Entities** can signal other entities, but cannot call them

A client reading entity state gets the last **committed** state from the tracking store, which can lag the entity's in-memory state. Only an orchestrator can read the live value.

**Coordinating multiple entities** is where naive use goes wrong. Because each entity serializes its own operations but nothing coordinates across entities, a transfer between two counters can interleave. Orchestrators solve this with `LockAsync`, which takes durable locks across a set of entities:

```csharp
using (await context.LockAsync(sourceEntity, destinationEntity))
{
    // No other orchestration can operate on either entity here.
    // Locks are durable and survive process recycling.
}
```

Critical sections are guaranteed not to deadlock, which is bought with restrictions: they cannot nest, cannot create sub-orchestrations, can only call the entities they locked, and can only signal entities outside the lock set. Violating any of those raises a runtime error. They also do not roll back on failure, so a failure inside the section leaves whatever it already changed in place.

**Use case:** Tracking workflow state, distributed counters, multi-tenant resource limits, status aggregation.

---

## Decision Framework: Logic Apps vs Durable Functions

The platform choice and the Logic Apps tier choice are usually made together, so it helps to walk them as one decision:

```
Is the workflow mostly about reaching external systems
(SaaS, Microsoft 365, on-prem, B2B/EDI)?
  │
  ├─ no ──► Is it mostly conditional logic, fine-grained
  │         coordination, or state you want in code?
  │           ├─ yes ──► Durable Functions
  │           └─ no  ──► Either; pick on team skills
  │
  └─ yes ──► Logic Apps. Which tier?
              │
              Do you need any of: VNet/private endpoint access,
              inline .NET or PowerShell, custom connectors,
              or on-premises hosting?
                ├─ yes ──► Standard
                └─ no
                    │
                    Rough action volume per month?
                      ├─ low/spiky ─────► Consumption
                      │                   (pay only for what runs)
                      └─ sustained/high ► Standard
                                          (plan pricing plus
                                           built-in connectors)

  Mixed workloads are common: Logic Apps at the edges for
  connectors and approvals, Durable Functions in the middle
  for orchestration-heavy or high-volume steps.
```

Choose Logic Apps when:
- You need to integrate multiple SaaS applications and Azure services
- The workflow is largely about connecting external systems, not complex business logic
- Non-technical stakeholders will review or modify the workflow
- Approvals, notifications, and human-in-the-loop steps are central to the workflow
- You are starting and need rapid prototyping
- Throughput is moderate (hundreds to low thousands per day)

Choose Durable Functions when:
- The orchestration logic is complex or conditional
- You need to coordinate many fine-grained function calls efficiently
- The workflow involves calling custom APIs or services without pre-built connectors
- Throughput is high (tens of thousands per day or higher)
- You need full unit test coverage of orchestration logic
- Cost is a factor and per-action pricing would be expensive

Combine both when:
- Use Logic Apps as the front-end for integrating with SaaS (Outlook, Slack, ServiceNow)
- Call Durable Functions from Logic Apps for complex orchestration or high-volume processing
- Use Durable Functions as the core orchestrator, call Logic Apps for specific connector-heavy steps

### Selection Matrix

| Scenario | Logic Apps | Durable Functions | Both |
|----------|-----------|-------------------|------|
| SaaS integration (Salesforce, Slack, Teams) | ✓ | ✗ | ✓ (Logic Apps frontend) |
| Complex conditional logic | ✗ | ✓ | ✓ (Durable Functions core) |
| Approval workflows | ✓ | ✗ | ✓ (Logic Apps for approvals) |
| High-volume processing (10K+ per day) | Expensive | ✓ | ✓ (Durable Functions) |
| API coordination | ✗ | ✓ | ✓ |
| Scheduled reports | ✓ | ✓ | Either |
| Rapid prototyping | ✓ | ✗ | ✓ (Logic Apps to start) |
| Teams should understand code | ✗ | ✓ | ✓ (Durable Functions) |

---

## Logic Apps Standard: Stateful Workflows

Logic Apps Standard (single-tenant) introduces **stateful** and **stateless** workflow options.

**Stateful workflows** store execution history and state in a persistent store. They are durable and can resume after failures or service restarts. Stateful workflows are the default and recommended for most use cases.

**Stateless workflows** do not persist state. They are lightweight and fast, suitable for short-running workflows where failure recovery isn't critical. Stateless workflows are cheaper per execution and faster.

### Stateful Workflows

- Execute once, stored state survives service restarts
- Full execution history available (inputs, outputs, actions)
- Can resume from failures
- Support durable timers and long-running operations
- Higher latency and storage cost
- Best for: Integration workflows requiring durability

### Stateless Workflows

- Execute immediately, state held in memory only
- No history after completion, which also means no action-level tracing to debug with
- Cannot resume. An interrupted run is not automatically restored, and the **caller must resubmit it manually**
- **Run synchronously only, with a 5-minute run duration**
- Lower latency and no storage transaction cost
- Microsoft recommends keeping total payload under **64 KB**, because larger content can slow the workflow badly or crash it with out-of-memory errors
- Best for: synchronous transformations, webhooks, request-response patterns

The absence of run history is the trade most teams underweight. Stateless workflows are cheaper and faster, and when one misbehaves in production there is nothing to look at.

---

## Error Handling and Retry Policies

Both Logic Apps and Durable Functions provide built-in error handling and retry capabilities. Both also deliver **at least once**. Logic Apps rarely delivers a message more than once, and rarely is not never, so a workflow that charges a card or sends a notification needs idempotence built into the workflow or the downstream system. The same holds for Durable Functions activity results and external events.

### Logic Apps Error Handling

**Scopes and error handling:**
- Wrap actions in a scope to apply retry and error handling policies
- Configure retry policies (exponential backoff, immediate, fixed interval)
- Define error actions (run actions when the scope fails)

**Timeout settings** are frequently misquoted, and the numbers that matter are smaller than people expect:

| Limit | Consumption | Standard |
|---|---|---|
| Max run duration | 90 days | Stateful 90 days, stateless 5 minutes |
| Run history retention | 90 days | 90 days (configurable) |
| Outbound HTTP request timeout | 120 seconds | 225 seconds (configurable) |
| `Until` loop timeout | 1 hour | Stateful 1 hour, stateless 5 minutes |
| `For each` concurrent iterations | 20 default, 50 max | 20 default, 50 max |

The **120-second outbound timeout** on Consumption is the one that bites. Any HTTP action calling a backend that occasionally takes longer than two minutes fails, regardless of how long the workflow itself is allowed to run. The fix is an asynchronous polling pattern or an `Until` loop, not a larger timeout.

Run duration is also bounded by retention: if a run outlives the run-history retention setting, its history is deleted while the run is still going. Keep retention greater than or equal to the longest run you expect.

### Durable Functions Error Handling

**Automatic retries:**
- Configure retry policies on `CallActivityAsync` and sub-orchestration calls
- Retry options include exponential backoff, max attempts, and a retry timeout
- Default behavior: no retry, the exception surfaces to the orchestrator

**Exception handling:**
- Use try-catch blocks in orchestrators
- Implement compensation in catch blocks
- An **unhandled exception ends the orchestration in a `Failed` state, and a failed instance cannot be retried.** Recovery means starting a new instance, which is a reason to keep orchestrators thin and put the fallible work in activities where retry policies apply

**Timeout handling:**
- Durable timers fire after a specified duration and cost nothing while pending
- Race a timer against an activity or an external event using `Task.WhenAny`
- Cancel the timer's token once the other task wins, or the orchestration stays Running until the timer fires

### Compensation Patterns

Both platforms support compensation when steps fail:

**Logic Apps:** Use error handling paths and Scope actions to undo successful steps when a later step fails.

**Durable Functions:** Use try-catch with compensation logic. Call activity functions to reverse the effects of previous steps.

---

## Integration with Azure Services

### Logic Apps Integration

Logic Apps connectors provide native integration with:

- **Service Bus:** Trigger on messages, send messages
- **Event Grid:** Trigger on events, send events
- **Azure Functions:** Trigger Durable Functions from Logic Apps
- **Blob Storage:** Trigger on blob creation, read/write files
- **SQL Database:** Query, insert, update data
- **Application Insights:** Send telemetry, query metrics

This makes Logic Apps ideal for event-driven workflows and cross-service coordination.

### Durable Functions Integration

Durable Functions integrate through HTTP calls or the Azure SDK:

- **Event Grid:** Durable Functions can read Event Grid events or send events
- **Service Bus:** Call Service Bus SDK from activities
- **Storage:** Direct storage API calls from activities
- **Azure Services:** Any Azure service with a .NET/Python/JavaScript SDK

This gives Durable Functions more flexible but requires explicit API calls rather than visual connectors.

---

## Monitoring and Observability

### Logic Apps Monitoring

- **Workflow runs:** Azure Portal shows detailed execution history
- **Action-level tracing:** See inputs and outputs of each action
- **Diagnostic logs:** Send logs to Log Analytics for querying
- **Alerts:** Alert on workflow failures or slow executions

### Durable Functions Monitoring

- **Instance queries:** Query orchestrator status by instance ID
- **Automatic telemetry:** Application Insights automatically tracks function calls
- **Execution history:** Durable Functions runtime stores execution events
- **Custom logging:** Use standard Azure Functions logging (Application Insights, Log Analytics)

---

## Common Pitfalls

### Pitfall 1: Logic Apps Explosion with High Throughput

**Problem:** Building a high-volume workflow in Logic Apps Consumption tier, treating it as appropriate for thousands of operations per day.

**Result:** Action costs explode. A workflow with 10 actions processing 10,000 items per day costs 100,000 actions per day, and any managed connector calls among those 10 bill separately on top. Consumption pricing makes this expensive well before it becomes technically infeasible.

**Solution:** For high-volume orchestration, use Durable Functions or Logic Apps Standard tier. Calculate action cost upfront: (actions per workflow) × (estimated daily volume) × (cost per action), then add the managed connector calls at their own rate. Moving the same workflow to Standard often wins twice, because plan pricing replaces per-action billing and the built-in connector equivalents replace per-call connector billing.

---

### Pitfall 2: Non-Deterministic Orchestrator Functions

**Problem:** Writing orchestrator functions that use `DateTime.UtcNow`, `Random`, or branching on non-deterministic values.

**Result:** Orchestrators fail to replay correctly. State becomes inconsistent. Workflow hangs or behaves unexpectedly.

**Solution:** Always use `context.CurrentUtcDateTime` instead of `DateTime.UtcNow`. Avoid random numbers. Keep orchestrators deterministic.

---

### Pitfall 3: Coordinating Work Inside Activity Functions

**Problem:** Putting sequencing logic inside an activity function, so one activity invokes the next step's work directly rather than returning to the orchestrator.

**Result:** None of that work is checkpointed. The framework has no record that step two happened, so a crash mid-activity replays the whole thing, retry policies apply only to the outer call, and the run history shows one opaque activity instead of the sequence you actually ran.

**Solution:** Keep coordination in the orchestrator, where every scheduled call is recorded in the history and carries its own retry policy. An activity function has no orchestration context, so it cannot schedule other activities through the framework even if it wanted to. When a unit of work is genuinely composite, make it a **sub-orchestration** rather than an activity that does several things.

---

### Pitfall 4: Waiting for User Approval Without Timeout

**Problem:** Orchestrators waiting indefinitely for an external event (approval) without a timeout.

**Result:** Workflows hang forever. If the approval never arrives, resources stay in a pending state indefinitely.

**Solution:** Always combine external event waits with a durable timer using `Task.WhenAny`. Fail gracefully if timeout expires.

---

### Pitfall 5: Logic Apps Connectors as a Substitute for Custom Integration

**Problem:** Forcing every API call through a connector action even when a custom connector doesn't exist.

**Result:** Building custom connectors becomes the default pattern. This adds operational complexity and becomes harder to maintain than a simple HTTP action calling a REST API.

**Solution:** Use the HTTP action for APIs without pre-built connectors. Reserve custom connectors for APIs called frequently across many workflows.

---

### Pitfall 6: Misreading the Consumption Throughput Limits

**Problem:** Assuming the ceiling is a count of concurrent runs, and turning on trigger concurrency to "control" throughput.

**Result:** Two separate surprises. The real Consumption ceiling is **100,000 action executions per 5-minute rolling interval**, counted in actions rather than runs, so a 20-action workflow hits it at roughly 5,000 runs per interval. Separately, **turning on trigger concurrency is irreversible**: concurrency is unlimited by default, and once enabled it caps at 25 concurrent runs by default (100 on Standard, 100 maximum either way) with a bounded queue of waiting runs behind it. Teams enable it expecting a safety valve and instead install a throttle they cannot remove.

**Solution:** Know which limit you are actually near. For action volume, enable high throughput mode (in preview, raising the ceiling to 300,000 per 5 minutes), split the workload across multiple workflows, or move to Standard, which publishes no equivalent per-app ceiling. Watch the other Consumption limits too: roughly 2,500 concurrent outbound calls and 6 GB of content throughput per 5 minutes. On Standard, throughput is bounded by the backing storage account instead, and a Standard logic app can be configured across up to 32 storage accounts, budgeting roughly 100,000 action executions per minute per account.

---

## Key Takeaways

1. **Logic Apps and Durable Functions solve the same problem from opposite directions.** Logic Apps favors low-code visual composition with pre-built connectors; Durable Functions favors code-first control for complex orchestration.

2. **Choose Logic Apps for SaaS integration and quick wins.** 1,400+ connectors eliminate custom integration code. Approval actions and notifications are built-in. Non-technical stakeholders can understand workflows.

3. **Choose Durable Functions for complex orchestration and high throughput.** Full programming language control, better unit test support, lower per-execution cost at scale, and no artificial action limits.

4. **Understand the cost model before building.** Logic Apps Consumption charges per action, plus per call for managed connectors. Durable Functions charges per function execution plus backend storage transactions, which a chatty orchestration can make the larger line item. At high volumes, Durable Functions is cheaper. At low volumes, Logic Apps is simpler.

5. **Combine both for maximum benefit.** Use Logic Apps as the front-end for SaaS integration. Call Durable Functions for orchestration-heavy steps. Use Durable Functions as the core orchestrator with Logic Apps for connector-specific tasks.

6. **The Consumption/Standard split is structural, not a size setting.** Consumption holds one workflow per resource and bills per action. Standard holds many workflows on a plan you own, adds built-in connectors for services that are managed-only on Consumption, and is the only tier with VNet integration, private endpoints, custom connectors, and on-premises hosting.

7. **Orchestrator code replays from the first line on every checkpoint.** That is why it must be deterministic (no `DateTime.UtcNow`, no `Guid.NewGuid`, no `Random`) and why it cannot do I/O at all. Put every fallible or non-deterministic operation in an activity function, where the result is checkpointed and a retry policy applies.

8. **Always pair external event waits with a durable timer.** `WaitForExternalEvent` waits forever on its own. Race it with `Task.WhenAny` and cancel the timer when the event wins, or the orchestration stays Running until the deadline.

9. **Know which limit you are near.** Consumption caps at 100,000 action executions per 5 minutes and 120 seconds per outbound HTTP call, and enabling trigger concurrency is irreversible. Durable Functions is bounded by its storage backend, which is a deployment-time choice with no migration path.

10. **Both platforms deliver at least once.** Duplicate messages, duplicate activity results, and duplicate external events all happen under restarts and scaling. Design for idempotence rather than assuming exactly-once.

11. **Integration complexity often drives the decision more than orchestration logic.** If your workflow is 80% calling external systems (SaaS, services), Logic Apps is likely the right choice. If it's 80% complex conditional logic and coordination, Durable Functions is the right choice.
