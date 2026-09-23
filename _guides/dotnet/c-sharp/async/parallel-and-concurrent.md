---
title: "C# Parallel and Concurrent Programming"
layout: guide
category: ".NET & C#"
subcategory: "Async & Concurrency"
description: "Running CPU-bound work on many cores in .NET: how the thread pool schedules work, Task.Run, the Parallel class and partitioning, PLINQ and when it pays off, and the concurrent collections that let threads share data safely, including the ConcurrentDictionary factory trap."
tags: [parallel, plinq, thread-pool, concurrent-collections, concurrentdictionary, concurrency, practical]
---

## Parallel Work Is for the CPU

Async code releases a thread while it waits for I/O. Parallel code does the opposite: it keeps several threads busy at once so that CPU-bound work, such as image processing, compression, parsing, or numeric computation, finishes sooner on a multi-core machine.

| Workload | Tool | Why |
| --- | --- | --- |
| HTTP calls, database queries, file reads | `async`/`await` | The time is spent waiting, so the goal is to hold no thread while waiting |
| Resizing images, hashing files, heavy calculation | `Parallel`, PLINQ, `Task.Run` | The time is spent computing, so the goal is to use more cores |
| Many I/O calls with a concurrency cap | `Parallel.ForEachAsync` | Async bodies, parallel scheduling |

Parallelism has a cost that async doesn't: every work item pays for scheduling and coordination, and threads contend for shared memory and caches. It pays off when each item does enough work to dwarf that overhead and the items are independent.

## The Thread Pool

Almost everything in this guide runs on the .NET thread pool, a process-wide set of worker threads that the runtime creates, reuses, and sizes on its own. Creating a thread per work item would cost far more than most items take to run, so work is queued and picked up by whichever pool thread is free.

```
                 ┌──────────────── global queue (FIFO) ◀── work queued from non-pool threads
                 │
   worker 1      │ worker 2              worker 3
 [local queue] ◀─┴─▶ [local queue]        [local queue]  ◀── work queued by a pool thread
      ▲                   │                    ▲             goes to that thread's own queue
      └──── steals ───────┘                    │
                          idle workers steal from others' local queues
```

Each worker takes work from its own local queue first, most recent item first, which keeps related data warm in that core's cache. When its queue is empty it takes from the global queue, and then steals from other workers' queues. This work stealing is what keeps all cores busy when items vary in size.

The pool's minimum worker count defaults to the number of logical processors, and it creates threads up to that minimum on demand. Above the minimum it adjusts the count as it measures throughput and adds threads only gradually, which is why code that blocks pool threads, such as synchronous waits on I/O, degrades a server long before CPU is exhausted.

### Task.Run

`Task.Run` queues a delegate to the pool and returns a task for its result. Its main job is moving CPU-bound work off a thread that must stay responsive, such as a UI thread:

```csharp
private async void Calculate_Click(object sender, EventArgs e)
{
    var result = await Task.Run(() => ExpensiveCalculation());   // runs on a pool thread
    DisplayResult(result);                                       // back on the UI thread
}
```

Two uses of `Task.Run` gain nothing:

```csharp
// Wrapping async I/O: the inner call already releases its thread
await Task.Run(async () => await httpClient.GetStringAsync(url));   // pointless
await httpClient.GetStringAsync(url);                               // same result, no extra hop

// In an ASP.NET Core request: the request is already on a pool thread,
// so this only moves the work to another pool thread and back
var total = await Task.Run(() => ComputeTotal(order));
```

For work that occupies a thread for minutes or for the life of the process, such as a dedicated polling loop, pass `TaskCreationOptions.LongRunning` to `Task.Factory.StartNew`. The default scheduler then gives it its own thread rather than tying up a pool thread indefinitely.

## The Parallel Class

`Parallel.For` and `Parallel.ForEach` run a loop body across pool threads and return when every iteration has finished. The calling thread takes part in the work too.

### Parallel.For and Parallel.ForEach

```csharp
Parallel.For(0, images.Length, i => images[i] = Resize(images[i]));

Parallel.ForEach(files, file => HashFile(file));

var options = new ParallelOptions
{
    MaxDegreeOfParallelism = Environment.ProcessorCount,
    CancellationToken = cancellationToken
};
Parallel.ForEach(files, options, file => HashFile(file));
```

The loop checks the `CancellationToken` between iterations and throws `OperationCanceledException` when it is cancelled, so the body only needs to check it itself if a single iteration runs for a long time. If any iteration throws, the loop stops starting new ones and throws an `AggregateException` holding every failure once the running iterations finish.

`MaxDegreeOfParallelism` caps how many iterations run at once. Leave it unset for purely CPU-bound work, where the scheduler already matches the core count, and set it when the body touches a limited resource such as a database or disk.

### Accumulating Results Without Contention

Writing every iteration's result into one shared variable makes the threads contend for it. The `localInit`/`localFinally` overload gives each worker its own running total and merges the totals once per worker at the end:

```csharp
long total = 0;
Parallel.For(0, 1_000_000,
    () => 0L,                                          // each worker's starting subtotal
    (i, state, subtotal) => subtotal + Score(i),       // runs per iteration, no sharing
    subtotal => Interlocked.Add(ref total, subtotal)); // runs once per worker
```

### Stopping Early

The body can take a `ParallelLoopState` to end the loop early:

```csharp
Parallel.For(0, candidates.Length, (i, state) =>
{
    if (IsMatch(candidates[i]))
        state.Stop();   // start no more iterations; running ones finish
});
```

`Stop` abandons the rest of the loop and suits "find any match." `Break` is the ordered variant: iterations with an index lower than the one that called `Break` still run, and higher ones don't start, which suits "find the first match."

### Partitioning

Before running, the `Parallel` class splits the input into chunks for the workers. For an array or list it hands out index ranges. For a plain `IEnumerable<T>` it can't index, so workers pull items in chunks that grow as the loop proceeds. Two situations call for choosing the partitioning yourself:

```csharp
// Tiny bodies: one delegate call per element costs more than the work.
// Range partitioning gives each worker a block of indices to loop over directly.
Parallel.ForEach(Partitioner.Create(0, values.Length, rangeSize: 10_000), range =>
{
    for (int i = range.Item1; i < range.Item2; i++)
        values[i] = Math.Sqrt(values[i]);
});

// A slow or streaming source: take items one at a time instead of
// buffering chunks, trading some throughput for lower latency per item
Parallel.ForEach(
    Partitioner.Create(ReadMessages(), EnumerablePartitionerOptions.NoBuffering),
    message => Handle(message));
```

### Parallel.ForEachAsync

`Parallel.ForEachAsync` (.NET 6) takes an async body, which makes it the tool for running many I/O operations with a cap on how many are in flight:

```csharp
await Parallel.ForEachAsync(urls,
    new ParallelOptions { MaxDegreeOfParallelism = 10, CancellationToken = ct },
    async (url, token) => await DownloadAsync(url, token));
```

Unlike `Parallel.ForEach`, its default degree of parallelism is the processor count even for I/O work, so set `MaxDegreeOfParallelism` to what the remote side can handle.

## PLINQ

PLINQ runs a LINQ-to-Objects query in parallel. `AsParallel()` switches the rest of the query to parallel operators:

```csharp
var squares = numbers
    .AsParallel()
    .Where(n => n % 2 == 0)
    .Select(n => (long)n * n)   // long: squares of large ints overflow int
    .Sum();
```

PLINQ doesn't preserve source order by default, because workers finish their chunks in any order. Ask for order when the result depends on it, and pay for the extra buffering:

```csharp
var firstHundredPrimes = numbers
    .AsParallel()
    .AsOrdered()
    .Where(IsPrime)
    .Take(100)
    .ToList();
```

PLINQ may also judge that a query would run faster sequentially and not parallelize it. The query operators accept options that override its choices:

```csharp
var results = source
    .AsParallel()
    .WithDegreeOfParallelism(4)
    .WithExecutionMode(ParallelExecutionMode.ForceParallelism)
    .WithMergeOptions(ParallelMergeOptions.NotBuffered)   // yield results as they're produced
    .WithCancellation(cancellationToken)
    .Select(Process)
    .ToList();
```

Exceptions from a PLINQ query arrive wrapped in an `AggregateException`, even when only one element failed.

### When PLINQ Pays Off

| Query | Parallel? | Why |
| --- | --- | --- |
| `images.AsParallel().Select(ResizeAndCompress)` | Yes | Each element is expensive and independent |
| `numbers.AsParallel().Select(n => n * 2)` | No | The per-element work is smaller than the scheduling overhead |
| `files.AsParallel().Select(File.ReadAllText)` | No | I/O-bound: threads block waiting on the disk; use async instead |
| A query against Entity Framework | No | `AsParallel()` would pull all rows into memory first; the database should do the work |

Measure before and after. A parallel query that is slower than the sequential one is common, and only a benchmark shows which you have.

## Concurrent Collections

`List<T>`, `Dictionary<TKey, TValue>`, and the other standard collections support any number of concurrent readers, but not a writer running alongside anything else. One thread adding while another reads can corrupt the collection's internal state, not just produce a stale value. The collections in `System.Collections.Concurrent` are built for shared access without an external lock.

| Collection | Shape | Built for |
| --- | --- | --- |
| `ConcurrentDictionary<TKey, TValue>` | Key-value | Shared lookups, caches, counters |
| `ConcurrentQueue<T>` | FIFO | Handing work items from producers to consumers in order |
| `ConcurrentStack<T>` | LIFO | Most-recent-first processing |
| `ConcurrentBag<T>` | Unordered | Threads that mostly add and take their own items |
| `BlockingCollection<T>` | Wrapper over any of the above | Bounded producer-consumer with blocking waits |

### ConcurrentDictionary

Reads don't take a lock, and writes lock only the part of the table the key hashes to, so threads working on different keys rarely block each other. Its API is built around single atomic operations, because a check followed by a separate write is a race even when each call is thread-safe on its own:

```csharp
var cache = new ConcurrentDictionary<string, Data>();

// Racy: another thread can add the key between the check and the add
if (!cache.ContainsKey(key))
    cache[key] = LoadData(key);

// Atomic: one call decides whether to add
Data data = cache.GetOrAdd(key, k => LoadData(k));

// Add, or update from the existing value
cache.AddOrUpdate("hits", _ => 1, (_, current) => current + 1);

if (cache.TryRemove(key, out var removed))
    Cleanup(removed);
```

**The factory can run more than once.** `GetOrAdd` and `AddOrUpdate` call their factory delegates outside the dictionary's lock, so several threads that miss the same key at the same moment can each run the factory. Only one result is stored, and the others are discarded. For a cheap factory that's harmless. For an expensive or side-effecting one, such as a database load, store a `Lazy<T>` so that only one caller actually runs it:

```csharp
var cache = new ConcurrentDictionary<string, Lazy<Data>>();

Data data = cache.GetOrAdd(key, k => new Lazy<Data>(() => LoadData(k))).Value;
```

Several threads may still create a `Lazy<Data>`, but they all get back the one the dictionary stored, and its `Value` runs `LoadData` once.

### ConcurrentQueue and ConcurrentStack

Both are lock-free and have `Try` methods for removal, since another thread may take the last item between your check and your call:

```csharp
var queue = new ConcurrentQueue<WorkItem>();
queue.Enqueue(new WorkItem());

if (queue.TryDequeue(out var item))
    Process(item);

var stack = new ConcurrentStack<int>();
stack.PushRange([2, 3, 4]);
if (stack.TryPop(out var top)) { /* ... */ }
```

### ConcurrentBag

`ConcurrentBag<T>` keeps a separate list per thread, so a thread that adds and takes its own items touches no shared state at all. That suits collecting results from a parallel loop, where every worker only adds:

```csharp
var results = new ConcurrentBag<Result>();
Parallel.ForEach(items, item => results.Add(Process(item)));
Result[] all = results.ToArray();
```

When one thread produces and a different one consumes, every take has to steal from another thread's list, which is slower than a `ConcurrentQueue<T>`.

### BlockingCollection

`BlockingCollection<T>` wraps a concurrent collection, `ConcurrentQueue<T>` by default, and adds a capacity limit and blocking waits. A producer blocks when the collection is full and a consumer blocks when it's empty, until the producer calls `CompleteAdding()`:

```csharp
using var work = new BlockingCollection<WorkItem>(boundedCapacity: 100);

var producer = Task.Run(() =>
{
    foreach (var item in GetItems())
        work.Add(item);          // blocks while 100 items are waiting
    work.CompleteAdding();
});

var consumer = Task.Run(() =>
{
    foreach (var item in work.GetConsumingEnumerable())   // ends after CompleteAdding
        Process(item);
});

await Task.WhenAll(producer, consumer);
```

Its waits block threads. For producer-consumer code that is otherwise async, `System.Threading.Channels` provides the same bounding with awaitable reads and writes.

## Sharing State Between Parallel Iterations

The simplest parallel loops share nothing: each iteration reads its own input and writes its own output slot. Once iterations touch shared state, every access needs to be atomic, or the result silently depends on timing:

```csharp
int count = 0;
Parallel.For(0, 1_000_000, i => count++);                       // loses updates: read-modify-write
Parallel.For(0, 1_000_000, i => Interlocked.Increment(ref count));  // correct, but every iteration contends
```

The better fix is usually structural rather than a lock: give each worker private state and combine once, as the `localInit`/`localFinally` overload does, or have each iteration write to its own index of an output array. Shared state guarded by locks turns a parallel loop back into a sequential one wherever the lock is held.

## Key Takeaways

**Parallelism is for CPU-bound work.** Use async to wait on I/O and parallelism to compute on more cores, and use `Parallel.ForEachAsync` when you need both.

**The thread pool is shared and slow to grow.** Don't block its threads, and don't use `Task.Run` to wrap code that is already async or already on a pool thread.

**Make each work item big enough to outweigh its scheduling.** Tiny bodies need range partitioning, and cheap PLINQ queries are often slower than sequential ones. Measure.

**Use atomic operations on concurrent collections.** `GetOrAdd` and `AddOrUpdate`, not a check followed by a write, and store a `Lazy<T>` when the factory must run once.

**Share as little as possible.** Per-worker state combined at the end scales. A shared counter behind a lock doesn't.
