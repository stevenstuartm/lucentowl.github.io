---
title: "C# Timers and Scheduling"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Choosing between PeriodicTimer, System.Threading.Timer, and System.Timers.Timer: how each schedules ticks, overlaps work, handles exceptions, and stays alive; interval versus wall-clock scheduling across time zones and DST; testable time with TimeProvider; and debouncing and throttling."
tags: [periodictimer, system-threading-timer, timeprovider, scheduling, backgroundservice, debouncing, practical]
---

## The Timer Types

.NET has three general-purpose timers and a UI timer per desktop framework. They differ in how they deliver a tick, and that decides what happens when the work takes longer than the period, when the work throws, and when nothing references the timer.

| Timer | Delivers a tick as | Work overruns the period | Callback throws | Unreferenced timer |
|---|---|---|---|---|
| `PeriodicTimer` (.NET 6) | An `await` in your loop | Missed ticks collapse into one; never overlaps | Exception surfaces in your loop | Your loop holds it |
| `System.Threading.Timer` | A callback on a thread-pool thread | Callbacks overlap | **Process crashes** | Collected, and stops firing |
| `System.Timers.Timer` | An `Elapsed` event on a thread-pool thread | Handlers overlap | **Exception swallowed** | Keeps firing |
| `System.Windows.Forms.Timer`, WPF `DispatcherTimer` | An event on the UI thread | Never overlaps, since there's one UI thread | Handled like any other UI event handler | Framework-specific |

Every row was measured on .NET 10 except the UI timers. The two bold cells are the ones that cause incidents. A `System.Threading.Timer` callback that throws terminates the process like any unhandled exception on a thread-pool thread. A `System.Timers.Timer` handler that throws is caught and discarded by the timer, so a job can fail on every tick for months with nothing in the logs.

Resolution is limited by the operating system's timer tick. On a Windows test machine, both `Task.Delay(1)` and a 1 ms `PeriodicTimer` averaged about 10 ms per wait, so none of these timers suits sub-tick precision.

## PeriodicTimer

`PeriodicTimer` turns a timer into something you `await`, which makes a periodic job an ordinary loop:

```csharp
public sealed class PollingService(ILogger<PollingService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await PollAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Polling failed");
            }
        }
    }
}
```

Because the loop body runs to completion before the next `WaitForNextTickAsync`, two runs of the work can never overlap. The schedule itself doesn't pause for the work, though. Ticks stay on a fixed cadence measured from when the timer was created, and ticks that fall due while the work is running collapse into a single pending tick. With a 100 ms period and one run that took 350 ms, the measured ticks came at 110, 204, 569, 601, and 700 ms. The run that started at 204 ended around 555, the ticks due at 300, 400, and 500 became one tick at 569, and the cadence resumed at 600.

```
ms         0    100   200   300   400   500   600   700
due             |     |     |     |     |     |     |
tick            T     T                       T T   T
work                  [======= 350 ms =======]
                            300, 400, 500 missed -> one tick at 569
```

A few rules shape how the loop is written:

- **The first tick comes after one period**, not immediately. Run the work once before the loop if it should start at once.
- **`WaitForNextTickAsync` returns `false` after `Dispose`** and throws `OperationCanceledException` when its token is cancelled. The `when` filter above keeps cancellation from being logged as a failure. In a `BackgroundService`, the host treats that exception at shutdown as a normal stop.
- **Only one wait may be pending at a time.** A second concurrent call throws `InvalidOperationException`, so a `PeriodicTimer` belongs to exactly one loop.
- **`Period` can be changed while running** (.NET 8), which suits a poller that backs off when there's nothing to do.

Catch exceptions inside the loop. An exception that escapes `ExecuteAsync` ends the loop for good, and since .NET 6 the host's default response is to stop the whole application.

### Scoped Services Per Tick

A `BackgroundService` is a singleton, so it can't take scoped services such as a `DbContext` in its constructor. Create a scope for each run instead, so each tick gets fresh instances that are disposed when it ends:

```csharp
public sealed class DataSyncService(IServiceScopeFactory scopeFactory, ILogger<DataSyncService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using AsyncServiceScope scope = scopeFactory.CreateAsyncScope();
                var sync = scope.ServiceProvider.GetRequiredService<ISyncService>();
                await sync.SyncAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Sync failed");
            }
        }
    }
}
```

## System.Threading.Timer

The callback-based timer, and the one `System.Timers.Timer` wraps. It's the lightest option and the right one when the work is short and synchronous, or when many independent timers are needed:

```csharp
public sealed class CacheRefresher : IAsyncDisposable
{
    private readonly Timer _timer;

    public CacheRefresher()
    {
        _timer = new Timer(Refresh, state: null,
            dueTime: TimeSpan.Zero,              // First callback immediately
            period: TimeSpan.FromMinutes(5));
    }

    private void Refresh(object? state)
    {
        try
        {
            // Runs on a thread-pool thread
        }
        catch (Exception ex)
        {
            // Log it. An exception that escapes here crashes the process
        }
    }

    public ValueTask DisposeAsync() => _timer.DisposeAsync();
}
```

`Timeout.InfiniteTimeSpan` as the period makes a one-shot timer, and `Change` reschedules or pauses an existing one.

**Keep a reference.** The timer object is all that keeps the schedule alive. A timer created in a local and never stored is collected at the next GC and stops firing, with no error. That rarely shows up in development, where collections are infrequent, and then happens in production.

**Dispose with `DisposeAsync` when the callback must be finished.** `Dispose()` stops future callbacks and returns immediately, even if a callback is still running, so the callback can touch state after its owner considers it torn down. `DisposeAsync()` completes only after any running callback has returned.

### Overlapping Callbacks

The next callback is queued when the period elapses, whether or not the previous one has finished. With a 50 ms period and 300 ms of work, seven callbacks ran at once. When overlap is unacceptable, either skip ticks while one is running:

```csharp
private int _running;

private void OnTick(object? state)
{
    if (Interlocked.Exchange(ref _running, 1) == 1)
        return;   // Previous callback still running; skip this tick

    try
    {
        DoWork();
    }
    finally
    {
        Volatile.Write(ref _running, 0);
    }
}
```

or schedule the timer as a one-shot and call `_timer.Change(interval, Timeout.InfiniteTimeSpan)` at the end of each callback, which spaces runs by the interval measured from the end of the previous one. If the work is asynchronous, a `PeriodicTimer` loop avoids both workarounds.

## System.Timers.Timer

A wrapper over `System.Threading.Timer` that raises an `Elapsed` event, with `AutoReset` to choose repeating or one-shot and `Enabled`/`Start`/`Stop` to control it. Its one distinctive feature is `SynchronizingObject`: set it to a Windows Forms control and `Elapsed` is marshalled to that control's UI thread.

It carries two traps from the table. Exceptions thrown by `Elapsed` handlers are swallowed, so every handler needs its own `try`/`catch` that logs. And a started timer stays alive without a reference, so one that's never stopped runs until the process exits. `ElapsedEventArgs.SignalTime` is local time.

For new code, a `PeriodicTimer` loop is clearer for async work and `System.Threading.Timer` for callbacks. For UI updates, use the framework's own timer, which runs on the UI thread without marshalling.

## Interval Versus Wall-Clock Scheduling

Every timer above measures elapsed time: "every 15 minutes". A job that must run at a time on the clock, "every day at 02:30 in New York", can't use a 24-hour period. The period drifts from the clock as soon as the process restarts at a different time, and twice a year a day is 23 or 25 hours long. Compute the next occurrence in the target time zone instead, and wait until then:

```csharp
public static DateTimeOffset NextRun(DateTimeOffset now, TimeOnly at, TimeZoneInfo zone)
{
    DateTime localNow = TimeZoneInfo.ConvertTime(now, zone).DateTime;
    DateTime candidate = localNow.Date + at.ToTimeSpan();
    if (candidate <= localNow)
        candidate = candidate.AddDays(1);

    // A spring-forward day skips this wall-clock time; run at the first valid time after it
    while (zone.IsInvalidTime(candidate))
        candidate = candidate.AddMinutes(1);

    // For a time repeated by fall-back, GetUtcOffset assumes standard time, the later occurrence
    return new DateTimeOffset(candidate, zone.GetUtcOffset(candidate));
}
```

On 8 March 2026, 02:30 doesn't exist in New York, so the function returns 03:00 EDT. On 1 November 2026, 01:30 happens twice, and it returns the second one, at 01:30 EST. Whether a skipped or repeated time should run late, early, twice, or not at all is a business decision, and the code should make it deliberately rather than inherit it.

The service then waits for that instant:

```csharp
public sealed class NightlyReport(TimeProvider time, ILogger<NightlyReport> logger) : BackgroundService
{
    private static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            DateTimeOffset now = time.GetUtcNow();
            await Task.Delay(NextRun(now, new TimeOnly(2, 30), Zone) - now, time, stoppingToken);

            try
            {
                await GenerateReportAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Nightly report failed");
            }
        }
    }
}
```

`Task.Delay` accepts at most about 49.7 days (`uint.MaxValue - 1` milliseconds) and throws `ArgumentOutOfRangeException` beyond that, so a monthly or yearly schedule has to wait in shorter steps and recompute.

### What an In-Process Scheduler Can't Do

A timer in your process only runs while your process does, and runs once per process:

- **A missed run is lost.** If the app is down at 02:30, nothing runs until 02:30 the next day. Nothing records that the run was missed.
- **Every instance runs the job.** Scale to three instances and the nightly report is generated three times.
- **There's no history.** Which runs happened, how long they took, and which failed exist only in the logs.

When any of these matters, move the schedule out of the process. A platform scheduler, such as a Kubernetes CronJob, cron, or a cloud function's timer trigger, starts the job once per occurrence. A persistent job library such as [Quartz.NET](https://www.quartz-scheduler.net/){:target="_blank" rel="noopener noreferrer"} or [Hangfire](https://www.hangfire.io/){:target="_blank" rel="noopener noreferrer"} stores schedules and run history in a database, and can coordinate instances so each occurrence runs once.

## Testable Time with TimeProvider

Code that reads `DateTime.UtcNow` or creates timers directly can only be tested by actually waiting. `TimeProvider` (.NET 8) abstracts the clock and timer creation, and the time-aware APIs accept one:

| API | TimeProvider overload |
|---|---|
| Current time | `time.GetUtcNow()`, `time.GetLocalNow()` |
| Elapsed time | `time.GetTimestamp()`, `time.GetElapsedTime(start)` |
| Delay | `Task.Delay(delay, time, token)` |
| Periodic loop | `new PeriodicTimer(period, time)` |
| Callback timer | `time.CreateTimer(callback, state, dueTime, period)`, which returns an `ITimer` |
| Timeouts | `task.WaitAsync(timeout, time)`, `new CancellationTokenSource(delay, time)` |

Register `TimeProvider.System` in DI and inject `TimeProvider` wherever code reads the time or waits. A test then substitutes `FakeTimeProvider` from the `Microsoft.Extensions.TimeProvider.Testing` package and advances time explicitly, so a nightly job or a 15-minute poll runs in milliseconds.

## Debouncing and Throttling

Two time-based patterns control how often an action runs in response to a burst of events. **Debouncing** waits until the events stop and runs once, which suits a search box or a file watcher that fires several events per save. **Throttling** runs at most once per interval and drops the rest, which suits a progress report or a noisy alert.

A debouncer cancels the pending delay whenever a new call arrives, so only the last call in a burst survives the wait:

```csharp
public sealed class Debouncer(TimeSpan delay) : IDisposable
{
    private readonly Lock _gate = new();
    private CancellationTokenSource? _pending;

    public async Task RunAsync(Func<Task> action)
    {
        CancellationTokenSource cts = new();
        lock (_gate)
        {
            _pending?.Cancel();
            _pending?.Dispose();
            _pending = cts;
        }

        try
        {
            await Task.Delay(delay, cts.Token);
        }
        catch (OperationCanceledException)
        {
            return;   // A later call superseded this one
        }

        await action();
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _pending?.Cancel();
            _pending?.Dispose();
            _pending = null;
        }
    }
}
```

Five calls 20 ms apart with a 100 ms delay ran the action once. The lock matters because calls typically arrive from event handlers on different threads, and without it two calls can each replace the other's token and both run.

A throttle only needs the time of the last run. Measure it with a monotonic timestamp rather than `DateTime.UtcNow`, which jumps when the system clock is adjusted:

```csharp
public sealed class Throttle(TimeSpan interval, TimeProvider time)
{
    private readonly Lock _gate = new();
    private long _lastRun;
    private bool _hasRun;

    public bool TryRun(Action action)
    {
        lock (_gate)
        {
            long now = time.GetTimestamp();
            if (_hasRun && time.GetElapsedTime(_lastRun, now) < interval)
                return false;

            _lastRun = now;
            _hasRun = true;
        }

        action();
        return true;
    }
}
```

Throttling that must queue rather than drop, or allow bursts, or apply across callers, is rate limiting. The `System.Threading.RateLimiting` package provides token-bucket, fixed-window, and sliding-window limiters for that.

Retrying a failed operation after a delay is also a timing pattern, but it's a resilience policy, and belongs in a resilience pipeline with backoff, jitter, and a retry budget rather than in a hand-written loop around `Task.Delay`.

## Choosing a Timer

```
Must it run at a time on the clock, or survive restarts and scale-out?
├── Yes, survive restarts or run once across instances → platform scheduler or persistent job library
├── Yes, a clock time in one process                   → compute next occurrence, Task.Delay until then
└── No, a fixed interval
    ├── Updating UI                   → the UI framework's timer
    ├── Async work, one loop          → PeriodicTimer
    ├── Short synchronous callback    → System.Threading.Timer, with try/catch and a stored reference
    └── Once, after a delay           → Task.Delay
```

## Key Takeaways

**Prefer a `PeriodicTimer` loop for periodic async work.** It can't overlap itself, collapses missed ticks, and surfaces exceptions in your own code.

**Catch exceptions in every timer callback.** `System.Threading.Timer` crashes the process on an unhandled one, and `System.Timers.Timer` silently swallows it.

**Store `System.Threading.Timer` in a field.** An unreferenced one is collected and stops firing. Dispose with `DisposeAsync` when the callback must have finished.

**Schedule clock times in a time zone, not as a 24-hour period,** and decide what a skipped or repeated DST time should do.

**Move schedules out of the process** when missed runs, duplicate runs across instances, or run history matter.

**Inject `TimeProvider`** so time-dependent code can be tested with `FakeTimeProvider`.
