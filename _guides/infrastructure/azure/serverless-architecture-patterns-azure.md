---
title: "Serverless Architecture Patterns on Azure"
layout: guide
category: Azure
subcategory: Serverless Architecture
description: "Cross-service serverless composition patterns using Azure Functions, Logic Apps, Event Grid, API Management, and Cosmos DB serverless for event-driven and workflow-based architectures"
tags: [azure, cloud-computing, architecture, design-patterns, scalability, distributed-systems, practical]
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
| **Function runtime** | Lambda (fixed runtime versions) | Azure Functions (Consumption, Premium, Dedicated plans; more runtime flexibility) |
| **Event routing** | EventBridge for custom events | Event Grid for pub-sub routing, Service Bus for messaging |
| **Orchestration** | Step Functions (code-based state machines) | Durable Functions (code-based), Logic Apps (visual designer, connector-rich) |
| **API gateway** | API Gateway (pay per request) | API Management (multiple tiers, heavier feature set, also supports pay-per-request Consumption tier) |
| **Serverless database** | DynamoDB (always serverless) | Cosmos DB serverless (optional serverless mode; provisioned throughput is default) |
| **Function deployment** | Zip upload, container images | Zip deployment, container images, run-from-package |
| **Cold start mitigation** | Provisioned Concurrency | Premium plan with pre-warmed instances, or always-on for Dedicated plan |
| **Function duration limits** | 15 minutes (Lambda) | 5 minutes (Consumption), 60 minutes (Premium), unlimited (Dedicated) |

---

## Azure Serverless Building Blocks

### Azure Functions

[Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview){:target="_blank" rel="noopener noreferrer"} is the core compute service for serverless workloads. A function executes code in response to events like HTTP requests, queue messages, blob uploads, database changes, or timers.

**Function hosting plans:**

| Plan | Use Case | Scaling | Cold Start | Cost Model |
|------|----------|---------|------------|------------|
| **Consumption** | Event-driven, unpredictable load | Automatic, scales to zero | Yes (seconds) | Pay per execution + GB-seconds |
| **Premium** | Consistent workload, cold start sensitive | Automatic, pre-warmed instances | Minimal (pre-warmed) | Hourly + execution costs |
| **Dedicated (App Service)** | Existing App Service plan capacity | Manual or auto-scale | No (always on) | App Service plan cost |

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

Functions support multiple languages including C#, JavaScript/TypeScript, Python, Java, and PowerShell.

---

### Logic Apps

[Logic Apps](https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-overview){:target="_blank" rel="noopener noreferrer"} provides declarative workflow orchestration with a visual designer and hundreds of pre-built connectors for SaaS and enterprise systems. Logic Apps excel at integration scenarios where you need to connect disparate systems without writing integration code.

**Logic Apps flavors:**

| Flavor | Use Case | Hosting | Cost Model |
|--------|----------|---------|------------|
| **Consumption** | Low-medium volume workflows | Multi-tenant | Per action execution |
| **Standard** | High-volume, more control | Single-tenant or App Service Environment | Hourly + execution |

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

[Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/overview){:target="_blank" rel="noopener noreferrer"} is a fully managed event routing service that delivers events from publishers to subscribers using pub-sub semantics. Event Grid provides reliable, low-latency event delivery at massive scale.

**Event sources (publishers):**
- Azure services (Storage, Event Hubs, IoT Hub, Service Bus, Azure resources)
- Custom applications via HTTP POST

**Event handlers (subscribers):**
- Azure Functions
- Logic Apps
- Event Hubs
- Service Bus queues/topics
- Webhooks (HTTP endpoints)
- Azure Automation runbooks

**Event Grid vs Service Bus:**

| Aspect | Event Grid | Service Bus |
|--------|-----------|-------------|
| **Pattern** | Pub-sub (reactive events) | Message queue/broker (commands, state transfer) |
| **Delivery** | At-least-once (24-hour retry) | At-least-once (dead letter for failures) |
| **Ordering** | No ordering guarantee | FIFO ordering (sessions) |
| **Filtering** | Advanced filtering on event schema | Subscription filters |
| **Use case** | Notify subscribers about state changes | Reliable messaging, commands, workflows |

Use Event Grid for lightweight event notifications where subscribers react to events. Use Service Bus for transactional messaging where message order and guaranteed delivery to a single consumer matter.

---

### API Management

[API Management](https://learn.microsoft.com/en-us/azure/api-management/api-management-key-concepts){:target="_blank" rel="noopener noreferrer"} (APIM) is a full-featured API gateway that provides security, throttling, caching, transformation, and developer portal capabilities. It fronts backend APIs built with Functions, Logic Apps, containers, or VMs.

**APIM tiers:**

| Tier | Use Case | Cost Model | VNet Integration |
|------|----------|------------|------------------|
| **Consumption** | Serverless, pay-per-request | Per million requests | No |
| **Developer** | Non-production | Low fixed monthly | No |
| **Basic/Standard** | Production | Medium fixed monthly | External mode |
| **Premium** | Enterprise, multi-region | High fixed monthly | Internal/external modes |

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

**Serverless vs provisioned throughput:**

| Aspect | Serverless | Provisioned Throughput |
|--------|-----------|----------------------|
| **Billing** | Per RU consumed + storage | Hourly for provisioned RU/s + storage |
| **Best for** | Unpredictable, spiky workloads | Consistent, predictable throughput needs |
| **Throughput limit** | 5,000 RU/s per container | Up to millions of RU/s |
| **Storage limit** | 1 TB per account | Unlimited |
| **Latency** | Single-digit millisecond | Single-digit millisecond |

Serverless mode fits scenarios where traffic is sporadic or unpredictable, and total throughput needs stay under the 5,000 RU/s limit per container. It is ideal for development, testing, small applications, or workloads with long idle periods.

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
- Event Grid topic subscribed by multiple Functions
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

---

### Pattern 3: CQRS with Serverless

**Use case:** Separate read and write responsibilities with different data models optimized for each.

```
Write Side:
Command API (Function)
   ↓
Write to Cosmos DB (normalized write model)
   ↓
Cosmos DB Change Feed
   ↓
Projection Function → Cosmos DB (denormalized read model)

Read Side:
Query API (Function)
   ↓
Read from Cosmos DB (read model optimized for queries)
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

---

## API-First Serverless Patterns

### Pattern 4: API Management Fronting Functions

**Use case:** Expose multiple backend Functions through a unified API gateway with centralized authentication, rate limiting, and caching.

```
Client
   ↓
API Management (Consumption tier)
   ├→ /users → Users Function
   ├→ /orders → Orders Function
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
- APIM adds latency (typically 20-50ms)
- Consumption tier has per-request cost; heavier traffic may benefit from Basic/Standard fixed pricing

**When to use:**
- Multiple Functions compose a single API surface
- Authentication, rate limiting, and caching requirements are consistent across endpoints
- External consumers need a developer portal

---

### Pattern 5: Backend for Frontend with Functions and APIM

**Use case:** Different client types (web, mobile, IoT) have different data needs. Create specialized BFF Functions for each client type behind APIM.

```
APIM
├→ /api/web → Web BFF Function → Cosmos DB
├→ /api/mobile → Mobile BFF Function → Cosmos DB
└→ /api/iot → IoT BFF Function → Cosmos DB
```

**Components:**
- Each BFF Function tailors responses for its client type
- Web BFF returns rich data with full models
- Mobile BFF returns minimal data to reduce bandwidth
- IoT BFF batches telemetry writes
- APIM routes requests based on path or header

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
[FunctionName("OrderWorkflow")]
public static async Task Run([OrchestrationTrigger] IDurableOrchestrationContext context)
{
    var orderId = context.GetInput<string>();

    // Step 1: Validate order
    var isValid = await context.CallActivityAsync<bool>("ValidateOrder", orderId);
    if (!isValid) return;

    // Step 2: Charge payment
    await context.CallActivityAsync("ChargePayment", orderId);

    // Step 3: Wait for human approval (for high-value orders)
    if (await context.CallActivityAsync<bool>("RequiresApproval", orderId))
    {
        await context.WaitForExternalEvent("ApprovalReceived");
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

```
Trigger: Dynamics 365 (new opportunity created)
   ↓
Condition: If value > threshold
   ↓
Action: Send email via Office 365
   ↓
Action: Create record in SharePoint
   ↓
Action: Post message to Microsoft Teams
```

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

```
IoT Devices / Apps
   ↓
Event Hubs (ingestion)
   ↓
Function (triggered by Event Hubs)
   - Parse, enrich, validate event
   - Write to Cosmos DB via output binding
   ↓
Cosmos DB (storage)
   ↓
Query API (Function) or Power BI
```

**Components:**
- Event Hubs captures high-throughput event streams
- Function with Event Hubs trigger processes events in batches
- Cosmos DB stores processed data with partitioning for scale
- Change feed enables downstream processing or analytics

**Trade-offs:**
- Event Hubs handles millions of events per second
- Function scales automatically based on Event Hubs partition count
- Cosmos DB provides low-latency reads for processed data
- Event Hubs retention is limited (1-7 days); archive to Blob Storage for long-term retention

**When to use:**
- High-volume telemetry or log ingestion
- Near real-time processing with low latency
- Downstream systems query processed data frequently

---

### Pattern 9: Blob Trigger for Batch Processing

**Use case:** Process files uploaded to Blob Storage, such as CSV imports, image transformations, or video encoding.

```
File Upload → Blob Storage
   ↓
Blob Trigger Function
   - Read blob content
   - Process (transform, validate, etc.)
   - Write output to Blob Storage or Cosmos DB
   ↓
Output Storage
```

**Components:**
- Blob Storage with containers for input and output
- Function with Blob trigger listens for new blobs
- Processing logic transforms or validates data
- Output binding writes results to Blob or Cosmos DB

**Trade-offs:**
- Blob trigger has latency (up to several minutes in Consumption plan)
- Event Grid blob trigger provides faster notification
- Large files may exceed Function memory limits; Premium plan increases limits
- Blob Storage provides cheap, durable storage for files

**When to use:**
- File-based batch processing
- Latency of a few minutes is acceptable
- Files are uploaded infrequently or in batches

**Improving latency:**
Replace Blob trigger with Event Grid trigger for near-instant notification when blobs are created.

---

## Serverless Web Application Patterns

### Pattern 10: Static Web Apps with Functions Backend

**Use case:** Host a single-page application (SPA) with a serverless API backend.

```
Azure Static Web Apps
├── Frontend (React, Angular, Vue.js)
│   - Deployed to CDN
│   - Served globally with low latency
└── Backend (Azure Functions)
    - API routes integrated with Static Web Apps
    - Shares authentication with frontend
```

**Components:**
- [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/overview){:target="_blank" rel="noopener noreferrer"} deploys the SPA to a global CDN
- Backend Functions are integrated automatically as `/api/*` routes
- Built-in authentication providers (GitHub, Azure AD, Twitter, etc.)
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

```
Static Web Apps (React/Vue/Angular)
   ↓ HTTP
APIM (API gateway)
   ↓
Functions (business logic)
   ↓
Cosmos DB serverless (data storage)
```

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
- Cosmos DB serverless limited to 5,000 RU/s per container

**When to use:**
- Unpredictable or spiky traffic patterns
- Application workload fits within serverless limits
- Want to minimize operational overhead

---

## Hybrid Serverless Patterns

### Pattern 12: Serverless with Containers

**Use case:** Combine serverless Functions for event handling with containerized services for long-running or stateful workloads.

```
Event Grid
   ↓
Function (event handler)
   ↓ HTTP
Container Apps (stateful service)
   ↓
Cosmos DB
```

**Components:**
- Functions handle events and lightweight tasks
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/overview){:target="_blank" rel="noopener noreferrer"} run stateful or long-running services
- Container Apps can scale to zero like Functions
- Shared Cosmos DB for data persistence

**Trade-offs:**
- Containers provide full control over runtime and dependencies
- Container Apps support long-running processes and persistent connections
- Functions are better for short-lived, event-driven tasks
- More complex deployment than pure serverless

**When to use:**
- Workload mixes event-driven tasks with long-running services
- Need full control over containerized dependencies
- Stateful services (e.g., WebSocket servers) alongside event handlers

---

### Pattern 13: Serverless with VMs for Legacy Systems

**Use case:** Modernize incrementally by adding serverless event handlers while keeping legacy VMs.

```
Function (triggered by HTTP or Event Grid)
   ↓ HTTP or messaging
VM (legacy application)
   ↓
On-premises database (via VPN/ExpressRoute)
```

**Components:**
- Functions provide modern API endpoints
- Functions communicate with legacy VM services via HTTP or Service Bus
- VMs remain for workloads that cannot be refactored yet
- VNet integration allows Functions to reach private VMs

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

Cold starts occur when a serverless service must provision resources before handling a request. This adds latency, especially noticeable for synchronous APIs.

### Azure Functions Cold Start Strategies

**Consumption plan cold starts:**
- Typically 2-10 seconds depending on language runtime and dependencies
- Managed dependencies (NuGet, npm packages) increase cold start time

**Mitigation options:**

| Strategy | Approach | Trade-offs |
|----------|----------|------------|
| **Premium plan** | Pre-warmed instances always available | Higher cost (always-on instances) |
| **Dedicated plan** | Always-on setting keeps Functions running | App Service plan cost |
| **Minimize dependencies** | Reduce package count, avoid heavy frameworks | Development constraints |
| **Run-from-package** | Deploy as read-only package reduces startup time | Deployment complexity |
| **Connection pooling** | Reuse connections across invocations | Code changes required |

**Language runtime impact:**

| Runtime | Cold Start Duration |
|---------|-------------------|
| JavaScript/TypeScript | 1-3 seconds |
| Python | 2-5 seconds |
| C# (in-process) | 2-4 seconds |
| C# (isolated worker) | 3-6 seconds |
| Java | 5-10 seconds |

JavaScript and compiled C# typically have faster cold starts than Python or Java.

---

### Event Grid Cold Starts

Event Grid itself does not have cold starts. Event Grid delivers events to handlers with consistent latency. However, the handlers (Functions, Logic Apps) may experience cold starts.

---

### Logic Apps Cold Starts

**Consumption Logic Apps** experience cold starts similar to Functions. Workflows that run infrequently may take several seconds to initialize.

**Standard Logic Apps** in single-tenant mode can use the "Always Ready" feature to keep instances warm.

---

## Cost Optimization Patterns

### Optimize Function Invocations

**Pattern:** Batch operations to reduce the number of Function invocations.

```
Event Grid → Function (processes batch of 100 events)
```

Instead of triggering a Function per event, use triggers that support batching (Event Hubs, Service Bus) and process multiple events per invocation. This reduces invocation costs.

---

### Use Appropriate Cosmos DB Mode

**Pattern:** Choose serverless Cosmos DB for unpredictable workloads, provisioned throughput for consistent workloads.

| Workload | Mode | Reason |
|----------|------|--------|
| Dev/test | Serverless | Low usage, cost-effective |
| Spiky production | Serverless | Pays for actual RU consumption |
| Steady production | Provisioned | More cost-effective at consistent throughput |

For workloads exceeding 5,000 RU/s consistently, provisioned throughput is cheaper than serverless.

---

### Cache with APIM

**Pattern:** Cache responses in API Management to reduce backend Function invocations.

```
Client → APIM (cache hit) → Return cached response
Client → APIM (cache miss) → Function → APIM caches response
```

Configure cache policies in APIM to cache responses for read-heavy APIs. This reduces Function execution costs.

---

### Right-Size Event Grid Filtering

**Pattern:** Use Event Grid subscription filters to reduce unnecessary Function invocations.

```
Event Grid → Filter (eventType = "BlobCreated", subject ends with ".jpg")
   ↓ (only matching events)
Function (processes images only)
```

Filters prevent Functions from being invoked for irrelevant events, reducing costs.

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

```
Service Bus Queue → Function (fails repeatedly)
   ↓
Dead-Letter Queue
   ↓
Manual investigation or automated replay Function
```

**Components:**
- Service Bus or Event Grid dead-letter queues capture failed messages
- Monitor dead-letter queue depth
- Replay Function processes dead-letter messages after fixing the issue

**When to use:**
- Transient errors should not lose messages
- Messages must be processed eventually
- Need audit trail of processing failures

---

## Common Pitfalls

### Pitfall 1: Not Accounting for Cold Starts in SLA-Critical Paths

**Problem:** Deploying Consumption plan Functions for latency-sensitive APIs without considering cold start delays.

**Result:** API response times spike to multiple seconds for the first request after idle periods, violating SLAs.

**Solution:** Use Premium plan with pre-warmed instances for SLA-critical APIs. Alternatively, use a Dedicated plan with always-on enabled. Consider Consumption plan only for background processing or non-latency-sensitive workloads.

---

### Pitfall 2: Exceeding Cosmos DB Serverless Limits

**Problem:** Choosing Cosmos DB serverless for workloads that exceed the 5,000 RU/s per container limit.

**Result:** Throttling errors when throughput spikes, causing request failures.

**Solution:** Monitor RU consumption closely. If consistent throughput exceeds 5,000 RU/s, switch to provisioned throughput mode. Use auto-scale provisioned throughput for spiky workloads that occasionally exceed serverless limits.

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

### Pitfall 5: Missing VNet Integration for Private Resources

**Problem:** Attempting to call private endpoints or VMs from Functions in Consumption plan without VNet integration.

**Result:** Connection failures because Consumption plan Functions run in multi-tenant infrastructure without private network access.

**Solution:** Use Premium plan with VNet integration or Dedicated plan to access private resources. Alternatively, expose private resources through public endpoints secured by authentication and NSGs.

---

### Pitfall 6: Ignoring Event Grid Retry and Dead-Lettering

**Problem:** Deploying event handlers without configuring retry policies or dead-letter destinations.

**Result:** Transient failures cause lost events because Event Grid drops events after the retry period expires.

**Solution:** Configure Event Grid subscriptions with appropriate retry policies (default is 24 hours) and dead-letter destinations (Storage account or Service Bus). Monitor dead-letter destinations for failed events.

---

## Key Takeaways

1. **Azure serverless is an ecosystem, not a single service.** Functions provide compute, Logic Apps orchestrate workflows, Event Grid routes events, APIM governs APIs, and Cosmos DB serverless stores data. Understanding how these services compose is critical.

2. **Choose Durable Functions for code-based orchestration, Logic Apps for integration workflows.** Durable Functions provide full programming language expressiveness, while Logic Apps excel at connecting SaaS systems with pre-built connectors.

3. **Event Grid is for reactive pub-sub, Service Bus is for reliable messaging.** Use Event Grid to notify subscribers about state changes. Use Service Bus for transactional commands, guaranteed delivery, and ordered processing.

4. **Cold starts are unavoidable in Consumption plans.** Mitigate with Premium plan pre-warmed instances, minimize dependencies, or accept cold starts for non-latency-sensitive workloads. Consumption plans are best for background processing.

5. **API Management provides more than a gateway.** Centralized authentication, rate limiting, caching, and transformation reduce Function invocations and cost while improving security and developer experience.

6. **Cosmos DB serverless fits unpredictable workloads under 5,000 RU/s.** Beyond that threshold, provisioned throughput becomes more cost-effective. Use auto-scale provisioned throughput for spiky workloads exceeding serverless limits.

7. **Use bindings to reduce boilerplate and improve reliability.** Function bindings handle connection management, retries, and integration with Azure services. Writing explicit SDK code is rarely necessary.

8. **Asynchronous patterns improve resilience and scalability.** Avoid synchronous chains of Functions. Use queues, Event Grid, or Durable Functions to decouple components and handle failures gracefully.

9. **Distributed tracing with Application Insights is essential.** Serverless architectures compose many small services. Without distributed tracing, diagnosing latency and errors is nearly impossible. Enable Application Insights from the start.

10. **Hybrid patterns bridge serverless and legacy systems.** Combine Functions with VMs, containers, or on-premises systems for incremental modernization. VNet integration and messaging enable hybrid architectures without rewriting everything.
