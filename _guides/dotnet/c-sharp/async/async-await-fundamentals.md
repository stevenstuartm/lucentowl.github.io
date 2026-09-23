---
title: "C# Async/Await Fundamentals"
layout: guide
category: ".NET & C#"
subcategory: "Async & Concurrency"
description: "What await does to a method, where continuations run and why ConfigureAwait exists, why blocking on async code deadlocks or starves the thread pool, Task and ValueTask, exceptions and cancellation in async code, running operations concurrently, and the fire-and-forget and async void traps."
tags: [async, task, cancellation-tokens, configureawait, synchronization-context, valuetask, practical]
---

## Why Async

An I/O operation, such as a database query, an HTTP call, or a file read, spends almost all of its time waiting on something outside the process. A synchronous call holds a thread for that whole wait. An asynchronous call releases the thread and picks the work back up when the result arrives.

```csharp
// Synchronous: the calling thread is blocked until the file is read
public string LoadSettings() => File.ReadAllText("settings.json");

// Asynchronous: the thread is released while the read is in flight
public async Task<string> LoadSettingsAsync() =>
    await File.ReadAllTextAsync("settings.json");
```

Async doesn't make a single operation faster, and it isn't parallelism. It makes waiting cheap. A web server whose request handlers await their I/O can serve thousands of concurrent requests from a small thread pool, because a request that is waiting holds no thread at all. CPU-bound work gains nothing from `async`, since there is no wait to release a thread during.

## What await Does

The compiler rewrites an `async` method into a state machine. Every `await` is a point where the method may pause, and the code after it becomes a **continuation** that runs when the awaited operation completes.

```csharp
public async Task<Customer> GetCustomerAsync(int id)
{
    Log("starting");                                          // runs on the caller's thread
    var json = await httpClient.GetStringAsync($"/customers/{id}");
    return JsonSerializer.Deserialize<Customer>(json)!;       // runs later, as the continuation
}
```

Calling the method runs it **synchronously, on the caller's thread, up to the first `await` whose operation isn't already complete.** At that point the method registers its continuation and returns an incomplete `Task<Customer>` to the caller. The thread is then free. When the HTTP call finishes, the continuation runs, the method finishes, and the task completes with the result.

{% include figure.html id="dn-await-timeline" %}

Two consequences follow. If the awaited task is already complete, as with a cache hit, `await` doesn't pause at all and the method carries on synchronously. And the "pause" never blocks anything: there is no thread sitting in the method while it waits.

A chain of awaits is the same thing repeated. Each `await` in `ProcessOrderAsync` below releases the thread until that step completes:

```csharp
public async Task ProcessOrderAsync(Order order, CancellationToken ct)
{
    var customer = await GetCustomerAsync(order.CustomerId, ct);
    var inventory = await CheckInventoryAsync(order.Items, ct);
    var result = await SubmitOrderAsync(order, customer, inventory, ct);
    await SendConfirmationAsync(result, ct);
}
```

## Where the Continuation Runs

When an `await` pauses, it captures the current `SynchronizationContext`, if there is one, and schedules the continuation back onto it. Without one, the continuation runs on a thread-pool thread.

| Environment | Captured context | Where code after `await` runs |
| --- | --- | --- |
| WPF, WinForms, WinUI, .NET MAUI | The UI thread's context | Back on the UI thread, so it can touch controls |
| ASP.NET Core | None | Any thread-pool thread |
| Console apps, worker services | None | Any thread-pool thread |
| Classic ASP.NET (.NET Framework) | The request context | One request-bound thread at a time |

`ConfigureAwait(false)` tells an `await` not to capture the context, so the continuation can run on any thread-pool thread:

```csharp
public async Task<Report> BuildReportAsync(CancellationToken ct)
{
    var data = await FetchDataAsync(ct).ConfigureAwait(false);
    return Summarize(data);   // may run on a thread-pool thread, not the caller's context
}
```

**Use it in general-purpose library code.** A library doesn't know whether its caller has a UI context, and its continuations never need that context. Skipping the capture avoids a needless hop back to the UI thread, and it removes the library's part in the deadlock described next. **Don't use it in UI code that touches controls after the await**, since that code has to be back on the UI thread. In ASP.NET Core application code it makes no difference, because there is no context to capture.

.NET 8 added an overload that takes `ConfigureAwaitOptions` flags. `SuppressThrowing` awaits completion without rethrowing a failure, and it is valid only on a non-generic `Task`, since a `Task<T>` would have no result to return. `ForceYielding` always schedules the continuation asynchronously even when the task has already completed.

## Blocking on Async Code

Calling `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()` on an incomplete task blocks the current thread until the task finishes. That is called sync-over-async, and it fails in one of two ways.

**Deadlock under a single-threaded context.** On a UI thread, the blocking call holds the only thread that the context will run continuations on. The awaited operation completes and posts its continuation to that context, which can't run it because the thread is blocked waiting for that very continuation. Neither side can proceed.

```csharp
// On a UI thread: deadlocks
private void Button_Click(object sender, EventArgs e)
{
    var data = LoadAsync().Result;   // blocks the UI thread
}

private async Task<string> LoadAsync()
{
    await Task.Delay(100);           // continuation wants the UI thread
    return "done";
}
```

`ConfigureAwait(false)` inside `LoadAsync` would stop this particular deadlock, which is why libraries use it. It doesn't make blocking a good idea.

**Thread-pool starvation where there's no context.** ASP.NET Core can't deadlock this way, but each blocked request holds a thread-pool thread for the whole wait. Under load, the pool runs out of threads faster than it adds new ones, and requests queue behind blocked threads. Throughput collapses while CPU sits idle.

The fix for both is to await all the way up the call chain. When blocking is truly unavoidable, such as in a `Main` from before async `Main` existed, prefer `.GetAwaiter().GetResult()` over `.Result`: it rethrows the original exception, while `.Result` and `.Wait()` wrap it in an `AggregateException`.

## Task and Task&lt;T&gt;

`Task` represents an operation that will complete, and `Task<T>` one that will complete with a value. A task ends in one of three states: `RanToCompletion`, `Faulted` (it holds the exception), or `Canceled`.

```csharp
// Ready-made tasks, for methods that sometimes have the answer immediately
Task done = Task.CompletedTask;
Task<int> answer = Task.FromResult(42);
Task<string> failed = Task.FromException<string>(new InvalidOperationException());
Task cancelled = Task.FromCanceled(alreadyCancelledToken);   // the token must be cancelled
```

To expose a callback- or event-based API as a task, use `TaskCompletionSource<T>`. You hand out its `Task` and complete it when the callback fires:

```csharp
public static Task<Reading> NextReadingAsync(Sensor sensor)
{
    var tcs = new TaskCompletionSource<Reading>(TaskCreationOptions.RunContinuationsAsynchronously);
    sensor.ReadingAvailable += (_, reading) => tcs.TrySetResult(reading);
    return tcs.Task;
}
```

`RunContinuationsAsynchronously` stops awaiters' continuations from running inline inside the event handler that completed the task, which could otherwise run unrelated code on the sensor's thread.

## Return Types

### Task and Task&lt;T&gt;

The default. Return `Task` from an async method with no result and `Task<T>` from one with a result.

### ValueTask and ValueTask&lt;T&gt;

`ValueTask<T>` is a struct that holds either a result or a task. A method that usually completes synchronously, such as one that often hits a cache, can return its result with no `Task` allocation at all:

```csharp
public async ValueTask<int> GetCachedValueAsync(string key)
{
    if (cache.TryGetValue(key, out int value))
        return value;                        // synchronous path: no allocation

    value = await LoadFromDatabaseAsync(key);  // asynchronous path allocates as usual
    cache[key] = value;
    return value;
}
```

That saving comes with rules, because a `ValueTask` may be backed by a pooled object that gets reused once consumed:

- Await it **once**. Don't await the same `ValueTask` twice, or from two places concurrently.
- Don't read `.Result` or call `.GetAwaiter().GetResult()` unless `IsCompletedSuccessfully` is already true.
- If you need to store it, await it more than once, or combine it with `Task.WhenAll`, call `.AsTask()` first.

Return `ValueTask` when the synchronous path is common and the method is hot enough for the allocation to show up in a profile. Otherwise return `Task`, which has none of these restrictions.

### async void

An `async void` method can't be awaited, so the caller can't know when it finishes or observe its exceptions. An exception that escapes an `async void` method is rethrown on the captured `SynchronizationContext`, or on the thread pool when there is none, and **an unhandled exception on the thread pool terminates the process**.

It exists for event handlers, whose delegate signature requires `void`. Keep the handler thin and catch everything inside it:

```csharp
private async void SaveButton_Click(object sender, EventArgs e)
{
    try
    {
        await SaveAsync();
    }
    catch (Exception ex)
    {
        ShowError(ex);
    }
}
```

Anywhere else, return `Task`. A lambda passed where an `Action` is expected is also `async void`, so `list.ForEach(async x => await SaveAsync(x))` compiles, starts every save without awaiting any of them, and lets their exceptions crash the process.

## Exceptions in Async Methods

An exception thrown inside an `async` method, **even before its first `await`**, doesn't propagate out of the call. The compiler catches it and stores it in the returned task, which becomes `Faulted`, and the exception is rethrown where the task is awaited:

```csharp
public async Task SaveAsync(Order order)
{
    ArgumentNullException.ThrowIfNull(order);   // stored in the task, not thrown here
    await repository.SaveAsync(order);
}

Task pending = SaveAsync(null!);   // no exception yet
await pending;                     // ArgumentNullException thrown here
```

That delay is harmless when the caller awaits immediately, which is usually the case. When argument errors should surface at the call site even if the task is stored and awaited later, split the method into a non-async wrapper that validates and an async core that does the work:

```csharp
public Task SaveAsync(Order order)
{
    ArgumentNullException.ThrowIfNull(order);   // thrown at the call
    return SaveCoreAsync(order);

    async Task SaveCoreAsync(Order o) => await repository.SaveAsync(o);
}
```

`await` rethrows a faulted task's exception directly, not wrapped, so `catch` blocks name specific types as they would for synchronous code. For a task that failed more than once, such as one from `Task.WhenAll`, `await` rethrows only the first failure. The rest are available only through the task's `Exception` property.

## Returning a Task Without Awaiting It

A method whose last step is awaiting another task can return that task directly instead of being `async`. That skips building a state machine:

```csharp
public Task<string> ReadConfigAsync(string path) => File.ReadAllTextAsync(path);
```

It is safe only when nothing in the method needs to happen after the inner task completes. Two common cases break it:

```csharp
// Broken: the reader is disposed as soon as the method returns,
// before ReadToEndAsync has finished using it
public Task<string> ReadAllAsync(string path)
{
    using var reader = new StreamReader(path);
    return reader.ReadToEndAsync();
}

// Broken: the try only covers starting the operation, not its failure
public Task SaveSafelyAsync(Order order)
{
    try { return repository.SaveAsync(order); }
    catch (DbException) { return Task.CompletedTask; }   // misses exceptions stored in the task
}
```

Both need `async` and `await`, so that the `using` and the `try` span the whole operation. When in doubt, keep `async`. The saving from eliding it is small.

## Running Operations Concurrently

### Task.WhenAll

Awaiting operations one after another makes their latencies add up. Starting them all first and then awaiting them together makes the total roughly the latency of the slowest:

```csharp
public async Task<OrderSummary> GetOrderSummaryAsync(int orderId, CancellationToken ct)
{
    // Start all three; none is awaited yet
    Task<Order> orderTask = GetOrderAsync(orderId, ct);
    Task<Customer> customerTask = GetCustomerForOrderAsync(orderId, ct);
    Task<List<Item>> itemsTask = GetOrderItemsAsync(orderId, ct);

    await Task.WhenAll(orderTask, customerTask, itemsTask);

    // All complete: awaiting again returns immediately
    return new OrderSummary(await orderTask, await customerTask, await itemsTask);
}
```

Only start operations concurrently when they are independent and the resource behind them can take the load. Two queries on the same Entity Framework `DbContext` at once throw, because a `DbContext` doesn't support concurrent operations.

When the tasks come from a LINQ query, materialize them before awaiting. `Select` is lazy, and enumerating it a second time, for example in a `catch` block that inspects the failures, calls the method again and starts every operation over:

```csharp
Task<string>[] downloads = urls.Select(url => httpClient.GetStringAsync(url, ct)).ToArray();
Task<string[]> all = Task.WhenAll(downloads);

try
{
    string[] pages = await all;
}
catch
{
    foreach (var ex in all.Exception!.InnerExceptions)   // every failure, not just the first
        logger.LogError(ex, "Download failed");
    throw;
}
```

### Limiting Concurrency

`Task.WhenAll` over ten thousand items starts ten thousand operations at once, which can exhaust connections or trip a remote service's rate limit. `Parallel.ForEachAsync` (.NET 6) runs an async body over a collection with a cap on how many run at the same time:

```csharp
await Parallel.ForEachAsync(orders,
    new ParallelOptions { MaxDegreeOfParallelism = 8, CancellationToken = ct },
    async (order, token) => await ProcessOrderAsync(order, token));
```

A `SemaphoreSlim` shared across callers is the alternative when the limit has to span unrelated code paths.

### Task.WhenAny and Timeouts

`Task.WhenAny` completes when the first of its tasks does, and returns that task:

```csharp
Task<string> primary = httpClient.GetStringAsync(primaryUrl, ct);
Task<string> mirror = httpClient.GetStringAsync(mirrorUrl, ct);

Task<string> first = await Task.WhenAny(primary, mirror);
string data = await first;   // rethrows if the first to finish failed
```

The losing task keeps running. Nothing cancels it, and if it later fails nobody observes the exception. The same flaw sinks the old timeout idiom of racing an operation against `Task.Delay`. Prefer one of two approaches:

```csharp
// Stop waiting after a timeout (.NET 6): throws TimeoutException, operation keeps running
string result = await LoadAsync().WaitAsync(TimeSpan.FromSeconds(5));

// Actually stop the operation: give it a token that cancels itself
using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
cts.CancelAfter(TimeSpan.FromSeconds(5));
string result2 = await httpClient.GetStringAsync(url, cts.Token);
```

`WaitAsync` only stops the waiting. Cancellation stops the work, provided the operation honors the token, which is the better outcome whenever the API accepts one.

## Cancellation

Cancellation in .NET is cooperative. A `CancellationTokenSource` issues a `CancellationToken`, code that can stop checks the token or passes it on, and cancelling the source signals every holder of the token. Nothing is ever forcibly aborted.

### Accepting and Passing a Token

Accept a `CancellationToken` as the last parameter of any async method that does I/O or long work, and pass it to everything you call:

```csharp
public async Task<string> FetchAsync(string url, CancellationToken ct = default)
{
    using var response = await httpClient.GetAsync(url, ct);
    return await response.Content.ReadAsStringAsync(ct);
}

public async Task ProcessBatchAsync(IEnumerable<Item> items, CancellationToken ct)
{
    foreach (var item in items)
    {
        ct.ThrowIfCancellationRequested();   // check between units of work
        await ProcessItemAsync(item, ct);
    }
}
```

A method that stops early because of the token throws `OperationCanceledException`, often its subclass `TaskCanceledException`. A task that ends that way is in the `Canceled` state rather than `Faulted`.

### Creating Tokens

```csharp
using var cts = new CancellationTokenSource();
cts.Cancel();                                      // cancel now

using var timed = new CancellationTokenSource(TimeSpan.FromSeconds(30));
timed.CancelAfter(TimeSpan.FromMinutes(5));        // reset the deadline

// Cancelled when either input is: the request aborts, or the app shuts down
using var linked = CancellationTokenSource.CreateLinkedTokenSource(requestToken, shutdownToken);
```

Dispose a `CancellationTokenSource` you create. A timed or linked source registers a timer or callbacks that otherwise live on.

### Handling Cancellation

Catching `OperationCanceledException` and returning normally changes the meaning of the result. The task completes as `RanToCompletion`, so the caller sees success for work that never happened. Catch it only at the level that asked for the cancellation, and only when the token it cares about was the one cancelled:

```csharp
try
{
    await ProcessBatchAsync(items, stoppingToken);
}
catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
{
    // shutdown was requested: stop quietly
}
```

Anywhere below that level, let the exception propagate.

## Fire and Forget

Calling an async method without awaiting it starts the operation and throws away the only handle on its outcome:

```csharp
public async Task OnOrderPlacedAsync(Order order)
{
    SendConfirmationAsync(order);        // CS4014 warning: the call is not awaited
    _ = SendConfirmationAsync(order);    // discard: no warning, same behavior
    await AuditAsync(order);
}
```

The compiler raises CS4014 only inside an `async` method. The same call from a synchronous method compiles silently. If the task fails, nothing sees the exception. When the faulted task is eventually garbage collected, the runtime raises `TaskScheduler.UnobservedTaskException` and otherwise ignores it, so the process keeps running and the failure is simply lost. The discard `_ =` silences the compiler warning without changing any of that.

There are further hazards in a server. The request can finish while the forgotten task is still running, so anything scoped to the request, such as a `DbContext` from dependency injection, may be disposed underneath it. And a process shutting down doesn't wait for tasks it doesn't know about.

When work genuinely should outlive the caller, give it an owner: write it to a queue that a hosted background service drains, which gives the work a lifetime, a scope, error handling, and graceful shutdown. For a small in-process case, at least route the task through a method that observes its failure:

```csharp
public static async void Forget(this Task task, ILogger logger)
{
    try { await task; }
    catch (Exception ex) { logger.LogError(ex, "Background task failed"); }
}

SendConfirmationAsync(order).Forget(logger);
```

This is the rare deliberate `async void`: the method catches everything, so nothing escapes to crash the process, and every failure is logged instead of lost.

## Async Lazy Initialization

`Lazy<Task<T>>` starts an expensive async initialization on first use and shares the resulting task with every caller:

```csharp
public class ReferenceData
{
    private readonly Lazy<Task<Catalog>> catalog;

    public ReferenceData(ICatalogClient client) =>
        catalog = new Lazy<Task<Catalog>>(() => client.LoadCatalogAsync());

    public Task<Catalog> GetCatalogAsync() => catalog.Value;
}
```

The cached task is cached permanently, including when it fails. One transient error during the first load makes every later caller get the same exception. If the load can fail transiently, replace the `Lazy` on failure or use a caching layer with retry.

## Key Takeaways

**`await` releases the thread, it doesn't block it.** The method runs synchronously to its first incomplete `await`, returns a task, and resumes later as a continuation.

**Continuations return to the captured context.** Use `ConfigureAwait(false)` in library code. UI code that touches controls after an `await` needs the context.

**Don't block on async code.** `.Result` and `.Wait()` deadlock under a UI context and starve the thread pool on a server. Await all the way up.

**Exceptions live in the task.** Even argument validation before the first `await` throws only when the task is awaited, and `await` surfaces only the first of several failures.

**Start independent operations together.** `Task.WhenAll` turns summed latencies into the slowest one, and `Parallel.ForEachAsync` caps how many run at once.

**Cancellation is cooperative.** Accept a token, pass it on, and don't swallow `OperationCanceledException` below the level that requested it.

**Every task needs an owner.** An `async void` method or an unawaited task loses its exceptions or crashes the process. Give background work a queue and a hosted service.
