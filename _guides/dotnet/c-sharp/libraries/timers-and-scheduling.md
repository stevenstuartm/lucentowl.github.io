---
title: "C# Timers and Scheduling"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Timer types in .NET, periodic execution, and scheduling patterns for background work."
tags: [c-sharp, dotnet, timers, scheduling, async, background-tasks, practical]
---

## Timer Types Overview

.NET provides several timer implementations for different scenarios.

| Timer | Namespace | Best For |
|-------|-----------|----------|
| `System.Threading.Timer` | Threading | Lightweight, callback-based |
| `System.Timers.Timer` | Timers | Event-based, UI-friendly |
| `PeriodicTimer` | Threading | Modern async loops (.NET 6+) |
| `System.Windows.Forms.Timer` | WinForms | UI thread execution |
| `DispatcherTimer` | WPF | UI thread execution |

## PeriodicTimer (.NET 6+)

The modern choice for async periodic work.

```csharp
public class PollingService : BackgroundService
{
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await DoWorkAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // Log error, continue polling
            }
        }
    }
}
```

Benefits:
- Async-native design
- Clean cancellation support
- No callback threading issues
- Prevents overlapping executions

<div class="callout callout--tip">
<p class="callout__title">Preventing Overlapping Executions</p>
<p>PeriodicTimer waits for your work to complete before scheduling the next tick. System.Threading.Timer callbacks can overlap if work takes longer than the period, requiring manual guards.</p>
</div>

## System.Threading.Timer

Lightweight, callback-based timer for background work.

```csharp
public class CacheRefresher : IDisposable
{
    private readonly Timer _timer;

    public CacheRefresher()
    {
        // Parameters: callback, state, dueTime, period
        _timer = new Timer(
            callback: RefreshCache,
            state: null,
            dueTime: TimeSpan.Zero,        // Start immediately
            period: TimeSpan.FromMinutes(5) // Repeat every 5 minutes
        );
    }

    private void RefreshCache(object? state)
    {
        // Runs on thread pool thread
        // Beware: callbacks can overlap if work takes longer than period
    }

    public void Dispose()
    {
        _timer.Dispose();
    }
}
```

### Preventing Overlapping Callbacks

```csharp
private readonly Timer _timer;
private int _isRunning;

public void Start()
{
    _timer = new Timer(ExecuteCallback, null, TimeSpan.Zero, TimeSpan.FromSeconds(10));
}

private void ExecuteCallback(object? state)
{
    // Skip if previous execution is still running
    if (Interlocked.CompareExchange(ref _isRunning, 1, 0) == 1)
        return;

    try
    {
        DoWork();
    }
    finally
    {
        Interlocked.Exchange(ref _isRunning, 0);
    }
}
```

### One-Shot Timer

```csharp
// Execute once after delay
var timer = new Timer(
    _ => Console.WriteLine("Delayed execution"),
    null,
    dueTime: TimeSpan.FromSeconds(5),
    period: Timeout.InfiniteTimeSpan  // No repeat
);
```

## System.Timers.Timer

Event-based timer with SynchronizingObject support.

```csharp
public class MonitoringService : IDisposable
{
    private readonly System.Timers.Timer _timer;

    public MonitoringService()
    {
        _timer = new System.Timers.Timer(5000);  // 5 seconds
        _timer.Elapsed += OnTimerElapsed;
        _timer.AutoReset = true;  // Repeat (false for one-shot)
        _timer.Start();
    }

    private void OnTimerElapsed(object? sender, ElapsedEventArgs e)
    {
        // Runs on thread pool thread
        Console.WriteLine($"Tick at {e.SignalTime}");
    }

    public void Dispose()
    {
        _timer.Stop();
        _timer.Dispose();
    }
}
```

### UI Thread Execution

```csharp
// WinForms - marshal to UI thread
_timer.SynchronizingObject = this;  // Form instance

// Or use WindowsFormsSynchronizationContext
```

## Async Delay Patterns

### Simple Delay

```csharp
await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
```

### Retry with Delay

```csharp
public async Task<T> RetryWithDelayAsync<T>(
    Func<Task<T>> operation,
    int maxRetries = 3,
    TimeSpan? delay = null,
    CancellationToken ct = default)
{
    delay ??= TimeSpan.FromSeconds(1);

    for (int i = 0; i < maxRetries; i++)
    {
        try
        {
            return await operation();
        }
        catch when (i < maxRetries - 1)
        {
            await Task.Delay(delay.Value, ct);
        }
    }

    return await operation();  // Final attempt
}
```

### Exponential Backoff

```csharp
public async Task<T> RetryWithBackoffAsync<T>(
    Func<Task<T>> operation,
    int maxRetries = 5,
    CancellationToken ct = default)
{
    for (int i = 0; i < maxRetries; i++)
    {
        try
        {
            return await operation();
        }
        catch when (i < maxRetries - 1)
        {
            var delay = TimeSpan.FromSeconds(Math.Pow(2, i));
            await Task.Delay(delay, ct);
        }
    }

    return await operation();
}
```

## Background Services

### IHostedService

```csharp
public class TimedHostedService : IHostedService, IDisposable
{
    private Timer? _timer;
    private readonly ILogger<TimedHostedService> _logger;

    public TimedHostedService(ILogger<TimedHostedService> logger)
    {
        _logger = logger;
    }

    public Task StartAsync(CancellationToken ct)
    {
        _timer = new Timer(DoWork, null, TimeSpan.Zero, TimeSpan.FromMinutes(1));
        return Task.CompletedTask;
    }

    private void DoWork(object? state)
    {
        _logger.LogInformation("Timed work executing");
    }

    public Task StopAsync(CancellationToken ct)
    {
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    public void Dispose() => _timer?.Dispose();
}
```

### BackgroundService with PeriodicTimer

```csharp
public class DataSyncService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DataSyncService> _logger;

    public DataSyncService(
        IServiceScopeFactory scopeFactory,
        ILogger<DataSyncService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider
                    .GetRequiredService<ISyncService>();

                await syncService.SyncAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sync failed");
            }
        }
    }
}
```

## Scheduling Patterns

### Cron-Style with TimeSpan

```csharp
public class ScheduledTask : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var nextRun = GetNextRunTime(now);
            var delay = nextRun - now;

            await Task.Delay(delay, stoppingToken);
            await ExecuteTaskAsync(stoppingToken);
        }
    }

    private DateTime GetNextRunTime(DateTime from)
    {
        // Run at 2 AM daily
        var next = from.Date.AddDays(1).AddHours(2);
        return next <= from ? next.AddDays(1) : next;
    }
}
```

### Debouncing

```csharp
public class Debouncer : IDisposable
{
    private readonly TimeSpan _delay;
    private CancellationTokenSource? _cts;

    public Debouncer(TimeSpan delay)
    {
        _delay = delay;
    }

    public async Task ExecuteAsync(Func<Task> action)
    {
        _cts?.Cancel();
        _cts = new CancellationTokenSource();

        try
        {
            await Task.Delay(_delay, _cts.Token);
            await action();
        }
        catch (TaskCanceledException)
        {
            // Debounced
        }
    }

    public void Dispose() => _cts?.Dispose();
}

// Usage
var debouncer = new Debouncer(TimeSpan.FromMilliseconds(300));
await debouncer.ExecuteAsync(() => SearchAsync(query));
```

### Throttling

```csharp
public class Throttle
{
    private readonly TimeSpan _interval;
    private DateTime _lastExecution = DateTime.MinValue;
    private readonly object _lock = new();

    public Throttle(TimeSpan interval)
    {
        _interval = interval;
    }

    public bool TryExecute(Action action)
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            if (now - _lastExecution < _interval)
                return false;

            _lastExecution = now;
        }

        action();
        return true;
    }
}
```

## Choosing the Right Timer

<div class="comparison">
<div class="content-card content-card--accent">
<h4>PeriodicTimer (Preferred)</h4>
<ul>
<li>Async background loops</li>
<li>BackgroundService integration</li>
<li>Prevents overlapping work</li>
<li>.NET 6+ only</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>System.Threading.Timer</h4>
<ul>
<li>Fire-and-forget callbacks</li>
<li>Works on all .NET versions</li>
<li>Lightweight and fast</li>
<li>Requires overlap guards</li>
</ul>
</div>
</div>

| Scenario | Recommended Timer |
|----------|-------------------|
| Async background loop | `PeriodicTimer` |
| Fire-and-forget callback | `System.Threading.Timer` |
| UI updates | `DispatcherTimer` / `Forms.Timer` |
| Event-based with sync context | `System.Timers.Timer` |
| One-time delay | `Task.Delay` |
| Simple retry logic | `Task.Delay` with loop |

## Key Takeaways

**Use PeriodicTimer for async loops**: It's the modern, clean approach for periodic background work in .NET 6+.

**Prevent overlapping executions**: Callbacks can overlap if work exceeds the period. Use guards or PeriodicTimer.

**Always dispose timers**: Timers hold resources and can cause memory leaks if not disposed.

**Use BackgroundService for hosted apps**: Integrates with the host lifecycle and dependency injection.

**Task.Delay for simple scenarios**: For one-time delays or simple retry logic, Task.Delay is sufficient.

**Consider cancellation**: Always support cancellation tokens for graceful shutdown.
