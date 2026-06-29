---
title: "C# Async/Await Fundamentals"
layout: guide
category: ".NET & C#"
subcategory: "Async Programming"
description: "Asynchronous programming with async/await, Task-based patterns, cancellation, and best practices for I/O-bound operations."
tags: [c-sharp, dotnet, async, concurrency, task, performance, practical]
---

## Why Async

Asynchronous programming enables non-blocking I/O operations. While waiting for a database query, HTTP request, or file read, the thread can do other work instead of sitting idle.

```csharp
// Synchronous - blocks thread while waiting
public string GetData()
{
    var response = httpClient.GetString("https://api.example.com"); // Thread blocked
    return response;
}

// Asynchronous - thread freed while waiting
public async Task<string> GetDataAsync()
{
    var response = await httpClient.GetStringAsync("https://api.example.com"); // Thread freed
    return response;
}
```

**Key insight**: Async isn't about parallelism or making things faster. It's about freeing threads to handle other requests while waiting for I/O. A web server using async can handle thousands of concurrent requests with a small thread pool.

## Task and Task<T>

`Task` represents an asynchronous operation. `Task<T>` represents an operation that returns a value.

```csharp
// Task - no return value
public Task SaveDataAsync(string data)
{
    return File.WriteAllTextAsync("data.txt", data);
}

// Task<T> - returns a value
public Task<string> LoadDataAsync()
{
    return File.ReadAllTextAsync("data.txt");
}

// Creating completed tasks
Task completedTask = Task.CompletedTask;
Task<int> resultTask = Task.FromResult(42);
Task<string> failedTask = Task.FromException<string>(new Exception("Failed"));

// Creating a task from a canceled token
Task canceledTask = Task.FromCanceled(canceledToken);
```

## async and await

The `async` modifier enables `await` in a method. `await` pauses execution until the awaited task completes, without blocking the thread.

```csharp
public async Task<Customer> GetCustomerAsync(int id)
{
    // Execution pauses here, thread returns to pool
    var json = await httpClient.GetStringAsync($"/customers/{id}");

    // Execution resumes when HTTP call completes
    return JsonSerializer.Deserialize<Customer>(json);
}

// Multiple sequential awaits
public async Task ProcessOrderAsync(Order order)
{
    var customer = await GetCustomerAsync(order.CustomerId);
    var inventory = await CheckInventoryAsync(order.Items);
    var result = await SubmitOrderAsync(order, customer, inventory);
    await SendConfirmationAsync(result);
}
```

## Return Types

### Task and Task<T>

Standard return types for async methods.

```csharp
// Return Task when no value returned
public async Task SaveAsync()
{
    await repository.SaveChangesAsync();
}

// Return Task<T> when returning a value
public async Task<int> CountAsync()
{
    return await repository.CountAsync();
}
```

### ValueTask and ValueTask<T>

Optimization for methods that often complete synchronously.

```csharp
public async ValueTask<int> GetCachedValueAsync(string key)
{
    // Synchronous path - no allocation
    if (cache.TryGetValue(key, out int value))
        return value;

    // Async path - allocates Task
    value = await LoadFromDatabaseAsync(key);
    cache[key] = value;
    return value;
}
```

**Use ValueTask when**:
- The operation often completes synchronously (cache hits)
- Called in high-throughput scenarios
- The allocation overhead of Task matters

**Constraints**:
- Can only be awaited once
- Cannot use `.Result` or `.Wait()`
- Cannot store and await later

### async void (Avoid)

Only for event handlers. Cannot be awaited, exceptions can crash the process.

```csharp
// BAD - exceptions crash the process
private async void Button_Click(object sender, EventArgs e)
{
    await ProcessAsync(); // If this throws, app crashes
}

// BETTER - wrap in try-catch
private async void Button_Click(object sender, EventArgs e)
{
    try
    {
        await ProcessAsync();
    }
    catch (Exception ex)
    {
        HandleError(ex);
    }
}
```

## Concurrent Execution

### Task.WhenAll

Run multiple tasks concurrently and wait for all to complete.

```csharp
public async Task<OrderSummary> GetOrderSummaryAsync(int orderId)
{
    // Start all tasks
    var orderTask = GetOrderAsync(orderId);
    var customerTask = GetCustomerAsync(orderId);
    var itemsTask = GetOrderItemsAsync(orderId);

    // Wait for all to complete
    await Task.WhenAll(orderTask, customerTask, itemsTask);

    return new OrderSummary
    {
        Order = orderTask.Result,
        Customer = customerTask.Result,
        Items = itemsTask.Result
    };
}

// Or with tuple deconstruction
public async Task<(Order, Customer)> GetOrderWithCustomerAsync(int id)
{
    var orderTask = GetOrderAsync(id);
    var customerTask = GetCustomerAsync(id);

    await Task.WhenAll(orderTask, customerTask);

    return (await orderTask, await customerTask);
}

// Processing a collection concurrently
public async Task ProcessAllAsync(IEnumerable<Order> orders)
{
    var tasks = orders.Select(o => ProcessOrderAsync(o));
    await Task.WhenAll(tasks);
}
```

### Task.WhenAny

Wait for the first task to complete.

```csharp
public async Task<string> GetFastestResponseAsync()
{
    var task1 = httpClient.GetStringAsync("https://server1.com/data");
    var task2 = httpClient.GetStringAsync("https://server2.com/data");

    var firstCompleted = await Task.WhenAny(task1, task2);
    return await firstCompleted;
}

// Timeout pattern
public async Task<string?> GetWithTimeoutAsync(string url, TimeSpan timeout)
{
    var dataTask = httpClient.GetStringAsync(url);
    var timeoutTask = Task.Delay(timeout);

    var completed = await Task.WhenAny(dataTask, timeoutTask);

    if (completed == timeoutTask)
        return null; // Timed out

    return await dataTask;
}
```

## Cancellation

### CancellationToken

Pass cancellation tokens to async methods to enable cancellation.

```csharp
public async Task<string> FetchDataAsync(string url, CancellationToken cancellationToken)
{
    // Pass token to underlying operations
    var response = await httpClient.GetAsync(url, cancellationToken);
    var content = await response.Content.ReadAsStringAsync(cancellationToken);
    return content;
}

// Check for cancellation in loops
public async Task ProcessBatchAsync(IEnumerable<Item> items, CancellationToken cancellationToken)
{
    foreach (var item in items)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await ProcessItemAsync(item, cancellationToken);
    }
}
```

### CancellationTokenSource

Create and control cancellation tokens.

```csharp
// Basic usage
using var cts = new CancellationTokenSource();

// Cancel manually
cts.Cancel();

// Cancel after timeout
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

// Or
cts.CancelAfter(TimeSpan.FromMinutes(5));

// Link multiple tokens
using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    requestToken,
    applicationToken);
```

### Handling Cancellation

```csharp
public async Task ProcessAsync(CancellationToken cancellationToken)
{
    try
    {
        await LongRunningOperationAsync(cancellationToken);
    }
    catch (OperationCanceledException)
    {
        // Clean up if needed
        logger.LogInformation("Operation was cancelled");
    }
}

// Pattern for graceful shutdown
public class Worker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessWorkAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normal shutdown, not an error
                break;
            }
        }
    }
}
```

## Error Handling

### try-catch with await

```csharp
public async Task<Result> ProcessAsync()
{
    try
    {
        var data = await FetchDataAsync();
        return await ProcessDataAsync(data);
    }
    catch (HttpRequestException ex)
    {
        logger.LogError(ex, "HTTP request failed");
        return Result.Failure("Network error");
    }
    catch (JsonException ex)
    {
        logger.LogError(ex, "Invalid response format");
        return Result.Failure("Invalid data");
    }
}
```

### Multiple Task Exceptions

When using `Task.WhenAll`, all exceptions are captured.

```csharp
public async Task ProcessAllAsync(IEnumerable<string> urls)
{
    var tasks = urls.Select(url => httpClient.GetStringAsync(url));

    try
    {
        await Task.WhenAll(tasks);
    }
    catch
    {
        // Single catch, but examine all failures
        foreach (var task in tasks.Where(t => t.IsFaulted))
        {
            logger.LogError(task.Exception, "Request failed");
        }
    }
}
```

## Common Patterns

### Async Lazy Initialization

```csharp
public class DataService
{
    private readonly AsyncLazy<ExpensiveData> data;

    public DataService()
    {
        data = new AsyncLazy<ExpensiveData>(() => LoadDataAsync());
    }

    public async Task<ExpensiveData> GetDataAsync()
    {
        return await data.Value;
    }
}

// Simple AsyncLazy implementation
public class AsyncLazy<T>
{
    private readonly Lazy<Task<T>> lazy;

    public AsyncLazy(Func<Task<T>> factory)
    {
        lazy = new Lazy<Task<T>>(factory);
    }

    public Task<T> Value => lazy.Value;
}
```

### Retry Pattern

```csharp
public async Task<T> RetryAsync<T>(
    Func<Task<T>> operation,
    int maxRetries = 3,
    TimeSpan? delay = null)
{
    var attempts = 0;
    while (true)
    {
        try
        {
            return await operation();
        }
        catch (Exception ex) when (attempts < maxRetries)
        {
            attempts++;
            logger.LogWarning(ex, "Attempt {Attempt} failed, retrying...", attempts);

            if (delay.HasValue)
                await Task.Delay(delay.Value);
        }
    }
}

// Usage
var result = await RetryAsync(
    () => httpClient.GetStringAsync(url),
    maxRetries: 3,
    delay: TimeSpan.FromSeconds(1));
```

### Semaphore for Throttling

```csharp
public class ThrottledProcessor
{
    private readonly SemaphoreSlim semaphore;

    public ThrottledProcessor(int maxConcurrency)
    {
        semaphore = new SemaphoreSlim(maxConcurrency);
    }

    public async Task ProcessAllAsync(IEnumerable<Item> items)
    {
        var tasks = items.Select(item => ProcessWithThrottleAsync(item));
        await Task.WhenAll(tasks);
    }

    private async Task ProcessWithThrottleAsync(Item item)
    {
        await semaphore.WaitAsync();
        try
        {
            await ProcessItemAsync(item);
        }
        finally
        {
            semaphore.Release();
        }
    }
}
```

### Channel for Producer-Consumer

```csharp
using System.Threading.Channels;

public class MessageProcessor
{
    private readonly Channel<Message> channel;

    public MessageProcessor()
    {
        channel = Channel.CreateBounded<Message>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.Wait
        });
    }

    public async Task ProduceAsync(Message message, CancellationToken ct)
    {
        await channel.Writer.WriteAsync(message, ct);
    }

    public async Task ConsumeAsync(CancellationToken ct)
    {
        await foreach (var message in channel.Reader.ReadAllAsync(ct))
        {
            await ProcessMessageAsync(message);
        }
    }
}
```

## Best Practices

### Do's

```csharp
// DO use async all the way
public async Task<Order> GetOrderAsync(int id)
{
    var data = await repository.GetAsync(id);
    return await TransformAsync(data);
}

// DO use ConfigureAwait(false) in library code
public async Task<string> LibraryMethodAsync()
{
    var data = await FetchDataAsync().ConfigureAwait(false);
    return await ProcessAsync(data).ConfigureAwait(false);
}

// DO pass CancellationToken
public async Task ProcessAsync(CancellationToken cancellationToken = default)
{
    await DoWorkAsync(cancellationToken);
}

// DO use ValueTask for hot paths that often complete sync
public ValueTask<int> GetCachedAsync(string key)
{
    if (cache.TryGetValue(key, out var value))
        return new ValueTask<int>(value);
    return new ValueTask<int>(LoadAsync(key));
}
```

### Don'ts

```csharp
// DON'T block on async code (causes deadlocks)
var result = GetDataAsync().Result;  // BAD
var result = GetDataAsync().GetAwaiter().GetResult();  // Still bad

// DON'T use async void except for event handlers
public async void BadMethod() { }  // BAD

// DON'T mix blocking and async unnecessarily
public async Task BadMixAsync()
{
    Thread.Sleep(1000);  // BAD - use await Task.Delay
    var data = httpClient.GetString(url);  // BAD - use GetStringAsync
}

// DON'T ignore tasks
public void FireAndForget()
{
    DoWorkAsync();  // BAD - task ignored, exceptions lost
}

// Instead
_ = DoWorkAsync().ContinueWith(t =>
    logger.LogError(t.Exception, "Background task failed"),
    TaskContinuationOptions.OnlyOnFaulted);
```

## Async Streams (C# 8.0)

For asynchronously producing sequences of values.

```csharp
public async IAsyncEnumerable<int> GenerateSequenceAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    for (int i = 0; i < 100; i++)
    {
        await Task.Delay(100, cancellationToken);
        yield return i;
    }
}

// Consuming
await foreach (var item in GenerateSequenceAsync())
{
    Console.WriteLine(item);
}

// With cancellation
var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
await foreach (var item in GenerateSequenceAsync(cts.Token))
{
    Process(item);
}
```

## Key Takeaways

**Async is about I/O, not parallelism**: Use async for I/O-bound operations (network, disk). Use parallel processing for CPU-bound work.

**Async all the way**: Once you go async, stay async. Don't mix `.Result` or `.Wait()` with async code.

**Always pass CancellationToken**: Enable callers to cancel long-running operations.

**Use Task.WhenAll for concurrent I/O**: Running multiple I/O operations concurrently improves throughput.

**Avoid async void**: Only use for event handlers. Prefer returning Task.

**Configure await in libraries**: Use `ConfigureAwait(false)` in library code to avoid capturing synchronization context.
