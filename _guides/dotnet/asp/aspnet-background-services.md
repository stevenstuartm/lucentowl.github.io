---
title: "Background Services and Job Processing"
layout: guide
category: "ASP.NET Core"
subcategory: "Testing & Operations"
description: "Running work outside the request in ASP.NET Core: hosted services and BackgroundService, startup order and what an unhandled exception does, scoped services per unit of work, queuing work from endpoints with a channel, graceful shutdown, separate worker services, and persistent jobs with Hangfire and Quartz.NET."
tags: [practical, background-services, hosted-services, job-scheduling, hangfire, quartz-net]
---

Some work doesn't belong in a request. A nightly cleanup has no request to belong to, and a slow report or an email send would keep the client waiting for work it doesn't need to wait on. ASP.NET Core runs this kind of work in *hosted services*, which live in the same process as the web app and share its configuration, logging, and dependency injection. The cost of that convenience is that the work lives and dies with the process, which decides when a hosted service is enough and when the work needs a separate worker or a persistent job library.

## Hosted Services

A hosted service implements `IHostedService`, whose two methods the host calls at the edges of the app's life. `StartAsync` runs when the app starts and `StopAsync` when it shuts down. Most background work derives from `BackgroundService` instead, an abstract implementation that calls one method, `ExecuteAsync`, when the service starts, and cancels the token passed to it when the service stops. The task `ExecuteAsync` returns represents the service's whole lifetime.

```csharp
public sealed class ExpiredSessionCleanup(
    IServiceScopeFactory scopeFactory,
    ILogger<ExpiredSessionCleanup> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));

        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var removed = await db.Sessions
                    .Where(s => s.ExpiresAt < DateTimeOffset.UtcNow)
                    .ExecuteDeleteAsync(stoppingToken);

                logger.LogInformation("Removed {Count} expired sessions", removed);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Session cleanup failed; retrying next tick");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

builder.Services.AddHostedService<ExpiredSessionCleanup>();
```

`AddHostedService` registers the service as a singleton, created once and kept for the app's lifetime. Each piece of the sample handles one of the ways such a service goes wrong: the scope, the `try`/`catch`, and the timer, which the following sections cover in turn. `PeriodicTimer` is the right default for periodic async work. Its loop can't overlap itself, and cancelling the token ends the wait, so the service stops promptly. Choosing between timers, and scheduling by wall-clock time rather than interval, are general .NET topics that apply here unchanged.

### Startup Order

The host starts hosted services one at a time, in registration order, and calls every `StartAsync` before it configures the request pipeline and starts the server. A slow `StartAsync` therefore delays the app's first request, and a failing one stops the app from starting at all. That makes `StartAsync` the place for short initialization the app shouldn't run without, and nowhere else. `HostOptions.ServicesStartConcurrently` starts them in parallel instead.

`BackgroundService.StartAsync` starts `ExecuteAsync` and returns without waiting for it. Before .NET 10, `ExecuteAsync` ran synchronously until its first `await`, so blocking code at the top of it held up every service registered after it and the server. Since .NET 10 it runs on the thread pool, and the host moves on at once.

{% include figure.html id="asp-hosted-service-lifetime" %}

### An Unhandled Exception Stops the Whole App

Since .NET 6, an exception that escapes `ExecuteAsync` is logged, and then the host stops, taking the web app down with it. That is the default `HostOptions.BackgroundServiceExceptionBehavior`, `StopHost`. Before .NET 6 the exception vanished and the service silently stopped working. Setting the behavior to `Ignore` restores that, which leaves a dead service in a running app.

A service whose failures are transient, such as a database that is briefly unavailable, catches exceptions per unit of work, as the sample does, logs them, and carries on with the next tick or message. The filter lets `OperationCanceledException` through, so shutdown isn't logged as a failure. An exception that means the service can't work at all, such as missing configuration, is better left to stop the host, where the platform's restart and alerting notice it. A service that keeps running while failing every iteration is invisible without monitoring, so a health check reporting its last successful run belongs with it.

## Scoped Services in a Hosted Service

A hosted service is a singleton, but much of what it needs is scoped, above all an EF Core `DbContext`. Injecting a scoped service into a singleton's constructor makes it a *captive dependency*, one instance held for the app's whole life. A `DbContext` held that way accumulates tracked entities and is used from whatever thread runs the loop. In Development, the container's scope validation throws when it detects this. In other environments that validation is off by default, so the captive instance is quietly created.

The standard pattern, which Microsoft's DI documentation recommends, is to inject `IServiceScopeFactory` and create a scope for each unit of work, such as one tick or one message. Everything resolved from the scope is disposed with it, as a request's services are disposed at the end of the request. `CreateAsyncScope` with `await using` disposes services that implement only `IAsyncDisposable`, which a synchronous `using` would throw on.

For EF Core alone, `IDbContextFactory<T>`, registered with `AddDbContextFactory`, is an alternative. The factory is a singleton that the service can inject directly, and each `CreateDbContextAsync()` call returns a new context for the caller to dispose. It fits a service whose only scoped dependency is the context. A service that uses repositories or other services built on the scoped context still needs a scope, so that they all share one context per unit of work.

## Periodic Work Across Instances

Every instance of the app runs every hosted service. Scaled out to three instances, the cleanup above runs three times every 15 minutes. For idempotent work that is merely wasteful. For work that sends email or charges cards, it is a bug.

There are three ways out. The work can be made safe to run concurrently, for example by claiming rows with an atomic update before processing them. It can move out of the web app into a single worker instance or a platform scheduler, such as a Kubernetes CronJob or a cloud function's timer trigger, that starts one run per occurrence. Or it can move to a job library that coordinates instances through shared storage, which the last sections cover.

## Queuing Work from Endpoints

An endpoint that starts slow work, such as generating a report or calling a slow third party, can queue it and return `202 Accepted` immediately. A `Channel<T>` makes the queue. Endpoints write to it, and a hosted service reads from it:

```csharp
public sealed record ReportRequest(int ReportId, string RequestedBy);

builder.Services.AddSingleton(_ => Channel.CreateBounded<ReportRequest>(
    new BoundedChannelOptions(capacity: 100) { FullMode = BoundedChannelFullMode.Wait }));
builder.Services.AddHostedService<ReportWorker>();

app.MapPost("/reports/{id:int}", async (int id, ClaimsPrincipal user,
    Channel<ReportRequest> queue, CancellationToken ct) =>
{
    await queue.Writer.WriteAsync(new ReportRequest(id, user.Identity!.Name!), ct);
    return Results.Accepted($"/reports/{id}");
});

public sealed class ReportWorker(
    Channel<ReportRequest> queue,
    IServiceScopeFactory scopeFactory,
    ILogger<ReportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var request in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var generator = scope.ServiceProvider.GetRequiredService<ReportGenerator>();
                await generator.GenerateAsync(request, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Report {ReportId} failed", request.ReportId);
            }
        }
    }
}
```

The queue carries data, not work. The endpoint copies what the job needs, here the report ID and user name, into the message, because the request's `HttpContext` and its scoped services, including its `DbContext`, are disposed as soon as the response is sent. A job that captures them in a lambda fails later with `ObjectDisposedException`, or worse, works in testing and fails under load. The worker creates its own scope per message for the same reason. Starting the work with `Task.Run` from the endpoint has the same problem, and adds that nothing waits for it at shutdown.

A bounded channel with `FullMode.Wait` applies backpressure. When 100 reports are waiting, the next endpoint call waits for space rather than growing memory without limit. Channel options beyond that, such as dropping items when full or allowing several readers, are general `System.Threading.Channels` mechanics.

The channel is memory, so everything in it is lost when the process stops, whether by deployment, a crash, or scaling in. Only one instance sees each message, too, because each instance has its own channel. That is acceptable for work a client can safely request again. Work that must happen needs a durable queue, such as a message broker or a persistent job library.

## Graceful Shutdown

When the app is told to stop, by a deployment, `Ctrl+C`, or an orchestrator's `SIGTERM`, the host raises `ApplicationStopping`, the server stops accepting connections and drains in-flight requests, and the hosted services are stopped in reverse registration order. For a `BackgroundService`, stopping means cancelling the `stoppingToken` and waiting for `ExecuteAsync` to return. The host waits up to `HostOptions.ShutdownTimeout`, 30 seconds by default, and abandons whatever is still running when it expires.

A service that passes the token to every await, as the samples do, stops within moments. One that ignores the token keeps running until the timeout, and its work is cut off wherever it happens to be. Work that can't finish in time needs to be interruptible: process items in small transactions and mark each one done, so a restarted service picks up where the last one stopped instead of redoing or losing work. Raising the timeout buys time, but only up to the platform's own limit. An orchestrator that kills the process after its grace period, 30 seconds by default in Kubernetes, ends it regardless of what the host wanted.

```csharp
builder.Services.Configure<HostOptions>(options =>
    options.ShutdownTimeout = TimeSpan.FromSeconds(60));   // also raise the platform's grace period
```

Some hosts stop the process on their own schedule. IIS shuts down an app pool after 20 idle minutes by default and recycles it periodically, and Azure App Service unloads idle apps unless Always On is enabled. A hosted service there stops when no requests arrive, which suits request-driven work and defeats a nightly job.

## Worker Services

When background work needs more CPU or memory than the web app can spare, has a different release cadence, or must scale separately, it moves to a *worker service*: a separate process built on the same generic host, without the web server. The `dotnet new worker` template starts one:

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHostedService<ReportWorker>();
builder.Services.AddWindowsService();   // or AddSystemd() on Linux; each does nothing outside a service manager

builder.Build().Run();
```

The hosted services, DI, configuration, and logging are identical, so code moves between the two hosts unchanged. What changes is how work arrives. A worker has no endpoints, so it reads from a queue, a database table, or a schedule. The web app's in-memory channel can't reach it, which usually means introducing a message broker. In exchange, a heavy job can't slow down requests, a crash takes down only the worker, and each side scales by its own measure, such as request rate for the web app and queue length for the worker.

## Persistent Jobs

An in-process queue loses work on restart, retries nothing, and shows no history. Job libraries store each job in a database, so it survives restarts, runs on whichever instance is free, and is retried on failure. The two established ones for .NET overlap but start from different ends. Hangfire is built around a job queue with scheduling added, and Quartz.NET around a scheduler with persistence added.

### Hangfire

[Hangfire](https://www.hangfire.io){:target="_blank" rel="noopener noreferrer"} stores jobs in SQL Server, Redis, PostgreSQL, or other storage, and its server component, running inside the web app or a worker, fetches and executes them. A job is a method call recorded as an expression:

```csharp
builder.Services.AddHangfire(config => config.UseSqlServerStorage(connectionString));
builder.Services.AddHangfireServer();

app.MapPost("/orders/{id:int}/confirm", (int id, IBackgroundJobClient jobs) =>
{
    jobs.Enqueue<OrderEmails>(emails => emails.SendConfirmationAsync(id, CancellationToken.None));
    return Results.Accepted();
});

app.Services.GetRequiredService<IRecurringJobManager>()
    .AddOrUpdate<SessionCleanup>("session-cleanup", job => job.RunAsync(CancellationToken.None), Cron.Hourly());

app.MapHangfireDashboard();   // local requests only unless authorization is configured
```

Hangfire serializes the method's arguments into storage, so a job takes an order ID rather than an order object, and the job loads fresh data when it runs. The `OrderEmails` instance is created from the DI container when the job executes, with its own scope. Hangfire replaces a `CancellationToken` argument with one that fires at shutdown. Beyond immediate jobs, it supports delayed jobs, recurring jobs on a cron schedule, and continuations that run after another job succeeds.

A job that throws is retried automatically, 10 times by default with growing delays, and then moves to the Failed state, where the dashboard can retry it by hand. Hangfire guarantees that a job runs at least once, not exactly once. A worker that dies mid-job, or a job that runs past its lock, can execute again elsewhere, so jobs have to be idempotent, for example by recording that the email was sent and checking before sending. The dashboard shows queued, running, failed, and succeeded jobs with their exceptions, and can trigger or delete them. It allows only local requests by default, and exposing it means adding an authorization filter.

### Quartz.NET

[Quartz.NET](https://www.quartz-scheduler.net){:target="_blank" rel="noopener noreferrer"} separates *jobs*, the work, from *triggers*, the schedule, so one job can have several triggers and a trigger can use calendars that exclude holidays or maintenance windows:

```csharp
builder.Services.AddQuartz(q =>
{
    var job = new JobKey("nightly-cleanup");
    q.AddJob<NightlyCleanupJob>(o => o.WithIdentity(job));
    q.AddTrigger(t => t.ForJob(job).WithCronSchedule("0 0 2 * * ?"));   // 02:00 every day
});
builder.Services.AddQuartzHostedService(o => o.WaitForJobsToComplete = true);

[DisallowConcurrentExecution]
public sealed class NightlyCleanupJob(AppDbContext db) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        await db.Sessions.Where(s => s.ExpiresAt < DateTimeOffset.UtcNow)
            .ExecuteDeleteAsync(context.CancellationToken);
    }
}
```

Quartz cron expressions start with a seconds field and use `?` for "no specific value" in the day-of-month or day-of-week field, so they aren't interchangeable with five-field Unix cron. `[DisallowConcurrentExecution]` keeps a slow run from overlapping the next trigger, and `WaitForJobsToComplete` makes shutdown wait for running jobs within the host's timeout.

By default Quartz keeps schedules in memory. With the ADO.NET job store and clustering enabled, several instances share one database, and each trigger fires on only one of them. If an instance dies mid-job, another re-runs the job only if the job was marked to request recovery. Clustered nodes need clocks synchronized to within a second, because they coordinate through timestamps in the database.

## Choosing an Approach

| Requirement | Approach |
|---|---|
| Periodic work, safe to run on every instance or run by one | `BackgroundService` with `PeriodicTimer` |
| Offload work from a request; losing it on restart is acceptable | `Channel<T>` read by a `BackgroundService` |
| Heavy or independently scaled work | A worker service fed by a durable queue |
| Work that must survive restarts, with retries and a dashboard | Hangfire |
| Rich schedules: calendars, many triggers per job, misfire rules | Quartz.NET with a persistent, clustered store |
| One run per occurrence across instances, with no library | A platform scheduler such as a Kubernetes CronJob |

The in-process options add no infrastructure and cost nothing to run, and the persistent ones add a database schema, polling, and something new to monitor. A job library pays for itself when lost or duplicated work has a cost, not merely because the work runs on a schedule.

## Key Takeaways

- A `BackgroundService` runs for the app's lifetime in the web process. Since .NET 6, an unhandled exception from `ExecuteAsync` stops the whole app, so catch per unit of work and let only fatal errors escape.
- Hosted services start in registration order before the server starts, and stop in reverse order within `ShutdownTimeout`, 30 seconds by default. Pass the stopping token everywhere.
- Hosted services are singletons. Create a scope per unit of work with `IServiceScopeFactory.CreateAsyncScope`, or use `IDbContextFactory<T>` when a `DbContext` is the only scoped dependency.
- Every instance runs every hosted service, so periodic work that must run once needs coordination, a single worker, a platform scheduler, or a job library.
- Queued work carries data, never the request's `HttpContext` or scoped services. An in-memory channel loses its contents on restart.
- Hangfire and Quartz.NET make jobs durable and coordinate them across instances. Hangfire retries failed jobs and guarantees at-least-once execution, so its jobs must be idempotent, and its dashboard needs authorization before it is exposed.
