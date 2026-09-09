---
title: "Serverless Architecture Patterns on Azure"
layout: guide
category: Azure
subcategory: Serverless Architecture
description: "Cross-service serverless composition patterns using Azure Functions, Logic Apps, Event Grid, API Management, and Cosmos DB serverless for event-driven and workflow-based architectures"
tags: [serverless, azure-functions, durable-functions, event-grid, logic-apps, cosmos-db, practical]
---

## What Is Serverless on Azure

Serverless on Azure is not a single product but an ecosystem of services that eliminate infrastructure management while scaling automatically based on demand. The core services include [Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview){:target="_blank" rel="noopener noreferrer"} for event-driven code execution, [Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview){:target="_blank" rel="noopener noreferrer"} for workflow orchestration, [Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/overview){:target="_blank" rel="noopener noreferrer"} for event routing, [API Management](https://learn.microsoft.com/en-us/azure/api-management/api-management-key-concepts){:target="_blank" rel="noopener noreferrer"} for API governance, and [Cosmos DB serverless](https://learn.microsoft.com/en-us/azure/cosmos-db/serverless){:target="_blank" rel="noopener noreferrer"} for pay-per-operation database workloads.

These services compose into patterns that handle event-driven architectures, data processing pipelines, web application backends, and integration workflows without managing servers, containers, or cluster orchestrators.

### What Problems Serverless Solves

**Without serverless:**
- Infrastructure provisioning and capacity planning required upfront
- Paying for idle capacity during low-traffic periods
- Managing operating system patches, runtime updates, and security hardening
- Manual scaling configuration and testing for traffic spikes
- Operational overhead of monitoring, logging, and deployment pipelines for infrastructure

**With serverless:**
- Zero infrastructure management; the platform handles provisioning, patching, and scaling
- Consumption-based pricing aligned with actual usage
- Automatic scaling from zero to thousands of concurrent executions
- Built-in integration with Azure services through triggers and bindings
- Faster development cycles with less operational burden

### How Azure Serverless Differs from AWS

Architects familiar with AWS serverless services should note the following differences:

| Concept | AWS | Azure |
|---------|-----|-------|
| **Function runtime** | Lambda (fixed runtime versions) | Azure Functions (five hosting options, each with its own scaling and networking behavior) |
| **Event routing** | EventBridge for custom events | Event Grid for pub-sub routing, Service Bus for messaging |
| **Orchestration** | Step Functions (code-based state machines) | Durable Functions (code-based), Logic Apps (visual designer, connector-rich) |
| **API gateway** | API Gateway (pay per request) | API Management (eight tiers, heavier feature set, including a pay-per-request Consumption tier) |
| **Serverless database** | DynamoDB (capacity mode set per table) | Cosmos DB serverless (account type fixed at creation; provisioned throughput is the alternative) |
| **Function deployment** | Zip upload, container images | Zip deployment, container images, run-from-package |
| **Cold start mitigation** | Provisioned Concurrency | Always-ready instances (Flex Consumption, Premium), or always-on for Dedicated |
| **Function duration limits** | 15 minutes (Lambda) | 30-minute default and no enforced maximum on every plan except legacy Consumption, which defaults to 5 minutes and caps at 10 |

One Azure-specific trap has no AWS equivalent. Regardless of the plan's timeout setting, an HTTP-triggered function has 230 seconds to respond before the platform load balancer closes the connection. Long HTTP work has to return immediately and report progress out of band.

---

## Azure Serverless Building Blocks

### Azure Functions

[Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview){:target="_blank" rel="noopener noreferrer"} is the core compute service for serverless workloads. A function executes code in response to events like HTTP requests, queue messages, blob uploads, database changes, or timers.

**Function hosting plans.** The hosting option is chosen per function app and determines scaling behavior, networking capability, and cold start exposure. There are five:

| Plan | Use Case | Scaling | Virtual Network | Cost Model |
|------|----------|---------|-----------------|------------|
| **Flex Consumption** | The default for new serverless apps | Per-function scaling, to zero, up to 1,000 instances | Outbound integration and inbound private endpoints | Executions + memory while executing, plus any always-ready instances |
| **Premium** | Continuous or near-continuous load, larger instances | Event-driven, prewarmed workers | Outbound integration and inbound private endpoints | Core-seconds and memory across active and prewarmed instances |
| **Dedicated (App Service)** | Reusing existing App Service capacity, predictable billing | Manual or autoscale | Yes (plus App Service Environment isolation) | App Service plan rates |
| **Container Apps** | Function apps packaged as containers alongside other microservices | Event-driven, to zero if minimum replicas is 0 | Through the Container Apps environment | Container Apps billing |
| **Consumption** (legacy) | Windows-only dependencies, v1 runtime, full .NET Framework | Event-driven, to zero | **None** | Executions, execution time, and memory |

Two facts about that table drive most design decisions:

- **Flex Consumption, not Consumption, is the current serverless plan.** Microsoft labels Consumption legacy and directs new serverless apps to Flex Consumption. Hosting function apps on Linux in a Consumption plan retires on 30 September 2028, and apps still on the end-of-life v3 runtime on Linux Consumption stop running after 30 September 2026.
- **Virtual network integration is not a premium-tier feature.** Classic Consumption is the only plan without it. The widespread belief that reaching a private endpoint requires the Premium plan is a holdover from before Flex Consumption existed.

Flex Consumption also scales per function rather than per app. Every trigger type in the app scales on its own instances, apart from HTTP, Event Grid-based blob, and Durable triggers, each of which scales as a group.

**Triggers and bindings** eliminate boilerplate for integrating with Azure services. A trigger invokes the function, and bindings read or write data without explicit SDK calls.

**Common triggers:**
- HTTP (for APIs and webhooks)
- Timer (for scheduled jobs)
- Queue (Service Bus, Storage Queue)
- Blob (Storage account file uploads)
- Cosmos DB change feed (for reacting to database writes)
- Event Grid (for pub-sub event routing)

**Common bindings:**
- Cosmos DB (read/write documents)
- Blob Storage (read/write files)
- Queue (send messages)
- SignalR (push real-time messages to web clients)

Functions support C#, JavaScript, TypeScript, Python, Java, and PowerShell natively, Go in preview on Flex Consumption only, and any language that can serve HTTP through [custom handlers](https://learn.microsoft.com/en-us/azure/azure-functions/functions-custom-handlers){:target="_blank" rel="noopener noreferrer"}.

**For C#, write isolated worker functions.** Support for the in-process model ends on 10 November 2026. Isolated worker code uses the `[Function]` attribute and `Microsoft.Azure.Functions.Worker.Extensions.*` packages; in-process code uses `[FunctionName]` and `Microsoft.Azure.WebJobs.Extensions.*`. Samples written against the in-process model, still the majority of what is published online, will not carry forward.

---

### Logic Apps

[Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview){:target="_blank" rel="noopener noreferrer"} provides declarative workflow orchestration with a visual designer and hundreds of pre-built connectors for SaaS and enterprise systems. Logic Apps excel at integration scenarios where you need to connect disparate systems without writing integration code.

**Logic Apps resource types:**

| Resource type | Use Case | Hosting | Cost Model |
|--------|----------|---------|------------|
| **Consumption** | One workflow per resource, low to medium volume | Multitenant Azure Logic Apps | Per action execution, plus a separate charge per managed-connector call |
| **Standard** | Multiple workflows per resource, VNet access, more built-in connectors | Single-tenant, or App Service Environment v3 (Windows plans only) | Workflow Service Plan tier, plus storage transactions for stateful workflows |
| **Standard (hybrid)** | Partially connected environments needing local processing or storage | Your own infrastructure, via an Azure Container Apps extension | Hybrid pricing |

The Consumption billing model is the one that surprises people. An action that calls a managed connector is billed twice, once as an action execution and once as a connector call. A workflow that loops over a few hundred rows and touches SharePoint on each iteration costs far more than the action count suggests.

**Common connectors:**
- Microsoft 365, Dynamics 365, SharePoint
- Salesforce, ServiceNow, SAP
- SQL Server, Cosmos DB, Azure Storage
- HTTP, SFTP, FTP
- Custom APIs via HTTP or API Management

**When to use Logic Apps over Functions:**
- Workflow is primarily integration glue between systems with existing connectors
- Business users or citizen developers need to maintain workflows visually
- Approval workflows, human-in-the-loop processes
- Complex branching, retry logic, or long-running stateful workflows without writing orchestration code

**When Functions are better:**
- Performance-critical paths requiring low latency
- Complex business logic requiring algorithmic code
- Custom protocols or data transformations not covered by connectors

---

### Event Grid

[Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/overview){:target="_blank" rel="noopener noreferrer"} is a fully managed event routing service that delivers events from publishers to subscribers using pub-sub semantics. It carries events over HTTP and also runs an MQTT v3.1.1 and v5.0 broker for device messaging.

**Event sources (publishers):**
- Azure services (Storage, Event Hubs, IoT Hub, Service Bus, Azure resources)
- Custom applications via HTTP POST
- Partner SaaS systems, through partner topics

**Event handlers (subscribers):** Azure Functions, Logic Apps, Event Hubs, Service Bus queues and topics, Storage queues, webhooks, and Azure Automation runbooks. The supported handler list differs between namespace topics and the classic custom, system, domain, and partner topics, so check the one you are using before designing around a destination.

**Push and pull delivery are architecturally different, not just configuration.** Push delivery is what most Event Grid material describes. You name a destination on the subscription and Event Grid calls it. Pull delivery inverts the direction, so the consumer connects to Event Grid and reads events on its own schedule, and it is available only on topics in an Event Grid namespace.

```
Push delivery (classic and namespace topics)

  Publisher → Event Grid topic → subscription → calls → Function / webhook / Event Hub
                                                          (destination must be reachable)

Pull delivery (namespace topics only)

  Publisher → Event Grid namespace topic → event subscription (queue)
                                                    ↑
                                            reads / acknowledges / releases
                                                    |
                                            Consumer app (can sit behind a private link)
```

A consumer that can't expose an endpoint, or that needs to stop consuming during an outage without losing events, needs pull delivery. Private endpoints for event *consumption* also exist only on the pull path.

**Event Grid vs Service Bus:**

| Aspect | Event Grid | Service Bus |
|--------|-----------|-------------|
| **Pattern** | Pub-sub (reactive events) | Message queue/broker (commands, state transfer) |
| **Delivery** | At-least-once, explicitly unordered | At-least-once, FIFO within a session |
| **Retry** | Exponential backoff; defaults are 30 attempts and a 1,440-minute TTL, whichever expires first | Configurable delivery count, then dead-letter |
| **Dead-letter target** | A blob container in a storage account, never a queue | The entity's own dead-letter subqueue |
| **Filtering** | Advanced filtering on event schema | Subscription filters |
| **Use case** | Notify subscribers about state changes | Reliable messaging, commands, workflows |

Use Event Grid for lightweight event notifications where subscribers react to events. Use Service Bus for transactional messaging where message order and guaranteed delivery to a single consumer matter.

Dead-lettering is off by default, and when it is off, events that exhaust their retries are dropped silently. And an Azure Function subscribed to Event Grid must use the **Event Grid trigger**. Event Grid performs a handshake to validate the endpoint, and a plain HTTP-triggered function fails it, which Event Grid reports as `InvalidAzureFunctionDestination`.

---

### API Management

[API Management](https://learn.microsoft.com/en-us/azure/api-management/api-management-key-concepts){:target="_blank" rel="noopener noreferrer"} (APIM) is a full-featured API gateway that provides security, throttling, caching, transformation, and developer portal capabilities. It fronts backend APIs built with Functions, Logic Apps, containers, or VMs.

**APIM tiers.** There are eight, in two generations. The classic tiers and the v2 tiers are separate SKUs rather than upgrades of one another. For serverless work the relevant distinctions are billing shape and network reach:

| Tier | Use Case | Cost Model | Virtual Network |
|------|----------|------------|-----------------|
| **Consumption** | Serverless, pay-per-request | Per million requests | None |
| **Developer** | Non-production, evaluation (no SLA) | Low fixed monthly | Injection into a VNet |
| **Basic / Standard** | Production, classic feature set | Fixed monthly | Inbound private endpoints only |
| **Basic v2 / Standard v2** | Production, faster to provision, workspaces | Fixed monthly | Standard v2 reaches VNet-isolated backends |
| **Premium** | Enterprise, multi-region, self-hosted gateway | High fixed monthly | Full injection, inbound and outbound |
| **Premium v2** | Enterprise, availability zones, single region | High fixed monthly | Full injection, inbound and outbound |

Check two capabilities before committing to a tier. Multi-region deployment and the self-hosted gateway are Premium (classic) only, and neither is available on Premium v2.

**Core capabilities:**
- Authentication and authorization (OAuth 2.0, JWT validation, API keys)
- Rate limiting and quotas per subscription/user
- Response caching to reduce backend load
- Request/response transformation (XML ↔ JSON, header manipulation)
- API versioning and revisions
- Developer portal for API consumers
- Observability (Application Insights, Azure Monitor)

**Why use APIM with Functions:**
- Centralized authentication and rate limiting across multiple backend Functions
- Caching responses to reduce Function invocations and cost
- API versioning without redeploying Functions
- Developer portal for external or internal API consumers
- Unified policy management across APIs

---

### Cosmos DB Serverless

[Cosmos DB serverless](https://learn.microsoft.com/en-us/azure/cosmos-db/serverless){:target="_blank" rel="noopener noreferrer"} provides consumption-based billing for Cosmos DB where you pay per request unit (RU) consumed and storage used, without provisioning throughput upfront.

**Serverless is an account type, not a per-container mode.** You choose it when you create the account, every container in that account is serverless, and you cannot switch an existing account between the two. The scope consequence that catches teams out is regional. A serverless account runs in exactly one Azure region, and regions cannot be added later. Any design that later needs multi-region reads or writes needs a provisioned-throughput account and a data migration, not a setting change.

**Serverless vs provisioned throughput:**

| Aspect | Serverless | Provisioned Throughput |
|--------|-----------|----------------------|
| **Billing** | Per RU consumed + storage | Hourly for provisioned RU/s + storage |
| **Best for** | Bursty, hard-to-forecast traffic with long idle periods | Consistent, predictable throughput needs |
| **Throughput** | Each physical partition serves up to 5,000 RU/s; a container starts with one | Up to 1,000,000 RU/s per container by default, raisable by support request |
| **Regions** | 1, fixed at account creation | Any number, added and removed at will |
| **Storage** | Unlimited per container; 20 GB per logical partition | Unlimited per container; 20 GB per logical partition |

The throughput row is the one most often misremembered. Serverless is not capped at 5,000 RU/s per container. That figure is the ceiling for a single physical partition, and a container's ceiling is 5,000 RU/s multiplied by however many physical partitions it has grown. What this means in practice is that a serverless container with a poorly distributed partition key stalls at 5,000 RU/s no matter how much data it holds, while a well-distributed one keeps climbing. The limit rewards partition design, not capacity planning.

Serverless fits sporadic traffic, development and test environments, and a low average-to-peak ratio, which Microsoft puts at below roughly 10 percent.

---

### Choosing Between the Building Blocks

Given a piece of work, which service runs it?

```
Is the work a workflow with multiple steps that must survive restarts?
├─ No → Is it triggered by an event or a request?
│        ├─ Request, and it needs a gateway (auth, rate limits, caching)
│        │     → API Management in front of Functions
│        ├─ Event, short-lived, one unit of work
│        │     → Azure Functions (Flex Consumption)
│        └─ Long-lived process, custom runtime, or persistent connections
│              → Container Apps (optionally hosting the function app)
│
└─ Yes → Who maintains the workflow?
         ├─ Developers, and the logic is algorithmic (loops, branching, retries)
         │     → Durable Functions
         ├─ Integration specialists, and the systems have prebuilt connectors
         │     → Logic Apps
         └─ Both, split by boundary
               → Logic Apps for the connector-heavy edges,
                 Functions called from it for the algorithmic core
```

And for the plumbing between them: **Event Grid** when publishers announce state changes and any number of subscribers may care, **Service Bus** when a specific consumer must process each message exactly once and in order, and **Event Hubs** when the volume is a stream rather than discrete messages.

---

## Event-Driven Architecture Patterns

### Pattern 1: Fan-Out/Fan-In with Event Grid and Functions

**Use case:** A single event triggers multiple independent workflows that process in parallel, and results are aggregated once all workflows complete.

```
Event Source (Blob Upload)
   ↓
Event Grid (publishes event)
   ├→ Function A (extract text)
   ├→ Function B (generate thumbnail)
   ├→ Function C (virus scan)
   └→ (all write results to Cosmos DB)
      ↓
Cosmos DB Change Feed → Aggregator Function
   ↓
Send notification when all tasks complete
```

**Components:**
- Event Grid topic subscribed by multiple Functions, each using the Event Grid trigger
- Each Function performs independent work in parallel
- Cosmos DB stores partial results with a document per task
- Aggregator Function triggered by Cosmos DB change feed checks completion status

**Trade-offs:**
- High parallelism improves latency for the overall workflow
- Each Function scales independently based on its workload
- Aggregation logic must handle partial completion and retries
- No built-in workflow state visibility without additional tooling

**When to use:**
- Multiple independent operations can run concurrently
- No dependencies between parallel tasks
- You need maximum throughput and parallelism

**When not to use it.** Because Event Grid delivery is unordered and at-least-once, every branch has to be idempotent, and the aggregator has to tolerate seeing the same partial result twice. If you need the fan-in itself to be reliable, meaning a single place that knows all three branches finished, that survives a host restart, and that can be queried, then Durable Functions implements fan-out/fan-in natively by awaiting a list of activity tasks, and you get the completion tracking for free instead of building it out of a change feed.

---

### Pattern 2: Event Sourcing with Cosmos DB and Functions

**Use case:** Capture all state changes as an immutable sequence of events, and build read models by replaying events.

```
Command API (Function)
   ↓
Write event → Cosmos DB (event store)
   ↓
Cosmos DB Change Feed
   ├→ Projection Function A (builds read model in Cosmos DB)
   ├→ Projection Function B (sends notification)
   └→ Projection Function C (updates analytics)
```

**Components:**
- Command Function validates and writes events to Cosmos DB
- Cosmos DB acts as the append-only event store
- Change feed triggers projection Functions to build read models
- Read models are stored in separate Cosmos DB containers or materialized views

**Trade-offs:**
- Full audit trail of all state changes
- Supports multiple independent read models from the same events
- Rebuilding read models from events enables schema evolution
- Complexity increases compared to CRUD architectures
- Eventual consistency between write and read models

**When to use:**
- Audit requirements demand full change history
- Multiple teams need different views of the same data
- You need to replay events to rebuild state or test changes

**Know which change feed mode you are getting.** Cosmos DB has two, and the default is not the one an event-sourcing reader might assume:

| | Latest version mode (default) | All versions and deletes mode |
|---|---|---|
| **Captures** | Inserts and updates | Inserts, updates, deletes, and TTL expirations |
| **Intermediate changes** | Only the newest version of an item is guaranteed | Every change, in modification order |
| **Starting point** | Beginning of container, a point in time, now, or a checkpoint | Now, or a checkpoint within the backup retention window |
| **Requires** | Nothing | Continuous backups, API for NoSQL, and no history of partition merges |

Append-only event sourcing works well on the default mode, because each event is a new item and there are no updates to miss. Every other pattern on this page that reacts to *changes to existing documents* has to reckon with two limits of the default mode. Deletes never appear at all, and if an item is written twice between two reads, the reader sees only the second write. The usual workaround for deletes is a soft-delete flag plus a TTL, which the feed then surfaces as an ordinary update.

---

### Pattern 3: CQRS with Serverless

**Use case:** Separate read and write responsibilities with different data models optimized for each.

```
  Command → Command API (Function) → Cosmos DB container: write model
                                              │  (normalized)
                                              ↓
                                     Cosmos DB change feed
                                              ↓
                                     Projection Function
                                              ↓
  Query   → Query API (Function) ←── Cosmos DB container: read model
                                                 (denormalized per query)
```

**Components:**
- Write Functions accept commands and write to a normalized data model
- Cosmos DB change feed propagates writes to projection Functions
- Projection Functions build denormalized read models optimized for query patterns
- Read Functions query the read model directly

**Trade-offs:**
- Read and write workloads scale independently
- Read model can be optimized for specific query patterns
- Eventual consistency between write and read models
- Operational complexity managing two data stores

**When to use:**
- Read workload significantly exceeds write workload
- Query patterns differ substantially from write patterns
- Writes require validation and business logic, but reads need fast, denormalized access

Two constraints follow from building the projection on the change feed. The projection Function has to be idempotent, because the change feed is at-least-once and a lease handover replays recent changes. And on the default change feed mode a document updated twice between two reads reaches the projection once, carrying only the second value. That is fine when the projection recomputes the read model from the current document, and wrong when it accumulates deltas.

---

## API-First Serverless Patterns

### Pattern 4: API Management Fronting Functions

**Use case:** Expose multiple backend Functions through a unified API gateway with centralized authentication, rate limiting, and caching.

```
Client
   ↓
API Management  ── policies: JWT validation, rate limit, cache
   ├→ /users    → Users Function
   ├→ /orders   → Orders Function
   └→ /products → Products Function
```

**Components:**
- API Management defines API contracts with OpenAPI specifications
- Backend Functions implement business logic
- APIM policies handle authentication (JWT validation), rate limiting, and response caching
- Developer portal provides API documentation and testing for consumers

**Policies to apply:**
- **Inbound:** Validate JWT tokens, enforce rate limits, transform requests
- **Backend:** Load balance across multiple Function instances (if needed)
- **Outbound:** Cache responses, transform responses (e.g., remove sensitive fields)
- **On-error:** Return standardized error responses

**Trade-offs:**
- Centralized API governance and security
- Reduced Function invocations through caching
- APIM is an extra network hop on every request; measure its contribution before promising a latency budget
- Consumption tier has per-request cost, and steady traffic eventually costs less on a fixed-price tier. Calculate the crossover rather than assuming it

**When to use:**
- Multiple Functions compose a single API surface
- Authentication, rate limiting, and caching requirements are consistent across endpoints
- External consumers need a developer portal

---

### Pattern 5: Backend for Frontend with Functions and APIM

**Use case:** Different client types (web, mobile, IoT) have different data needs. Create specialized BFF Functions for each client type behind APIM.

**Components:**
- APIM routes `/api/web`, `/api/mobile`, and `/api/iot` to three separate Functions over one Cosmos DB
- Each BFF Function tailors responses for its client type
- Web BFF returns rich data with full models
- Mobile BFF returns minimal data to reduce bandwidth
- IoT BFF batches telemetry writes

**Trade-offs:**
- Each client gets optimized responses without over-fetching
- BFF Functions can evolve independently per client
- More Functions to maintain and deploy
- Risk of duplicating business logic across BFFs

**When to use:**
- Client types have significantly different data or interaction patterns
- You need to optimize payload size for mobile or IoT clients
- Teams are organized by client platform

---

## Workflow Orchestration Patterns

### Pattern 6: Durable Functions for Code-Based Orchestration

**Use case:** Coordinate multiple Function calls with branching, retries, and human approval steps using code instead of a visual designer.

```csharp
[Function("OrderWorkflow")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] TaskOrchestrationContext context, string orderId)
{
    // Step 1: Validate order
    bool isValid = await context.CallActivityAsync<bool>("ValidateOrder", orderId);
    if (!isValid) return;

    // Step 2: Charge payment
    await context.CallActivityAsync("ChargePayment", orderId);

    // Step 3: Wait for human approval, but never indefinitely
    if (await context.CallActivityAsync<bool>("RequiresApproval", orderId))
    {
        using var timeoutCts = new CancellationTokenSource();
        Task timeoutTask = context.CreateTimer(
            context.CurrentUtcDateTime.AddHours(24), timeoutCts.Token);
        Task<bool> approvalTask = context.WaitForExternalEvent<bool>("ApprovalReceived");

        if (await Task.WhenAny(approvalTask, timeoutTask) != approvalTask)
        {
            await context.CallActivityAsync("EscalateOrder", orderId);
            return;
        }

        // Approval arrived first, so cancel the timer to let the orchestration complete
        timeoutCts.Cancel();
        if (!approvalTask.Result) return;
    }

    // Step 4: Ship order
    await context.CallActivityAsync("ShipOrder", orderId);
}
```

**Components:**
- Orchestrator Function defines the workflow as code
- Activity Functions perform individual steps
- Durable Functions runtime manages state persistence and checkpointing
- External events enable human-in-the-loop workflows

Three details in that sample are load-bearing. The orchestrator uses the **isolated worker** API of `[Function]` and `TaskOrchestrationContext`, because the in-process model (`[FunctionName]` and `IDurableOrchestrationContext`) loses support on 10 November 2026. The external event is **raced against a durable timer** rather than awaited on its own, because `WaitForExternalEvent` with no competing timer waits forever and an orchestration that nobody approves never terminates. And the timer is **cancelled on the winning path**, because an uncancelled durable timer keeps the orchestration alive until it fires, however long that is.

Orchestrator code must also be deterministic, since the runtime rebuilds state by replaying it. Read the clock through `context.CurrentUtcDateTime` rather than `DateTime.UtcNow`, don't generate random values or GUIDs inline, and do all I/O inside activity functions.

**Trade-offs:**
- Full programming language expressiveness for complex workflows
- Built-in retry policies and error handling
- State persistence allows orchestrations to run for days or weeks
- Debugging is harder than imperative code (relies on replay mechanism)

**When to use:**
- Workflow logic requires algorithmic decisions, loops, or complex branching
- Developers prefer code over visual designers
- Workflow needs to wait for external events or timeouts

---

### Pattern 7: Logic Apps for Integration Workflows

**Use case:** Connect multiple SaaS systems with minimal code using pre-built connectors and a visual designer.

In a representative workflow, a Dynamics 365 trigger fires when an opportunity is created, a condition tests the deal value against a threshold, and the branch above the threshold sends an email through Office 365, creates a SharePoint record, and posts to a Teams channel. Every step is a connector operation; none of it is code.

**Components:**
- Logic App workflow with visual designer
- Connectors for Dynamics 365, Office 365, SharePoint, Teams
- Conditional logic and loops configured visually
- Managed connectors handle authentication and API details

**Trade-offs:**
- Rapid development for integration scenarios with existing connectors
- No code required for common integration patterns
- Limited expressiveness for complex algorithmic logic
- Connector costs can add up for high-volume workflows

**When to use:**
- Workflow is primarily integration between SaaS systems
- Pre-built connectors exist for all systems involved
- Business users or low-code developers maintain the workflow

---

### Durable Functions vs Logic Apps

| Aspect | Durable Functions | Logic Apps |
|--------|------------------|------------|
| **Development model** | Code (C#, JavaScript, Python, etc.) | Visual designer + JSON |
| **Best for** | Complex logic, algorithms, retries | System integration, pre-built connectors |
| **State management** | Built-in durable storage | Built-in with checkpoints |
| **Debugging** | Code debugging tools | Run history, visual replay |
| **Cost model** | Consumption (per execution) | Per action execution |
| **Expressiveness** | Full programming language | Declarative with limited logic |
| **Learning curve** | Requires programming skills | Low-code, accessible to non-developers |

---

## Data Processing Pipeline Patterns

### Pattern 8: Event Hubs to Functions to Cosmos DB

**Use case:** Ingest high-volume telemetry streams, process events, and store results for querying.

**Components:**
- Event Hubs captures high-throughput event streams from devices or applications
- Function with Event Hubs trigger processes events in batches, parsing and enriching them
- Cosmos DB output binding stores processed data, partitioned for scale
- Change feed enables downstream processing or analytics; a query Function or Power BI reads the results

**Trade-offs:**
- Event Hubs absorbs stream-scale ingestion that a queue would choke on
- Function scaling tracks the Event Hubs partition count, so partitions cap parallelism
- Cosmos DB provides low-latency reads for processed data
- Event Hubs retention is tier-bound: 1 day on Basic, 7 days on Standard, 90 days on Premium and Dedicated. Use Capture to archive to Blob Storage or Data Lake beyond that, billed separately on Standard and included above it
- Partition count is fixed at creation on Basic and Standard (32 maximum); only Premium and Dedicated scale partitions out after the fact

**When to use:**
- High-volume telemetry or log ingestion
- Near real-time processing with low latency
- Downstream systems query processed data frequently

---

### Pattern 9: Blob Trigger for Batch Processing

**Use case:** Process files uploaded to Blob Storage, such as CSV imports, image transformations, or video encoding.

**There are two blob triggers, and the default one is the slow one.** The `source` property on the trigger selects between them:

| | `LogsAndContainerScan` (default) | `EventGrid` |
|---|---|---|
| **How it detects blobs** | Polls storage logs and periodically scans the container | Event Grid pushes a `BlobCreated` event |
| **Latency** | Up to 10 minutes on a Consumption plan that has gone idle | Near-instant |
| **Reliability** | Storage logs are best-effort; events can be missed | Event Grid's retry and dead-letter policy applies |
| **Availability** | Not supported on Flex Consumption | The only blob trigger Flex Consumption supports |

Microsoft recommends the Event Grid implementation, and on Flex Consumption it is the only one available. Reach for the polling trigger only when you are on a legacy Consumption or Dedicated plan and cannot add an Event Grid subscription.

**Components:**
- Blob Storage with containers for input and output
- Function with a Blob trigger listens for new blobs
- Processing logic transforms or validates data
- Output binding writes results to Blob or Cosmos DB

**Trade-offs:**
- Large files load into memory more than once during processing, so bind to `Stream` or `BlobClient` rather than `string` or `byte[]`, and check the per-instance memory limit of your plan
- Blob receipts prevent the same blob version from being processed twice; forcing a reprocess means deleting the receipt from the `azure-webjobs-hosts` container
- A blob that fails five times lands on the `webjobs-blobtrigger-poison` storage queue rather than being retried forever
- Blob Storage provides cheap, durable storage for files

**When to use:**
- File-based batch processing
- Files are uploaded infrequently or in batches

---

## Serverless Web Application Patterns

### Pattern 10: Static Web Apps with Functions Backend

**Use case:** Host a single-page application (SPA) with a serverless API backend.

**Components:**
- [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/overview){:target="_blank" rel="noopener noreferrer"} deploys the SPA to a globally distributed edge
- Backend Functions are integrated automatically as `/api/*` routes and share the frontend's authentication
- Two preconfigured authentication providers, GitHub and Microsoft Entra ID, requiring no configuration. X (formerly Twitter) was dropped from the preconfigured set after an API policy change, and anything beyond those two means registering a custom provider, which disables all preconfigured providers at once
- GitHub Actions or Azure DevOps CI/CD integration

**Trade-offs:**
- Simplified deployment for SPA + API backends
- CDN distribution reduces latency for global users
- Integrated authentication eliminates custom auth code
- Limited to Static Web Apps feature set; less flexibility than separate hosting

**When to use:**
- Building a SPA with a lightweight API backend
- Need global CDN distribution for frontend assets
- Authentication requirements fit built-in providers

---

### Pattern 11: Full Serverless Web App with Cosmos DB

**Use case:** Complete web application with frontend, API, and database entirely serverless.

**Components:**
- Static Web Apps for frontend with CDN distribution
- APIM provides API gateway with authentication and rate limiting
- Functions implement REST API endpoints
- Cosmos DB serverless stores application data

**Trade-offs:**
- Zero infrastructure to manage
- Automatic scaling for all components
- Cost scales with usage
- Cold starts may affect latency for infrequent access
- The serverless Cosmos DB account is single-region, which caps the whole stack's availability story no matter how the front end is distributed

**When to use:**
- Unpredictable or spiky traffic patterns
- Application workload fits within serverless limits
- Want to minimize operational overhead

---

## Hybrid Serverless Patterns

### Pattern 12: Serverless with Containers

**Use case:** Combine serverless Functions for event handling with containerized services for long-running or stateful workloads.

**Components:**
- Functions, triggered by Event Grid, handle events and lightweight tasks
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/overview){:target="_blank" rel="noopener noreferrer"} run stateful or long-running services, called over HTTP from the event handlers
- Container Apps scale to zero when minimum replicas is 0, and stop cold-starting when it is 1 or more
- Shared Cosmos DB for data persistence

**Trade-offs:**
- Containers provide full control over runtime and dependencies
- Container Apps support long-running processes and persistent connections
- Functions are better for short-lived, event-driven tasks
- More complex deployment than pure serverless

There is a third option between these two that the split above obscures: Container Apps is itself one of the five Azure Functions hosting options. If the reason for reaching for containers is a custom runtime, a native dependency, or GPU compute rather than a genuinely different programming model, host the function app *on* Container Apps and keep the Functions triggers and bindings instead of writing a separate service.

**When to use:**
- Workload mixes event-driven tasks with long-running services
- Need full control over containerized dependencies
- Stateful services (e.g., WebSocket servers) alongside event handlers

---

### Pattern 13: Serverless with VMs for Legacy Systems

**Use case:** Modernize incrementally by adding serverless event handlers while keeping legacy VMs.

**Components:**
- Functions provide modern API endpoints
- Functions communicate with legacy VM services via HTTP or Service Bus
- VMs remain for workloads that cannot be refactored yet
- Virtual network integration lets Functions reach private VMs, and on-premises databases follow over VPN or ExpressRoute. This works on Flex Consumption, Premium, Dedicated, and Container Apps, and only the legacy Consumption plan is excluded

**Trade-offs:**
- Incremental modernization without rewriting everything
- Functions add value (event handling, API gateway) immediately
- VMs still require operational overhead
- Network complexity for VNet integration

**When to use:**
- Legacy systems cannot be refactored quickly
- Want to add event-driven capabilities to existing architecture
- Hybrid cloud with on-premises dependencies

---

## Cold Start Mitigation Strategies

When a function app scales to zero, the next request pays for scaling back from zero to one. That added latency is the cold start. It matters for synchronous work like an HTTP-triggered API, and is largely invisible for queue or timer work, where a few extra seconds change nothing.

Microsoft does not publish cold start durations, and any specific figure you find is someone's benchmark of one app on one runtime rather than a platform guarantee. Treat cold start as a property to *measure* for your own app and *design around*, not a number to look up.

### Azure Functions Cold Start Strategies

What the platform does document is which plans expose you to cold starts at all:

| Plan | Cold start exposure |
|------|---------------------|
| **Flex Consumption** | Scales to zero, but with an improved cold start path; always-ready instances remove it for a configured baseline |
| **Premium** | Prewarmed workers run with no delay after idling; always-ready instances keep one or more perpetually warm |
| **Dedicated** | The host runs continuously on a fixed instance count, so cold start isn't a factor |
| **Container Apps** | Only when minimum replicas is 0; set it to 1 or more and the host runs continuously |
| **Consumption** (legacy) | Scales to zero, mitigated only by the platform's prewarmed placeholder instances |

**Mitigation options:**

| Strategy | Approach | Trade-offs |
|----------|----------|------------|
| **Always-ready instances** | Keep a configured number of instances warm on Flex Consumption or Premium | You pay for the baseline whether or not it is used |
| **Dedicated plan with Always On** | Host runs continuously | App Service plan cost, and manual or autoscale rather than event-driven scaling |
| **Minimize dependencies** | Fewer packages and lighter frameworks mean less to load at startup | Development constraints |
| **Run-from-package** | Deploy as a read-only package | Deployment pipeline changes |
| **Connection pooling** | Reuse clients across invocations via static or injected singletons | Code changes required |

One more limit compounds the problem. The language worker process has 60 seconds to start, and that timeout is not configurable. An app whose startup path is slow enough to approach it fails rather than merely responding slowly.

---

### Cold Starts Elsewhere in the Stack

Event Grid has no cold start of its own. It delivers with consistent latency, and any delay comes from the handler it calls. Consumption Logic Apps run in multitenant infrastructure and show the same infrequent-use latency as Consumption Functions. Standard Logic Apps run on a Workflow Service Plan, where the instances are already provisioned.

---

## Cost Optimization Patterns

### Optimize Function Invocations

**Pattern:** Batch operations to reduce the number of Function invocations.

Instead of triggering a Function per event, use triggers that support batching, such as Event Hubs and Service Bus, and process multiple events per invocation. Event Grid can batch too, though it is off by default; enabling it on a subscription sets a maximum events per batch (up to 5,000) and a preferred batch size, both honored on a best-effort basis. Batched delivery is all-or-none, so a handler must be able to finish a whole batch within the 30-second acknowledgment window.

---

### Use Appropriate Cosmos DB Mode

**Pattern:** Choose serverless Cosmos DB for unpredictable workloads, provisioned throughput for consistent workloads.

| Workload | Mode | Reason |
|----------|------|--------|
| Dev/test | Serverless | Low usage, cost-effective |
| Spiky production | Serverless | Pays for actual RU consumption |
| Steady production | Provisioned, with autoscale for variable load | Consistent throughput is cheaper committed than metered |

Because serverless and provisioned are account types rather than settings, this is a decision to make before the first deployment, not one to defer. Migrating later means creating a second account and moving the data. The signal Microsoft gives for the serverless side is a low average-to-peak ratio, under roughly 10 percent, rather than an absolute throughput number.

---

### Cache with APIM

**Pattern:** Cache responses in API Management to reduce backend Function invocations.

Configure cache policies in APIM to serve read-heavy APIs from the gateway, so a cache hit never reaches the Function. Every tier can attach an external Redis cache; the built-in cache size varies by tier, and the Consumption tier has no built-in cache at all.

---

### Right-Size Event Grid Filtering

**Pattern:** Use Event Grid subscription filters to reduce unnecessary Function invocations.

Subscription filters on event type or subject, such as `eventType` equals `Microsoft.Storage.BlobCreated` or subject ends with `.jpg`, keep Event Grid from invoking a Function for events it would immediately discard. The filter runs in Event Grid, so the invocation never happens and is never billed.

---

## Observability and Debugging Patterns

### Pattern 14: Distributed Tracing with Application Insights

**Use case:** Trace requests across multiple serverless components to diagnose latency and errors.

```
HTTP Request → APIM → Function A → Service Bus → Function B → Cosmos DB
   ↓                      ↓                          ↓             ↓
Application Insights (correlated telemetry)
```

**Components:**
- [Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview){:target="_blank" rel="noopener noreferrer"} integrated with all serverless components
- Automatic correlation using operation IDs
- End-to-end transaction tracing across Functions, Logic Apps, and APIM
- Custom telemetry for business metrics

**Wire it up with a connection string and OpenTelemetry.** Two details date most Application Insights setup guidance for serverless. Instrumentation-key-only ingestion lost support on 31 March 2025, so the app needs `APPLICATIONINSIGHTS_CONNECTION_STRING`. And Application Insights instrumentation is now OpenTelemetry, which Azure Functions turns on with `"telemetryMode": "OpenTelemetry"` in `host.json`. That mode is not supported for C# in-process function apps, which is one more reason the isolated worker migration is not optional. Sample code built on `TelemetryClient`, `TrackEvent`, or `ITelemetryInitializer` predates all of this.

**Key metrics to monitor:**

| Metric | Service | Purpose |
|--------|---------|---------|
| **Invocation count** | Functions | Track execution volume |
| **Duration** | Functions, Logic Apps | Measure latency |
| **Failure rate** | Functions, Logic Apps | Detect errors |
| **Throttling** | Cosmos DB, APIM | Identify capacity limits |
| **Cold start frequency** | Functions | Optimize plan selection |

**Trade-offs:**
- Application Insights adds minimal overhead
- Sampling reduces cost for high-volume telemetry
- Correlation works automatically with minimal configuration
- Log retention has cost implications

**When to use:**
- Debugging latency issues across multiple services
- Understanding error propagation in distributed workflows
- Monitoring production health and performance

---

### Handling Dead Letters

**Pattern:** Route failed messages to dead-letter queues for investigation and replay.

**Components:**
- Service Bus entities have a dead-letter subqueue that captures messages exceeding the delivery count
- Event Grid dead-letters to a **blob container in a storage account**, not a queue, and only if you configured one when creating the subscription
- Monitor dead-letter depth, or subscribe to blob-created events on the dead-letter container so failures raise an alert instead of accumulating
- A replay Function reprocesses dead-lettered items after the underlying fix ships

**When to use:**
- Transient errors should not lose messages
- Messages must be processed eventually
- Need audit trail of processing failures

---

## Common Pitfalls

### Pitfall 1: Not Accounting for Cold Starts in SLA-Critical Paths

**Problem:** Deploying scale-to-zero Functions for latency-sensitive APIs without considering cold start delays.

**Result:** API response times spike for the first request after an idle period, blowing whatever latency budget the API promised.

**Solution:** Configure always-ready instances on Flex Consumption or Premium so a baseline never scales to zero, or use a Dedicated plan with Always On. Reserve fully scale-to-zero configurations for background processing where a slow first request costs nothing.

---

### Pitfall 2: Treating Cosmos DB Serverless as a Reversible Setting

**Problem:** Choosing serverless for a workload that later needs multiple regions, or assuming throughput can be raised when it isn't enough.

**Result:** Neither is a configuration change. A serverless account is locked to one region for its lifetime, and its throughput ceiling is a function of how many physical partitions the container has grown, which follows from the partition key rather than from a dial you can turn. Escaping either means a new account and a data migration.

**Solution:** Decide serverless versus provisioned before the first deployment, on the strength of the traffic *shape* rather than a throughput number: serverless for a low average-to-peak ratio and long idle periods, provisioned with autoscale for anything with a multi-region or sustained-throughput future. Monitor RU consumption from day one either way.

---

### Pitfall 3: Synchronous Chains of Functions

**Problem:** Designing workflows where Function A calls Function B, which calls Function C synchronously.

**Result:** Latency accumulates across the chain, and failures in downstream Functions propagate upward. You pay for execution time while Functions wait for responses.

**Solution:** Use asynchronous patterns with queues or Event Grid. Function A writes to a queue, Function B processes the message and writes to another queue, and Function C processes independently. Durable Functions provide orchestration without explicit queues.

---

### Pitfall 4: Not Using Bindings for Azure Service Integration

**Problem:** Writing explicit SDK code to read from Cosmos DB or write to Service Bus instead of using Function bindings.

**Result:** More boilerplate code, manual connection management, and missed automatic retries.

**Solution:** Use input and output bindings for Cosmos DB, Service Bus, Blob Storage, and other Azure services. Bindings reduce code, handle connection pooling, and provide automatic retries.

---

### Pitfall 5: Assuming Private Network Access Requires a Premium Plan

**Problem:** Reaching for the Premium plan, or worse, exposing a backing service publicly, because a Function needs to call a private endpoint.

**Result:** Either an unnecessary jump to a per-hour hosting bill, or a private resource given a public endpoint to work around a limit that no longer applies.

**Solution:** Flex Consumption supports both outbound virtual network integration and inbound private endpoints, at serverless billing. Classic Consumption is the only plan that supports neither, and it is legacy. If a Function can't reach a private resource, the fix is usually to migrate off Consumption rather than to buy a bigger plan.

---

### Pitfall 6: Ignoring Event Grid Retry and Dead-Lettering

**Problem:** Deploying event handlers without configuring dead-letter destinations, on the assumption that a managed service wouldn't discard data.

**Result:** It does. Dead-lettering is off by default, and an event that exhausts its retries with no dead-letter destination is dropped with no record. Configuration errors make this immediate rather than eventual. A `400`, `403`, or `413` response is never retried at all, and neither is a subscription pointing at a deleted endpoint.

**Solution:** Set a dead-letter destination, a blob container in a storage account, on every subscription that matters. Tune the retry policy if the defaults don't fit: 30 delivery attempts and a 1,440-minute time-to-live, whichever expires first. Then monitor the container, because a dead-letter destination nobody reads is only marginally better than none.

---

## Key Takeaways

1. **Azure serverless is an ecosystem, not a single service.** Functions provide compute, Logic Apps orchestrate workflows, Event Grid routes events, APIM governs APIs, and Cosmos DB serverless stores data. Understanding how these services compose is critical.

2. **Choose Durable Functions for code-based orchestration, Logic Apps for integration workflows.** Durable Functions provide full programming language expressiveness, while Logic Apps excel at connecting SaaS systems with pre-built connectors.

3. **Event Grid is for reactive pub-sub, Service Bus is for reliable messaging.** Use Event Grid to notify subscribers about state changes. Use Service Bus for transactional commands, guaranteed delivery, and ordered processing.

4. **Cold starts are a property of scaling to zero, not of serverless.** Always-ready instances on Flex Consumption or Premium buy a warm baseline at serverless-adjacent cost. Microsoft publishes no cold start durations, so measure your own app rather than designing against a number you read somewhere.

5. **API Management provides more than a gateway.** Centralized authentication, rate limiting, caching, and transformation reduce Function invocations and cost while improving security and developer experience.

6. **Cosmos DB serverless is an account-level, one-way decision.** It is fixed at account creation, locked to a single region, and its throughput ceiling grows with physical partitions rather than with a setting. Choose it for a low average-to-peak ratio and long idle periods; choose provisioned with autoscale for anything that might need a second region.

7. **Use bindings to reduce boilerplate and improve reliability.** Function bindings handle connection management, retries, and integration with Azure services. Writing explicit SDK code is rarely necessary.

8. **Asynchronous patterns improve resilience and scalability.** Avoid synchronous chains of Functions. Use queues, Event Grid, or Durable Functions to decouple components and handle failures gracefully.

9. **Distributed tracing with Application Insights is essential.** Serverless architectures compose many small services. Without distributed tracing, diagnosing latency and errors is nearly impossible. Enable Application Insights from the start.

10. **Hybrid patterns bridge serverless and legacy systems.** Combine Functions with VMs, containers, or on-premises systems for incremental modernization. Virtual network integration and messaging enable hybrid architectures without rewriting everything, and every plan but legacy Consumption supports it.

11. **Two deadlines shape any C# serverless work started today.** The Functions in-process model loses support on 10 November 2026, and Linux Consumption hosting retires on 30 September 2028. New apps belong on the isolated worker model and Flex Consumption; existing ones need a migration plan rather than a note in a backlog.
