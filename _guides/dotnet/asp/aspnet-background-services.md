---
title: "Background Services and Job Processing"
layout: guide
category: "ASP.NET Core"
subcategory: "Performance & Operations"
description: "Learn how to implement background tasks and job processing in ASP.NET Core, from simple hosted services to persistent job scheduling with Hangfire and Quartz.NET."
tags: [asp-net-core, background-services, job-scheduling, dependency-injection, performance, distributed-systems, observability]
---

## Background Processing in ASP.NET Core

ASP.NET Core provides built-in abstractions for running background tasks within the same process as your web application. These services start when the host starts and stop gracefully when the host shuts down. Understanding when to use simple hosted services versus dedicated job scheduling frameworks determines whether you build a maintainable solution or create operational complexity.

This guide covers the spectrum of background processing approaches, from lightweight in-process tasks to persistent job scheduling with external storage. Each approach trades simplicity for capabilities, and choosing the right tool for your scenario prevents over-engineering simple problems while avoiding fragile solutions for complex ones.

## IHostedService and BackgroundService

The `IHostedService` interface defines the contract for background tasks that run for the lifetime of your application. The interface includes two methods: `StartAsync` receives a cancellation token and contains the logic to start the background task, while `StopAsync` receives a cancellation token and triggers when the host performs a graceful shutdown.

Implementing `IHostedService` directly gives you full control over the startup and shutdown lifecycle. You manage your own execution loop, handle threading explicitly, and coordinate between start and stop operations. This control matters when you need precise coordination with other services or complex state management during startup.

The `BackgroundService` abstract class simplifies implementation by handling the lifecycle mechanics for you. It implements `IHostedService` and exposes a single abstract method called `ExecuteAsync` where you write your background logic. The base class manages the coordination between `StartAsync`, `StopAsync`, and your execution loop, freeing you from boilerplate threading code.

```csharp
public class DataCleanupService : BackgroundService
{
    private readonly ILogger<DataCleanupService> _logger;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(6);

    public DataCleanupService(ILogger<DataCleanupService> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Data cleanup service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            await PerformCleanup(stoppingToken);
            await Task.Delay(_cleanupInterval, stoppingToken);
        }
    }

    private async Task PerformCleanup(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting data cleanup at {Time}", DateTime.UtcNow);
        // Cleanup logic here
    }
}
```

When your background service needs to run immediately at startup and then periodically thereafter, place the work execution before the delay. When you want to wait for an initial period before the first execution, place the delay before the work. The cancellation token passed to `ExecuteAsync` signals when the application is shutting down, allowing your loop to exit gracefully.

### When to Use Each Approach

Implement `IHostedService` directly when you need lifecycle hooks beyond simple background execution. Services that coordinate with other components during startup, maintain complex state across start and stop operations, or need to prevent the application from accepting requests until initialization completes benefit from explicit lifecycle control.

Inherit from `BackgroundService` for straightforward background work like periodic cleanup, polling external systems, or processing queued items. The simplified implementation reduces boilerplate while providing the same lifecycle guarantees. Most background services fit this pattern.

## Consuming Scoped Services

Background services registered as hosted services behave like singletons and live for the application's lifetime. This creates a fundamental problem when your background work needs scoped services like database contexts or services configured with scoped lifetimes. Injecting a scoped service directly into a singleton-lifetime background service constructor throws an exception at runtime because the dependency injection container cannot resolve a scoped dependency from a singleton.

The solution involves creating a scope manually within your background service. The `IServiceScopeFactory` provides the mechanism to create scopes on demand. You inject the scope factory into your background service constructor, then create a new scope each time you need to resolve scoped dependencies. Each scope acts as a logical boundary for scoped service lifetimes, ensuring proper disposal when the scope completes.

```csharp
public class OrderProcessingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OrderProcessingService> _logger;

    public OrderProcessingService(
        IServiceScopeFactory scopeFactory,
        ILogger<OrderProcessingService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var orderRepository = scope.ServiceProvider
                    .GetRequiredService<IOrderRepository>();

                await ProcessPendingOrders(orderRepository, stoppingToken);
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task ProcessPendingOrders(
        IOrderRepository repository,
        CancellationToken cancellationToken)
    {
        var orders = await repository.GetPendingOrdersAsync();
        foreach (var order in orders)
        {
            await repository.ProcessOrderAsync(order);
        }
    }
}
```

The scope exists only for the duration of the using block. When the block exits, the scope disposes, which in turn disposes any scoped services resolved from that scope. This pattern ensures that scoped services like database contexts release their resources promptly rather than accumulating throughout the application lifetime.

Creating a scope for each iteration of work makes sense when iterations are infrequent or when each iteration represents a logical unit of work. Creating a scope per item when processing large batches can introduce overhead. In these cases, create a scope around the batch and resolve the scoped service once per batch rather than per item.

### Scope Lifetime Considerations

Scopes remain active until you dispose them. If your background service processes items from a queue and each item takes seconds to minutes, creating a scope per item ensures that database connections and other scoped resources don't remain open longer than necessary. Conversely, if you process hundreds of small items rapidly, the overhead of creating and disposing scopes repeatedly may outweigh the benefits.

The cancellation token passed to your background service signals shutdown. When the application stops, any in-progress work should respond to cancellation. Pass the stopping token through to async operations so they can terminate promptly. Database operations, HTTP calls, and delays should all accept the cancellation token to enable graceful shutdown.

## Timed Background Tasks

Many background services need to run at specific intervals or on specific schedules. The simplest approach uses `Task.Delay` within a loop, as shown in earlier examples. This pattern works well for intervals measured in minutes or hours and doesn't require dependencies on external scheduling libraries.

The delay-based approach suffers from drift over time. If your background work takes variable amounts of time to complete, the interval between executions varies by that same amount. A task configured to run every hour that takes 10 minutes to execute actually runs every 70 minutes. For many scenarios, this drift doesn't matter. When it does matter, calculate the next execution time explicitly.

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        var now = DateTime.UtcNow;
        var nextRun = now.Date.AddHours(now.Hour + 1); // Top of next hour
        var delay = nextRun - now;

        if (delay > TimeSpan.Zero)
        {
            await Task.Delay(delay, stoppingToken);
        }

        if (!stoppingToken.IsCancellationRequested)
        {
            await PerformScheduledWork(stoppingToken);
        }
    }
}
```

This approach calculates when the next execution should occur, waits until that time, and then executes. The execution time doesn't affect the schedule because the next execution time is calculated from the current time, not from when the previous execution completed. This maintains consistent scheduling at the cost of slightly more complex time arithmetic.

When background tasks need to run at specific times of day like 2:00 AM for database maintenance or midnight for report generation, calculate the delay until the target time each iteration. If the current time exceeds the target time for today, calculate the delay until the target time tomorrow. This pattern provides simple daily scheduling without external dependencies.

### Avoiding Overlapping Executions

Long-running tasks can outlast their scheduling interval. If your task runs every 10 minutes but sometimes takes 15 minutes to complete, the next iteration might start before the previous one finishes. This creates overlapping executions that can cause concurrency issues, resource exhaustion, or duplicate work.

The standard `BackgroundService` pattern with a loop and delay naturally prevents overlapping executions because the next iteration waits for the previous one to complete before delaying and starting again. If you need explicit protection, use a `SemaphoreSlim` to ensure only one execution runs at a time.

```csharp
private readonly SemaphoreSlim _executionLock = new SemaphoreSlim(1, 1);

protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        if (await _executionLock.WaitAsync(0, stoppingToken))
        {
            try
            {
                await PerformWork(stoppingToken);
            }
            finally
            {
                _executionLock.Release();
            }
        }

        await Task.Delay(_interval, stoppingToken);
    }
}
```

The `WaitAsync(0)` call attempts to acquire the semaphore immediately without waiting. If the previous execution is still running, the wait fails immediately and the service moves to the delay. This prevents queuing up executions while ensuring that work happens as soon as the previous execution completes and the interval expires.

## Queue-Based Processing with Channel

Simple timed tasks cover periodic work, but many scenarios require processing work items queued by request handlers. The web endpoint receives a request, queues the work item, returns immediately, and the background service processes items from the queue asynchronously. This pattern improves request latency by moving expensive operations out of the request path while maintaining reliable processing.

The `System.Threading.Channels` namespace provides high-performance, thread-safe queues designed for producer-consumer scenarios. A `Channel<T>` consists of a writer that producers use to add items and a reader that consumers use to retrieve items. Channels support bounded capacity with configurable behavior when the queue fills, backpressure through async writes, and efficient async enumeration for consumers.

```csharp
public interface IBackgroundTaskQueue
{
    ValueTask QueueAsync(Func<CancellationToken, ValueTask> workItem);
    ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(
        CancellationToken cancellationToken);
}

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<CancellationToken, ValueTask>> _queue;

    public BackgroundTaskQueue(int capacity)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait
        };
        _queue = Channel.CreateBounded<Func<CancellationToken, ValueTask>>(options);
    }

    public async ValueTask QueueAsync(Func<CancellationToken, ValueTask> workItem)
    {
        await _queue.Writer.WriteAsync(workItem);
    }

    public async ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(
        CancellationToken cancellationToken)
    {
        return await _queue.Reader.ReadAsync(cancellationToken);
    }
}
```

The bounded capacity with `FullMode.Wait` provides backpressure. When the queue reaches capacity, calls to `WriteAsync` wait asynchronously until space becomes available. This prevents unbounded memory growth when producers outpace consumers while allowing producers to continue during temporary throughput mismatches.

The background service dequeues and processes items continuously:

```csharp
public class QueuedHostedService : BackgroundService
{
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly ILogger<QueuedHostedService> _logger;

    public QueuedHostedService(
        IBackgroundTaskQueue taskQueue,
        ILogger<QueuedHostedService> logger)
    {
        _taskQueue = taskQueue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Queued hosted service is starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            var workItem = await _taskQueue.DequeueAsync(stoppingToken);

            try
            {
                await workItem(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred executing work item");
            }
        }

        _logger.LogInformation("Queued hosted service is stopping");
    }
}
```

This pattern provides lightweight, in-memory queuing with minimal dependencies. Request handlers queue work items during request processing, immediately return responses to clients, and the background service processes items asynchronously. The queue survives for the application lifetime but does not persist across restarts. If the application stops, queued items are lost.

### When Channel-Based Queuing Fits

Channel-based queuing fits scenarios where losing queued work on application restart is acceptable. Short-lived work items that complete quickly, operations that can be safely retried if lost, and systems where queue depth remains manageable all fit this pattern. When work items must survive restarts, when you need distributed processing across multiple instances, or when you require visibility into queue state over time, persistent queuing solutions provide better guarantees.

Channels excel at high-throughput scenarios with many small work items. The lack of serialization overhead, minimal memory allocation, and efficient async enumeration make channels faster than persistent queues for in-memory scenarios. When throughput matters more than durability, channels deliver better performance.

## Worker Services vs Web-Hosted Background Services

Background services can run in two different hosting models. Web-hosted background services run within the same process as your web application, sharing the same host, dependency injection container, and lifecycle. Worker services run as separate applications, typically as Windows Services or systemd daemons, with their own host and isolation.

Web-hosted background services benefit from shared infrastructure. Configuration, logging, and dependency injection work identically between web endpoints and background services. Deployment simplifies because a single application package contains both the web and background components. Development simplifies because debugging and testing cover both concerns in one project. Resource sharing between web and background work can reduce overall infrastructure costs for low-traffic scenarios.

The shared process creates coupling. Resource-intensive background work affects web request latency and throughput. Failures in background services can impact web availability. Scaling web and background workloads independently becomes impossible. When background work consumes significant CPU, memory, or I/O resources, hosting it alongside the web application degrades user experience.

Worker services provide isolation. Background processing runs in a separate process with its own resource allocation, failure domain, and deployment lifecycle. You can scale background workers independently from web instances, deploy background service changes without restarting the web application, and apply different resource limits to each component.

```csharp
// Worker service project Program.cs
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHostedService<EmailNotificationWorker>();
builder.Services.AddHostedService<ReportGenerationWorker>();

var host = builder.Build();
host.Run();
```

The worker service host includes the same dependency injection, configuration, and logging infrastructure as the web host but omits web-specific middleware and hosting. Worker services typically connect to queues, databases, or other storage systems to discover work rather than receiving work through HTTP endpoints.

### Choosing the Hosting Model

Host lightweight background services with minimal resource requirements alongside your web application. Periodic cleanup tasks, cache warming, and health checking fit this pattern. These services simplify deployment and leverage shared infrastructure without impacting web performance.

Separate resource-intensive, long-running, or independently scalable background work into dedicated worker services. Image processing, report generation, video encoding, and high-volume message processing warrant isolation. When background services require different scaling characteristics, deployment frequencies, or availability requirements than the web application, worker services provide the necessary independence.

## Hangfire for Persistent Job Scheduling

In-memory background services lose queued work when the application restarts. For work that must execute reliably, persistent job scheduling ensures jobs survive restarts, can be retried on failure, and provide visibility into job history and status. Hangfire provides persistent job storage, automatic retries, a built-in dashboard for monitoring, and support for fire-and-forget, delayed, recurring, and continuation jobs.

Hangfire stores job information in a backing store like SQL Server, PostgreSQL, Redis, or MongoDB. When you enqueue a job, Hangfire serializes the job parameters and stores them. Background workers poll the storage for jobs ready to execute, acquire locks to prevent duplicate execution, execute the job, and update the job status. If the application restarts mid-execution, the job remains in storage and another worker picks it up after the restart.

```csharp
// Configuration
builder.Services.AddHangfire(config =>
{
    config.UseSqlServerStorage(connectionString);
});

builder.Services.AddHangfireServer();

app.UseHangfireDashboard();

// Fire-and-forget job
BackgroundJob.Enqueue(() => Console.WriteLine("Fire-and-forget job"));

// Delayed job
BackgroundJob.Schedule(() => Console.WriteLine("Delayed job"),
    TimeSpan.FromMinutes(5));

// Recurring job
RecurringJob.AddOrUpdate("cleanup-job",
    () => PerformCleanup(),
    Cron.Daily);

// Continuation job
var jobId = BackgroundJob.Enqueue(() => ProcessOrder());
BackgroundJob.ContinueJobWith(jobId, () => SendConfirmation());
```

The dashboard provides visibility into job status, execution history, retry attempts, and failures. You can manually trigger recurring jobs, delete failed jobs, and monitor worker status through the web interface. This visibility helps diagnose issues and understand background job behavior in production.

Hangfire automatically retries failed jobs with exponential backoff. The default retry policy attempts failed jobs 10 times with increasing delays between attempts. You can customize retry behavior per job or globally. Successful jobs, failed jobs, and processing jobs all maintain state in the persistent store, providing an audit trail of background work.

### When Hangfire Makes Sense

Hangfire fits scenarios requiring persistent job storage and automatic retries. Financial transactions, order processing, email delivery, and report generation benefit from guaranteed execution and retry logic. When losing background work on restart is unacceptable, when you need visibility into job history and status, or when you require complex scheduling like cron expressions, Hangfire provides the necessary infrastructure.

The persistence and feature set come with operational overhead. Hangfire requires a backing database, background workers polling for jobs, and careful configuration of worker counts and polling intervals. For simple periodic tasks or scenarios where losing work on restart is acceptable, the overhead may exceed the value. When reliability and visibility justify the complexity, Hangfire delivers a robust solution.

## Quartz.NET for Cron-Based Scheduling

Quartz.NET provides enterprise-grade job scheduling with sophisticated triggering capabilities. While Hangfire focuses on job persistence and reliability, Quartz.NET emphasizes flexible scheduling with cron expressions, calendar-based scheduling, and complex trigger relationships. Quartz.NET supports clustering for high availability, misfired job handling, and persistent or in-memory storage.

Jobs implement the `IJob` interface with an `Execute` method receiving a context object containing job data and metadata. Triggers define when jobs execute, with support for simple intervals, cron expressions, calendar-specific scheduling, and trigger dependencies. The scheduler coordinates job execution, manages trigger state, and handles concurrency.

```csharp
// Configuration
builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("data-cleanup");

    q.AddJob<DataCleanupJob>(opts => opts.WithIdentity(jobKey));

    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("cleanup-trigger")
        .WithCronSchedule("0 0 2 * * ?") // 2 AM daily
    );
});

builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

// Job implementation
public class DataCleanupJob : IJob
{
    private readonly ILogger<DataCleanupJob> _logger;

    public DataCleanupJob(ILogger<DataCleanupJob> logger)
    {
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("Executing data cleanup job");

        // Cleanup logic here
        await Task.CompletedTask;
    }
}
```

Cron expressions provide powerful scheduling syntax: "0 0 2 * * ?" runs at 2 AM daily, "0 */15 * * * ?" runs every 15 minutes, and "0 0 0 ? * MON-FRI" runs at midnight on weekdays. The expression format matches Unix cron with extensions for seconds and more sophisticated day-of-week and day-of-month handling.

Quartz.NET supports calendar-based exclusions, allowing you to define holidays, maintenance windows, or business days and prevent jobs from running during those periods. Triggers can reference calendars, and the scheduler automatically skips or reschedules jobs that fall within excluded periods.

### Clustering and High Availability

Quartz.NET supports clustering across multiple application instances with shared persistent storage. The scheduler uses database locks to ensure only one instance executes each job. If an instance fails while executing a job, another instance detects the failure and recovers the job. This provides high availability for critical scheduled work without external orchestration.

Clustering requires persistent storage since in-memory schedulers cannot coordinate across processes. SQL Server, PostgreSQL, MySQL, and other relational databases support clustering through Quartz.NET's ADO.NET job store. The scheduler uses row-level locks to coordinate across instances, preventing duplicate execution while distributing load.

### When Quartz.NET Fits

Quartz.NET fits scenarios requiring complex scheduling logic. Cron-based schedules, business day awareness, maintenance window exclusions, and sophisticated trigger relationships all favor Quartz.NET. When you need jobs to continue running if the application restarts, when clustering provides high availability for critical work, or when scheduling logic exceeds simple intervals, Quartz.NET provides the necessary capabilities.

The sophistication comes with complexity. Quartz.NET requires careful configuration of job stores, triggers, and clustering behavior. For simple periodic tasks or scenarios with straightforward intervals, the learning curve and configuration overhead may not justify the flexibility. When scheduling requirements justify the investment, Quartz.NET delivers enterprise-grade capabilities.

## Health Checks for Background Services

Background services run silently, making failures difficult to detect. A background service that stops processing work due to an unhandled exception may remain undetected until the impact becomes visible through stale data or unprocessed work items. Health checks expose background service status, enabling monitoring systems to detect failures and trigger alerts or remediation.

ASP.NET Core's health check system provides a framework for implementing custom health checks and exposing them through HTTP endpoints. Background services can register health checks that report their status, enabling orchestrators like Kubernetes, load balancers, and monitoring systems to detect unhealthy instances.

```csharp
public class BackgroundServiceHealthCheck : IHealthCheck
{
    private readonly OrderProcessingService _service;

    public BackgroundServiceHealthCheck(OrderProcessingService service)
    {
        _service = service;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (_service.IsHealthy)
        {
            return Task.FromResult(
                HealthCheckResult.Healthy("Background service is running"));
        }

        return Task.FromResult(
            HealthCheckResult.Unhealthy("Background service has stopped"));
    }
}

// Configuration
builder.Services.AddHealthChecks()
    .AddCheck<BackgroundServiceHealthCheck>("background-service");

app.MapHealthChecks("/health");
```

The background service exposes an `IsHealthy` property updated during execution. When the service starts successfully, it sets `IsHealthy` to true. If an unhandled exception stops the service, the health check detects the unhealthy state and reports it. External systems polling the health endpoint receive HTTP 503 when the service is unhealthy, triggering appropriate responses.

Health checks can report detailed information beyond binary healthy/unhealthy status. Report the last successful execution time, number of consecutive failures, queue depth, or processing throughput. Health check results support data dictionaries containing arbitrary key-value pairs exposed through the health check response.

### Startup Health Checks

Background services performing expensive initialization at startup can delay application readiness. Health checks can distinguish between startup, liveness, and readiness probes. Startup checks report when long-running initialization completes, liveness checks report whether the service is still running, and readiness checks report whether the service can handle work.

```csharp
public class StartupService : BackgroundService
{
    public bool StartupCompleted { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await InitializeAsync(stoppingToken);
        StartupCompleted = true;

        while (!stoppingToken.IsCancellationRequested)
        {
            await ProcessWorkAsync(stoppingToken);
        }
    }

    private async Task InitializeAsync(CancellationToken cancellationToken)
    {
        // Expensive initialization work
        await Task.Delay(TimeSpan.FromMinutes(5), cancellationToken);
    }
}

public class StartupHealthCheck : IHealthCheck
{
    private readonly StartupService _service;

    public StartupHealthCheck(StartupService service)
    {
        _service = service;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (_service.StartupCompleted)
        {
            return Task.FromResult(HealthCheckResult.Healthy());
        }

        return Task.FromResult(
            HealthCheckResult.Degraded("Startup in progress"));
    }
}
```

Container orchestrators can use startup checks to delay routing traffic until initialization completes, preventing requests from reaching instances not yet ready to process work. This pattern improves reliability during deployments and scaling operations.

## Graceful Shutdown and Cancellation Token Propagation

Background services must respond to shutdown signals to avoid losing work or leaving resources in inconsistent states. The cancellation token passed to `ExecuteAsync` signals when the host begins shutdown. Responding to this token promptly enables graceful shutdown, giving the service time to complete in-progress work, persist state, and release resources.

The default shutdown timeout is 30 seconds. If background services don't complete within this window, the host forcefully terminates the process. Long-running operations that exceed the timeout leave work incomplete and risk data loss or corruption. Services handling critical work must either complete quickly or persist their state to resume after restart.

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        try
        {
            await ProcessBatchAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Shutdown requested, stopping gracefully");
            break;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing batch");
        }

        await Task.Delay(_interval, stoppingToken);
    }

    _logger.LogInformation("Background service stopped");
}

private async Task ProcessBatchAsync(CancellationToken cancellationToken)
{
    var items = await GetWorkItemsAsync(cancellationToken);

    foreach (var item in items)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await ProcessItemAsync(item, cancellationToken);
    }
}
```

Propagating the cancellation token through async operations ensures that database calls, HTTP requests, and delays terminate promptly when shutdown begins. Catching `OperationCanceledException` distinguishes cancellation from other exceptions, preventing shutdown cancellation from being logged as errors.

### Extending Shutdown Timeout

Services requiring more time to shut down gracefully can configure a longer timeout. The `HostOptions.ShutdownTimeout` setting controls how long the host waits for hosted services to stop. Increasing this timeout allows long-running operations to complete but delays application shutdown.

```csharp
builder.Services.Configure<HostOptions>(options =>
{
    options.ShutdownTimeout = TimeSpan.FromMinutes(2);
});
```

Extending the timeout helps when background services process large batches or perform cleanup operations that cannot be interrupted safely. The timeout applies to all hosted services, so the longest-running service determines the minimum timeout needed. Consider whether work can be interrupted and resumed rather than requiring extended shutdown windows.

### Checkpoint and Resume Patterns

Services processing large amounts of work benefit from checkpointing progress during execution. If shutdown occurs mid-processing, the service resumes from the last checkpoint rather than starting over. Checkpoints can be explicit markers in a database indicating progress through a batch or implicit through transactional processing where completed items are marked complete.

```csharp
private async Task ProcessLargeBatchAsync(CancellationToken cancellationToken)
{
    var checkpoint = await LoadCheckpointAsync();
    var items = await GetWorkItemsAfterAsync(checkpoint, cancellationToken);

    foreach (var item in items)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            await SaveCheckpointAsync(item.Id);
            return;
        }

        await ProcessItemAsync(item, cancellationToken);
        await MarkItemCompleteAsync(item.Id, cancellationToken);
    }
}
```

This pattern allows the service to stop immediately when shutdown begins while ensuring no work is lost. The service saves its current position, stops gracefully, and resumes from that position after restart. The checkpoint persists in durable storage, surviving process restarts.

## Comparing Background Processing Approaches

Different background processing approaches trade off simplicity, durability, visibility, and operational complexity. Choosing the right approach depends on requirements around job persistence, scheduling complexity, visibility, and infrastructure dependencies.

| Approach | Persistence | Scheduling | Visibility | Infrastructure | Best For |
|----------|-------------|------------|------------|----------------|----------|
| BackgroundService | None | Manual | Logs only | None | Simple periodic tasks, low-volume queuing |
| Channel Queue | In-memory | None | Logs only | None | High-throughput short-lived work |
| Hangfire | Database | Cron, delays | Dashboard | SQL/Redis | Reliable job execution, audit trail |
| Quartz.NET | Optional | Cron, calendars | Limited | Database for clustering | Complex scheduling, business day awareness |
| Worker Service | Depends on implementation | Depends on implementation | Depends on implementation | Separate deployment | Resource-intensive work, independent scaling |

Simple periodic tasks with low resource requirements fit `BackgroundService` implementations hosted alongside web applications. High-throughput in-memory queuing benefits from `Channel<T>`. Reliable job execution with visibility requires Hangfire. Complex scheduling with cron expressions and calendar awareness favors Quartz.NET. Resource-intensive or independently scalable work warrants dedicated worker services.

## Red Flags

**Injecting scoped services directly into background service constructors** throws exceptions at runtime. Background services live as singletons and cannot consume scoped dependencies directly. Rather than reaching for `IServiceScopeFactory`, reconsider whether those dependencies should be singletons. For database access, use `IDbContextFactory<T>` which is singleton-compatible and creates short-lived `DbContext` instances on demand.

**Ignoring cancellation tokens** prevents graceful shutdown. Long-running operations that don't respond to cancellation force the host to terminate abruptly, risking incomplete work and resource leaks. Propagate cancellation tokens through all async operations.

**Not handling exceptions in background service loops** causes the service to stop silently. Unhandled exceptions terminate the `ExecuteAsync` method, stopping the background service without restart. Wrap work in try-catch blocks and log exceptions while continuing the loop.

**Using in-memory queuing for work that must survive restarts** loses queued items when the application stops. Channel-based queuing provides high performance but no durability. Use persistent queuing like Hangfire when work cannot be lost.

**Running resource-intensive background work in web-hosted services** degrades request latency and throughput. Background work competes with web requests for CPU, memory, and I/O. Isolate resource-intensive work in dedicated worker services.

**Not implementing health checks for background services** makes failures difficult to detect. Services that stop processing work due to unhandled exceptions may remain undetected without health checks. Expose health status through HTTP endpoints.

**Allowing overlapping executions when they shouldn't happen** causes concurrency issues and duplicate work. Use semaphores or task tracking to prevent multiple simultaneous executions when operations aren't idempotent.

**Choosing Hangfire or Quartz.NET for simple periodic tasks** introduces unnecessary complexity and infrastructure dependencies. Simple interval-based execution with `Task.Delay` suffices for most periodic work. Reserve job scheduling frameworks for scenarios requiring their specific capabilities.

**Not persisting state before shutdown when processing long-running work** risks losing progress on restart. Implement checkpointing for work that cannot complete within the shutdown timeout. Save progress periodically and resume from checkpoints after restart.

**Using background services for real-time processing requirements** creates latency and reliability issues. Background services process work asynchronously with variable delays. When real-time or low-latency processing is required, handle work synchronously in the request pipeline or use dedicated real-time processing infrastructure.
