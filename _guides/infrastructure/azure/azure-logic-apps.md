---
title: "Azure Logic Apps & Durable Functions"
layout: guide
category: Azure
subcategory: Application Integration & Messaging
description: "Workflow orchestration on Azure comparing Logic Apps and Durable Functions, covering triggers, connectors, stateful patterns, long-running processes, and choosing the right orchestration tool."
tags: [azure, infrastructure, distributed-systems, automation, integration, scalability, practical]
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
- 400+ pre-built connectors connect to SaaS, Azure, and on-premises systems instantly
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
| **Connectors** | AWS services + limited integrations | 400+ connectors (Microsoft, third-party SaaS) | No built-in connectors; compose from Functions or call HTTP APIs |
| **Pricing** | Per state transition | Per action execution | Per function execution (with extension bundle included) |
| **Long-running support** | Limited (1 year timeout) | Unlimited | Unlimited |
| **Visual design** | Available in Console (basic) | Primary interface | Through VS Code or CLI |
| **Approval workflows** | Requires custom Lambda + SNS | Native approval actions | Manual implementation required |
| **Starter use case** | Gluing AWS services together | Integration with SaaS and third-party systems | Complex multi-step functions that need state |

---

## Logic Apps: Two Tiers

Azure Logic Apps comes in two tiers, each suited to different use cases:

### Consumption Tier

Consumption tier is the original Logic Apps offering. It runs in a multi-tenant Azure environment, scales automatically, and you pay per action execution.

**Characteristics:**
- Runs on shared infrastructure (multi-tenant)
- Fully managed; no infrastructure to configure
- Scales automatically to handle demand
- Pricing: per action execution + connector cost
- Latency: typically 1-5 seconds (due to shared platform overhead)
- Best for: Integration workflows that run occasionally to moderately (dozens to hundreds per day)

**When Consumption makes sense:**
- Building integrations with SaaS applications (Salesforce, SharePoint, Dynamics)
- Occasional batch jobs (daily, weekly reports)
- Alert and notification workflows
- Approval workflows with moderate throughput
- Proof-of-concept integrations

### Standard Tier (Single-Tenant)

Standard tier runs on dedicated infrastructure within your own environment (single-tenant). You provision compute capacity upfront.

**Characteristics:**
- Runs on dedicated infrastructure (single-tenant)
- Deployed to App Service Plan or container
- You control the scaling and auto-scale configuration
- Pricing: compute capacity (App Service Plan) + optional connector charges
- Latency: lower and more predictable than Consumption
- Best for: High-volume, latency-sensitive, or security-sensitive workflows

**When Standard makes sense:**
- High-volume workflows (thousands per day or higher)
- Latency-sensitive integrations requiring sub-second response
- Custom connectors or extensibility requirements
- Workflows that must run within your network or container
- Workflows requiring hybrid authentication or on-premises connectivity
- Cost optimization for sustained high throughput

### Comparing the Tiers

| Aspect | Consumption | Standard |
|--------|-------------|----------|
| **Infrastructure** | Multi-tenant, shared | Single-tenant, dedicated |
| **Scaling** | Automatic | You configure via App Service Plan |
| **Pricing model** | Pay per action | Pay for capacity (App Service Plan) |
| **Suitable throughput** | Dozens to hundreds per day | Hundreds to millions per day |
| **Latency** | 1-5 seconds typical | Lower and predictable |
| **Customization** | Limited | Custom connectors, extensibility |
| **Deployment** | Azure managed | Your deployment pipeline |
| **On-premises connectivity** | Requires gateway | Can run on-premises with container |

---

## Logic Apps: Connectors and Actions

A Logic Apps workflow is a sequence of triggers and actions. A trigger starts the workflow (when a file is created, when an email arrives, on a schedule). Actions perform work or call external systems.

### The Connector Ecosystem

Logic Apps connectors integrate with external systems. There are over 400 pre-built connectors covering most common services:

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

**Built-in connectors** run directly in the Logic Apps runtime (single-tenant Standard tier or in a containerized Consumption). No licensing; included with the platform.

- HTTP (call any REST API)
- Batch (send messages to batch receiver)
- Request (receive inbound HTTP calls)
- Scheduled trigger (cron-like scheduling)
- Workflow (call another Logic App or Durable Function)

**Managed connectors** run in the shared Microsoft cloud and communicate back to your Logic App. These require connector licenses in some cases (especially for premium connectors like Salesforce, Oracle, Jira Cloud).

**Cost implications:**
- Built-in connectors cost nothing (included in tier pricing)
- Managed connectors: free for most (Outlook, SharePoint, Blob Storage), premium pricing for others (Salesforce, Jira Cloud)
- Standard tier can use custom connectors running in containers on your compute

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
| **SaaS integration** | 400+ pre-built | Manual HTTP calls or libraries |
| **Execution cost** | Per-action pricing (can be expensive at scale) | Per-function execution (cheaper for high throughput) |
| **Customization** | Limited to connector capabilities | Full programming language control |
| **Testing** | Unit testing available but basic | Full unit test framework support |
| **Versioning** | Version control for JSON definition | Version control for code |
| **Learning curve** | Low for simple workflows | Higher (requires coding) |

---

## Durable Functions: Orchestration Patterns

Durable Functions extends Azure Functions to add orchestration capabilities. An orchestrator function directs the execution of activity functions and waits for their completion without blocking compute resources.

### Core Concepts

**Orchestrator functions** are the conductors. They specify which activity functions to call, in what order, in parallel, or in more complex patterns. The orchestrator function is replayed multiple times during execution; you write it as if it runs once, but the Durable Functions framework handles the replay.

**Activity functions** are the workers. They do the actual work: call an API, update a database, send a message. Activity functions cannot call other activity functions directly; only orchestrators can coordinate them.

**Entity functions** maintain state across orchestrator invocations. They act like durable, distributed dictionaries, allowing you to store and query workflow state without explicit state management.

**Durable timers** allow workflows to wait for specific times or durations without consuming function compute. They are perfectly suited for long-running workflows.

### Durable Functions Patterns

#### Pattern 1: Function Chaining

Orchestrator calls activity functions sequentially, passing outputs from one to the next.

```csharp
[FunctionName("OrderProcessingOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] IDurableOrchestrationContext context)
{
    var orderId = context.GetInput<string>();

    // Call activities in sequence
    var validationResult = await context.CallActivityAsync("ValidateOrder", orderId);
    var paymentResult = await context.CallActivityAsync("ProcessPayment", validationResult);
    var shippingResult = await context.CallActivityAsync("ArrangeShipping", paymentResult);

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
        context.CallActivityAsync("FetchDepartmentReport", deptId)
    ).ToList();

    // Wait for all to complete
    var results = await Task.WhenAll(tasks);

    // Aggregate results
    await context.CallActivityAsync("AggregateReports", results);
}
```

**Use case:** Gathering data from multiple systems in parallel (reporting, data aggregation, batch processing).

#### Pattern 3: Async HTTP APIs

Durable Functions can expose HTTP endpoints that start long-running workflows and allow clients to poll or wait for completion.

```csharp
[FunctionName("StartLongRunningWorkflow")]
public static async Task<IActionResult> HttpStart(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestMessage req,
    [DurableClient] IDurableOrchestrationClient client,
    ILogger log)
{
    string input = await req.Content.ReadAsAsync<string>();

    string instanceId = await client.StartNewAsync("MyOrchestrator", input);

    return client.CreateCheckStatusResponse(req, instanceId);
}
```

The client receives a response with URLs to check status, poll for results, or terminate the workflow.

**Use case:** Long-running batch processing, report generation, data export that clients wait for.

#### Pattern 4: Monitoring and Human Interaction

Orchestrators can wait for human approval or external events before continuing.

```csharp
[FunctionName("ApprovalWorkflowOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] IDurableOrchestrationContext context)
{
    var request = context.GetInput<PurchaseRequest>();

    // Submit for approval
    await context.CallActivityAsync("RequestApproval", request);

    // Wait for approval or 24-hour timeout
    var approvalResult = await context.WaitForExternalEvent<bool>(
        "ApprovalReceived",
        context.CreateTimer(context.CurrentUtcDateTime.AddHours(24), CancellationToken.None)
    );

    if (approvalResult)
    {
        await context.CallActivityAsync("ProcessRequest", request);
    }
    else
    {
        await context.CallActivityAsync("RejectRequest", request);
    }
}
```

**Use case:** Approval workflows, manual intervention steps, monitoring that requires human decision-making.

#### Pattern 5: Compensation (Saga Pattern)

Orchestrator calls activity functions that can roll back if a later step fails.

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

**Use case:** Transactions that span multiple services without distributed transactions; compensation handles failure.

### State Management in Durable Functions

The orchestrator's state is stored in the Durable Task Framework (backed by Azure Table Storage or SQL Database). Between activity calls, the orchestrator function is unloaded from memory. When an activity completes, the orchestrator is replayed from the beginning, but the Durable Functions framework ensures it executes deterministically and skips replayed activities.

This replay model means **orchestrator functions must be deterministic:** no random values, no reading current time (use `context.CurrentUtcDateTime` instead), no branching on non-deterministic conditions.

### Entity Functions for Distributed State

Entity functions maintain state without explicit state management code. They act like stateful objects:

```csharp
[FunctionName("CounterEntity")]
public static void Counter(
    [EntityFunctionInput] IDurableEntityContext ctx)
{
    var currentValue = ctx.State<int>();

    switch (ctx.OperationName.ToLowerInvariant())
    {
        case "add":
            currentValue += ctx.GetInput<int>();
            break;
        case "subtract":
            currentValue -= ctx.GetInput<int>();
            break;
        case "get":
            ctx.SetResult(currentValue);
            break;
    }

    ctx.SetState(currentValue);
}
```

Orchestrators call entity functions to read and update state:

```csharp
var entityId = new EntityId("Counter", "counter-1");
await context.CallEntityAsync(entityId, "add", 5);
var value = await context.CallEntityAsync<int>(entityId, "get");
```

**Use case:** Tracking workflow state, distributed counters, multi-tenant resource limits, status aggregation.

---

## Decision Framework: Logic Apps vs Durable Functions

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

- Execute immediately, state not persisted
- No history after completion
- Cannot resume; failures require restart from beginning
- Lower latency and storage cost
- Best for: Synchronous transformations, webhooks, request-response patterns

---

## Error Handling and Retry Policies

Both Logic Apps and Durable Functions provide built-in error handling and retry capabilities.

### Logic Apps Error Handling

**Scopes and error handling:**
- Wrap actions in a scope to apply retry and error handling policies
- Configure retry policies (exponential backoff, immediate, fixed interval)
- Define error actions (run actions when the scope fails)

**Timeout settings:**
- Workflow timeout: default 30 days
- Action timeout: default 1 hour
- Trigger timeout: varies by trigger type

### Durable Functions Error Handling

**Automatic retries:**
- Configure retry policies on `CallActivityAsync` calls
- Retry options include exponential backoff and max retries
- Default behavior: fail immediately on activity failure

**Exception handling:**
- Use try-catch blocks in orchestrators
- Implement compensation in catch blocks
- Use `TimeoutException` for timeout handling

**Timeout handling:**
- Durable timers fire after specified duration
- Can race a timer against an activity using `Task.WhenAny`
- Configure activity timeout policies independently

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

**Result:** Action costs explode. A workflow with 10 actions processing 10,000 items per day costs 100,000 actions per day. Consumption pricing makes this prohibitively expensive.

**Solution:** For high-volume orchestration, use Durable Functions or Logic Apps Standard tier. Calculate action cost upfront: (actions per workflow) × (estimated daily volume) × (cost per action).

---

### Pitfall 2: Non-Deterministic Orchestrator Functions

**Problem:** Writing orchestrator functions that use `DateTime.UtcNow`, `Random`, or branching on non-deterministic values.

**Result:** Orchestrators fail to replay correctly. State becomes inconsistent. Workflow hangs or behaves unexpectedly.

**Solution:** Always use `context.CurrentUtcDateTime` instead of `DateTime.UtcNow`. Avoid random numbers. Keep orchestrators deterministic.

---

### Pitfall 3: Orchestrator Functions Calling Activity Functions Directly

**Problem:** Activity functions calling other activity functions instead of going through the orchestrator.

**Result:** Retry policies don't apply. Fault tolerance is lost. The activity fails and brings down the entire workflow without proper error handling.

**Solution:** Only orchestrators can call activity functions. Orchestrators coordinate the execution of activities.

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

### Pitfall 6: Forgetting Scaling Limits

**Problem:** Not understanding the throughput limits of Logic Apps Consumption tier (default 1,000 concurrent executions per region per subscription).

**Result:** Workflows start throttling at peak times. Executions queue up and fail if they exceed the queue depth.

**Solution:** Monitor concurrent executions. Scale to Standard tier if consistently approaching limits. Request quota increases for sustained high throughput.

---

## Key Takeaways

1. **Logic Apps and Durable Functions solve the same problem from opposite directions.** Logic Apps favors low-code visual composition with pre-built connectors; Durable Functions favors code-first control for complex orchestration.

2. **Choose Logic Apps for SaaS integration and quick wins.** 400+ connectors eliminate custom integration code. Approval actions and notifications are built-in. Non-technical stakeholders can understand workflows.

3. **Choose Durable Functions for complex orchestration and high throughput.** Full programming language control, better unit test support, lower per-execution cost at scale, and no artificial action limits.

4. **Understand the cost model before building.** Logic Apps Consumption charges per action. Durable Functions charges per function execution. At high volumes, Durable Functions is cheaper. At low volumes, Logic Apps is simpler.

5. **Combine both for maximum benefit.** Use Logic Apps as the front-end for SaaS integration. Call Durable Functions for orchestration-heavy steps. Use Durable Functions as the core orchestrator with Logic Apps for connector-specific tasks.

6. **Logic Apps Standard and Durable Functions offer different trade-offs than Consumption.** Standard provides dedicated capacity, custom connectors, and lower latency. Durable Functions offer cost-effective orchestration for any throughput.

7. **Keep orchestrators deterministic.** Don't use random numbers or real-time clocks in Durable Functions orchestrators. Use `context.CurrentUtcDateTime` and deterministic conditionals.

8. **Always pair external event waits with timeouts.** Approval workflows waiting indefinitely hang forever. Use durable timers to race against external events.

9. **Monitor action costs and throughput limits early.** Logic Apps Consumption has scaling limits and per-action costs that surprise teams at volume. Standard tier and Durable Functions scale differently.

10. **Integration complexity often drives the decision more than orchestration logic.** If your workflow is 80% calling external systems (SaaS, services), Logic Apps is likely the right choice. If it's 80% complex conditional logic and coordination, Durable Functions is the right choice.
