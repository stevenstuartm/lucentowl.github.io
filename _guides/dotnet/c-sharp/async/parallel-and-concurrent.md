---
title: "C# Parallel and Concurrent Programming"
layout: guide
category: ".NET & C#"
subcategory: "Async Programming"
description: "Parallel processing, concurrent collections, thread synchronization, and CPU-bound work in C#."
tags: [c-sharp, dotnet, parallel, concurrency, threading, performance, practical]
---

## Async vs Parallel

Understanding when to use each approach is crucial.

| Scenario | Use | Reason |
|----------|-----|--------|
| HTTP calls, DB queries | async/await | I/O-bound, threads wait |
| Image processing | Parallel | CPU-bound, needs compute |
| File compression | Parallel | CPU-bound |
| Reading many files | async/await | I/O-bound |
| Complex calculations | Parallel | CPU-bound |

```csharp
// I/O-bound - use async
public async Task<IEnumerable<string>> DownloadAllAsync(IEnumerable<string> urls)
{
    var tasks = urls.Select(url => httpClient.GetStringAsync(url));
    return await Task.WhenAll(tasks);
}

// CPU-bound - use parallel
public IEnumerable<ProcessedImage> ProcessImages(IEnumerable<Image> images)
{
    return images.AsParallel()
        .Select(img => ProcessImage(img))
        .ToList();
}
```

## Parallel Class

Execute loops in parallel using multiple threads.

### Parallel.For

```csharp
// Process indices in parallel
Parallel.For(0, 100, i =>
{
    ProcessItem(i);
});

// With parallelism control
Parallel.For(0, 100,
    new ParallelOptions { MaxDegreeOfParallelism = 4 },
    i => ProcessItem(i));

// With local state for thread-safe accumulation
long total = 0;
Parallel.For(0, 1000,
    () => 0L, // Initialize local state per thread
    (i, state, localSum) => localSum + ComputeValue(i), // Process
    localSum => Interlocked.Add(ref total, localSum)); // Combine
```

### Parallel.ForEach

```csharp
var items = GetItems();

Parallel.ForEach(items, item =>
{
    ProcessItem(item);
});

// With options
var options = new ParallelOptions
{
    MaxDegreeOfParallelism = Environment.ProcessorCount,
    CancellationToken = cancellationToken
};

Parallel.ForEach(items, options, item =>
{
    options.CancellationToken.ThrowIfCancellationRequested();
    ProcessItem(item);
});

// Partitioned for better performance with large collections
var partitioner = Partitioner.Create(items, EnumerablePartitionerOptions.NoBuffering);
Parallel.ForEach(partitioner, item => ProcessItem(item));
```

### Breaking and Stopping

```csharp
Parallel.For(0, 1000, (i, state) =>
{
    if (FoundTarget(i))
    {
        // Stop - don't start new iterations, but finish running ones
        state.Stop();
        return;
    }

    // Break - stop at this index, complete lower indices
    if (ShouldBreak(i))
    {
        state.Break();
    }

    ProcessItem(i);
});
```

## PLINQ (Parallel LINQ)

Parallelize LINQ queries for CPU-bound operations.

### Basic PLINQ

```csharp
var numbers = Enumerable.Range(1, 1_000_000);

// Sequential
var sumSeq = numbers
    .Where(n => n % 2 == 0)
    .Select(n => n * n)
    .Sum();

// Parallel - just add AsParallel()
var sumPar = numbers
    .AsParallel()
    .Where(n => n % 2 == 0)
    .Select(n => n * n)
    .Sum();

// When order matters
var ordered = numbers
    .AsParallel()
    .AsOrdered() // Maintain source order
    .Where(n => IsPrime(n))
    .Take(100)
    .ToList();
```

### PLINQ Options

```csharp
var results = source
    .AsParallel()
    .WithDegreeOfParallelism(4)     // Limit threads
    .WithExecutionMode(ParallelExecutionMode.ForceParallelism)  // Always parallel
    .WithMergeOptions(ParallelMergeOptions.NotBuffered)  // Stream results
    .WithCancellation(cancellationToken)
    .Select(item => Process(item))
    .ToList();
```

### When PLINQ Helps

```csharp
// GOOD for PLINQ - expensive per-item operation
var processed = images
    .AsParallel()
    .Select(img => ResizeAndCompress(img))  // CPU-intensive
    .ToList();

// BAD for PLINQ - overhead exceeds benefit
var doubled = numbers
    .AsParallel()
    .Select(n => n * 2)  // Too simple
    .ToList();

// BAD - I/O bound (use async instead)
var contents = files
    .AsParallel()
    .Select(f => File.ReadAllText(f))  // I/O, not CPU
    .ToList();
```

## Concurrent Collections

Standard collections like `Dictionary<TKey, TValue>` and `List<T>` are not thread-safe. Reading from one thread while another writes causes corrupted state or exceptions. The `System.Collections.Concurrent` namespace provides collections designed for multi-threaded access without requiring external locking.

### ConcurrentDictionary

A thread-safe dictionary that allows multiple threads to read, add, and update entries simultaneously. Unlike wrapping a regular `Dictionary` in a `lock`, `ConcurrentDictionary` uses fine-grained locking internally so operations on different keys don't block each other. Use it when multiple threads need shared key-value lookup, such as caches, counters, or shared registries.

```csharp
var cache = new ConcurrentDictionary<string, Data>();

// Add or get
var value = cache.GetOrAdd("key", key => LoadData(key));

// Add or update
var updated = cache.AddOrUpdate(
    "key",
    key => CreateNew(key),           // Add factory
    (key, old) => UpdateExisting(old) // Update factory
);

// Thread-safe read
if (cache.TryGetValue("key", out var data))
{
    Process(data);
}

// Thread-safe remove
if (cache.TryRemove("key", out var removed))
{
    Cleanup(removed);
}

// Atomic update pattern
cache.AddOrUpdate("counter",
    _ => 1,
    (_, current) => current + 1);
```

### ConcurrentQueue and ConcurrentStack

`ConcurrentQueue<T>` is a thread-safe FIFO (first-in, first-out) collection, and `ConcurrentStack<T>` is its LIFO (last-in, first-out) counterpart. Both are lock-free internally, making them faster than manually locking a `Queue` or `Stack`. Use `ConcurrentQueue` for work distribution where order matters, like task queues or event pipelines. Use `ConcurrentStack` when you need most-recent-first processing, such as undo operations or depth-first traversals built across threads.

```csharp
var queue = new ConcurrentQueue<WorkItem>();

// Producer
queue.Enqueue(new WorkItem());

// Consumer
if (queue.TryDequeue(out var item))
{
    Process(item);
}

// ConcurrentStack - LIFO
var stack = new ConcurrentStack<int>();
stack.Push(1);
stack.PushRange(new[] { 2, 3, 4 });

if (stack.TryPop(out var value)) { }
if (stack.TryPeek(out var top)) { }
```

### ConcurrentBag

A "bag" is a data structure that accepts items with no ordering guarantees and allows duplicates, similar to tossing items into a physical bag. `ConcurrentBag<T>` is the thread-safe version of this concept in .NET. It exists because sometimes you genuinely don't care about order or uniqueness and just need a place for multiple threads to dump results. Internally, each thread gets its own local list, so adding and taking from the same thread avoids contention entirely. This makes it ideal for scatter-gather patterns like collecting results from `Parallel.ForEach` loops, where each thread processes items independently and deposits its own output. Avoid it when one thread produces and a different thread consumes, as that cross-thread stealing is slower than using a `ConcurrentQueue`.

```csharp
var bag = new ConcurrentBag<Result>();

Parallel.ForEach(items, item =>
{
    var result = Process(item);
    bag.Add(result);  // Thread-local storage optimization
});

var allResults = bag.ToArray();
```

### BlockingCollection

A wrapper around any `IProducerConsumerCollection<T>` (defaults to `ConcurrentQueue<T>`) that adds blocking and bounding capabilities. When bounded, producers block when the collection is full and consumers block when it's empty, which provides natural backpressure without manual signaling. Use it for classic producer-consumer patterns where you need to throttle producers or coordinate shutdown via `CompleteAdding()`. For new code targeting .NET Core or later, consider `System.Threading.Channels` as a more flexible and async-friendly alternative.

```csharp
using var collection = new BlockingCollection<WorkItem>(boundedCapacity: 100);

// Producer
Task.Run(() =>
{
    foreach (var item in GetItems())
    {
        collection.Add(item);  // Blocks if full
    }
    collection.CompleteAdding();
});

// Consumer
Task.Run(() =>
{
    foreach (var item in collection.GetConsumingEnumerable())
    {
        Process(item);  // Blocks if empty
    }
});

// With timeout
if (collection.TryAdd(item, TimeSpan.FromSeconds(5)))
{
    // Added successfully
}
```

## Thread Synchronization

### Choosing a Synchronization Primitive

Different primitives solve different problems. Choosing the wrong one leads to either poor performance or subtle bugs.

| Primitive | Use When | Trade-offs |
|-----------|----------|------------|
| `lock` | Simple mutual exclusion | Easy to use but blocks threads |
| `SemaphoreSlim` | Limiting concurrent access (e.g., max 5 connections) | More flexible than lock |
| `ReaderWriterLockSlim` | Many reads, few writes | Complexity for read-heavy scenarios |
| `Interlocked` | Simple numeric operations | Fastest, but limited to specific ops |
| Concurrent collections | Shared data structures | Thread-safe by design |

**Use `lock` when**:
- You need simple mutual exclusion
- The protected code is fast (no I/O, no async)
- Only one thread should execute the critical section at a time

**Use `SemaphoreSlim` when**:
- You need to limit concurrency (e.g., max 10 parallel HTTP calls)
- You need async-compatible synchronization
- You need to coordinate across async methods

**Use `ReaderWriterLockSlim` when**:
- Reads vastly outnumber writes
- Read operations don't modify shared state
- You can tolerate the added complexity

**Use `Interlocked` when**:
- You only need simple atomic operations (increment, compare-exchange)
- Maximum performance is critical
- You're implementing lock-free algorithms

**Prefer concurrent collections** over manually synchronizing regular collections.

### lock Statement

```csharp
private readonly object lockObj = new();
private int counter;

public void Increment()
{
    lock (lockObj)
    {
        counter++;
    }
}

// Don't lock on 'this' or Type objects
// BAD: lock (this)
// BAD: lock (typeof(MyClass))
```

### SemaphoreSlim

Limit concurrent access to a resource.

```csharp
private readonly SemaphoreSlim semaphore = new(maxCount: 3);

public async Task ProcessAsync(Item item)
{
    await semaphore.WaitAsync();
    try
    {
        await DoWorkAsync(item);
    }
    finally
    {
        semaphore.Release();
    }
}

// Process with limited concurrency
public async Task ProcessAllAsync(IEnumerable<Item> items)
{
    var tasks = items.Select(async item =>
    {
        await semaphore.WaitAsync();
        try
        {
            return await ProcessAsync(item);
        }
        finally
        {
            semaphore.Release();
        }
    });

    await Task.WhenAll(tasks);
}
```

### ReaderWriterLockSlim

Multiple readers or single writer.

```csharp
private readonly ReaderWriterLockSlim rwLock = new();
private Dictionary<string, string> data = new();

public string Read(string key)
{
    rwLock.EnterReadLock();
    try
    {
        return data.TryGetValue(key, out var value) ? value : null;
    }
    finally
    {
        rwLock.ExitReadLock();
    }
}

public void Write(string key, string value)
{
    rwLock.EnterWriteLock();
    try
    {
        data[key] = value;
    }
    finally
    {
        rwLock.ExitWriteLock();
    }
}
```

### Interlocked Operations

Atomic operations without locks.

```csharp
private long counter;

public void Increment() => Interlocked.Increment(ref counter);
public void Decrement() => Interlocked.Decrement(ref counter);
public void Add(long value) => Interlocked.Add(ref counter, value);
public long Read() => Interlocked.Read(ref counter);

// Compare and swap
private int state;

public bool TryTransition(int from, int to)
{
    return Interlocked.CompareExchange(ref state, to, from) == from;
}

// Exchange
public int GetAndReset()
{
    return Interlocked.Exchange(ref counter, 0);
}
```

## Task Parallel Library Patterns

### Task.Run for CPU-Bound Work

```csharp
// Offload CPU-bound work from UI thread
private async void Calculate_Click(object sender, EventArgs e)
{
    var result = await Task.Run(() =>
    {
        return ExpensiveCalculation();
    });

    DisplayResult(result);
}

// Don't wrap async methods in Task.Run
// BAD:
await Task.Run(async () => await httpClient.GetStringAsync(url));

// GOOD:
await httpClient.GetStringAsync(url);
```

### Continuation Tasks

```csharp
var task = GetDataAsync();

// Continue when task completes
var continuation = task.ContinueWith(t =>
{
    if (t.IsCompletedSuccessfully)
        Process(t.Result);
    else if (t.IsFaulted)
        HandleError(t.Exception);
});

// Prefer async/await over ContinueWith
var data = await GetDataAsync();
Process(data);
```

### TaskCompletionSource

Bridge between callback-based APIs and Task-based APIs.

```csharp
public Task<string> DownloadAsync(string url)
{
    var tcs = new TaskCompletionSource<string>();

    var client = new WebClient();
    client.DownloadStringCompleted += (s, e) =>
    {
        if (e.Cancelled)
            tcs.SetCanceled();
        else if (e.Error != null)
            tcs.SetException(e.Error);
        else
            tcs.SetResult(e.Result);
    };

    client.DownloadStringAsync(new Uri(url));

    return tcs.Task;
}
```

## Channels (Modern Producer-Consumer)

```csharp
using System.Threading.Channels;

// Bounded channel - blocks when full
var bounded = Channel.CreateBounded<Message>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait,
    SingleReader = false,
    SingleWriter = false
});

// Unbounded channel - never blocks writes
var unbounded = Channel.CreateUnbounded<Message>();

// Producer
public async Task ProduceAsync(ChannelWriter<Message> writer, CancellationToken ct)
{
    try
    {
        while (!ct.IsCancellationRequested)
        {
            var message = await GetNextMessageAsync(ct);
            await writer.WriteAsync(message, ct);
        }
    }
    finally
    {
        writer.Complete();
    }
}

// Consumer
public async Task ConsumeAsync(ChannelReader<Message> reader, CancellationToken ct)
{
    await foreach (var message in reader.ReadAllAsync(ct))
    {
        await ProcessMessageAsync(message);
    }
}

// Usage
var channel = Channel.CreateBounded<Message>(100);
var producerTask = ProduceAsync(channel.Writer, cts.Token);
var consumerTask = ConsumeAsync(channel.Reader, cts.Token);
await Task.WhenAll(producerTask, consumerTask);
```

## Thread-Safe Patterns

### Lazy Thread-Safe Initialization

```csharp
// Lazy<T> with thread safety
private readonly Lazy<ExpensiveObject> lazy =
    new Lazy<ExpensiveObject>(() => new ExpensiveObject());

public ExpensiveObject Instance => lazy.Value;

// Double-check locking (manual pattern)
private volatile ExpensiveObject? instance;
private readonly object lockObj = new();

public ExpensiveObject Instance
{
    get
    {
        if (instance == null)
        {
            lock (lockObj)
            {
                instance ??= new ExpensiveObject();
            }
        }
        return instance;
    }
}
```

### Immutable State Updates

```csharp
// Thread-safe state updates using immutable types
private ImmutableList<Item> items = ImmutableList<Item>.Empty;
private readonly object lockObj = new();

public void AddItem(Item item)
{
    lock (lockObj)
    {
        items = items.Add(item);
    }
}

// Or using Interlocked with compare-exchange
private ImmutableList<Item> items = ImmutableList<Item>.Empty;

public void AddItemLockFree(Item item)
{
    ImmutableList<Item> initial, updated;
    do
    {
        initial = items;
        updated = initial.Add(item);
    } while (Interlocked.CompareExchange(ref items, updated, initial) != initial);
}
```

## Common Pitfalls

### Race Conditions

```csharp
// BAD - race condition
private int counter;
public void Increment()
{
    counter++;  // Not atomic: read-modify-write
}

// GOOD - atomic increment
public void IncrementSafe()
{
    Interlocked.Increment(ref counter);
}
```

### Deadlocks

```csharp
// DEADLOCK potential - acquiring locks in different order
public void Method1()
{
    lock (lockA)
    {
        lock (lockB) { }  // Waits for B
    }
}

public void Method2()
{
    lock (lockB)
    {
        lock (lockA) { }  // Waits for A
    }
}

// SOLUTION - always acquire locks in same order
```

### Closure Capture in Loops

```csharp
// BAD - all tasks capture same variable
for (int i = 0; i < 10; i++)
{
    Task.Run(() => Console.WriteLine(i));  // Might print 10 ten times
}

// GOOD - capture copy
for (int i = 0; i < 10; i++)
{
    int captured = i;
    Task.Run(() => Console.WriteLine(captured));
}

// Or use foreach (captures correctly since C# 5)
foreach (var item in items)
{
    Task.Run(() => Process(item));  // OK
}
```

## Key Takeaways

**Use async for I/O, parallel for CPU**: Async frees threads during I/O waits. Parallel uses multiple threads for CPU work.

**Limit parallelism**: Don't spawn unlimited parallel tasks. Use `MaxDegreeOfParallelism` or semaphores.

**Prefer concurrent collections**: `ConcurrentDictionary` and friends are optimized for concurrent access.

**Lock minimally**: Hold locks for the shortest time possible. Consider lock-free alternatives.

**Use channels for producer-consumer**: Channels provide efficient, modern producer-consumer patterns.

**Test concurrent code carefully**: Race conditions are timing-dependent. Use stress testing and tools like thread sanitizers.
