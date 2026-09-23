---
title: "C# Streaming and Pipelines"
layout: guide
category: ".NET & C#"
subcategory: "Async & Concurrency"
description: "Processing data as it arrives instead of all at once: how yield return and IAsyncEnumerable work, when streaming beats materializing and when it starves a connection pool, async LINQ, channels and backpressure between producers and consumers, and System.IO.Pipelines for parsing byte streams."
tags: [iasyncenumerable, yield-return, channels, system-io-pipelines, backpressure, async, advanced]
---

## Streaming Overview

```csharp
// Traditional - loads all data into memory
List<Record> records = await LoadAllRecordsAsync();  // Memory: O(n)
foreach (var record in records)
{
    Process(record);
}

// Streaming - processes one at a time
await foreach (var record in StreamRecordsAsync())  // Memory: O(1)
{
    Process(record);
}
```

## How `yield return` Works

`yield return` tells the compiler to rewrite your method into a **lazy state machine** that implements `IEnumerable<T>` (or `IAsyncEnumerable<T>` for async methods). Three behaviors define how it works:

1. **Nothing executes until iteration starts.** Calling the method returns immediately without running any of the method body. Code only runs when the caller requests the first item.
2. **Execution pauses at each `yield return` and resumes on the next iteration.** The caller gets one item, then the method is suspended until the caller asks for another.
3. **All local state is preserved between yields.** Loop counters, local variables, and position within the method body all survive across suspensions.

```csharp
IEnumerable<int> GetNumbers()
{
    Console.WriteLine("Before first");   // runs on first MoveNext()
    yield return 1;
    Console.WriteLine("Before second");  // runs on second MoveNext()
    yield return 2;
    Console.WriteLine("After last");     // runs only if caller iterates past 2
}

var numbers = GetNumbers();  // nothing prints - method body hasn't executed
foreach (var n in numbers)   // now it executes, one step at a time
{
    Console.WriteLine(n);
}
// Output: Before first, 1, Before second, 2, After last
```

If the caller breaks out of the `foreach` early, the remaining code never runs. That is the core difference from building a `List<T>` upfront: work that nobody asks for doesn't happen. Cleanup still does. Breaking out disposes the enumerator, which runs any pending `finally` blocks and `using` disposals in the iterator, so a file or connection the iterator opened is closed even when the caller stops early.

### The Resource Lifetime Tradeoff

Before choosing streaming over materialization, understand what stays open. Streaming extends the lifetime of every resource the producer holds, including database connections, file handles, HTTP connections, and database cursors or locks. A `DbDataReader` keeps its connection open for the entire duration of iteration, not just the time it takes to read the data.

```csharp
// Streaming: connection stays open until the caller finishes processing every row
await using var connection = await _connectionFactory.CreateConnectionAsync();
await using var reader = await command.ExecuteReaderAsync(cancellationToken);
while (await reader.ReadAsync(cancellationToken))
{
    yield return MapRow(reader);  // connection pinned the entire time
}

// Materialized: connection opens, reads, closes, then processing begins
await using var connection = await _connectionFactory.CreateConnectionAsync();
await using var reader = await command.ExecuteReaderAsync(cancellationToken);
var results = new List<Customer>();
while (await reader.ReadAsync(cancellationToken))
{
    results.Add(MapRow(reader));
}
// connection is closed — now process freely
foreach (var customer in results) { Process(customer); }
```

With materialization, the connection hold time equals the read time. With streaming, the connection hold time equals the read time plus the processing time of every item. If 100 concurrent requests each stream through a large result set, each one pins a connection for the full duration, and the connection pool can starve other queries across the application. Materialization trades higher peak memory for shorter connection hold times, which in most service-layer code is the better tradeoff.

This same logic applies to HTTP connections from paginated API calls. If the consumer is slow, you hold the HTTP client connection while processing each page rather than fetching all pages and releasing the connection.

### When Streaming Is the Right Tool

Most API and database query patterns in service-layer code do not benefit from streaming. The result sets are small enough to fit comfortably in memory, the consumer needs all results to make decisions, and holding connections open longer than necessary starves other operations. Streaming occupies a narrower niche than guides typically suggest.

**ETL and data migration pipelines.** Reading millions of rows from one database and writing them to another, where materializing the full dataset would exhaust memory. The connection hold time is acceptable because the pipeline is the primary workload, not one of many concurrent queries.

**Processing large files.** Log parsing, CSV transformation, or any file-based pipeline where the file is too large to fit in memory. File handles are cheap compared to database connections, so the resource lifetime concern is minimal.

**Early termination over expensive computation.** When the consumer might stop partway through, `yield` avoids computing results that nobody needs. Searching a directory tree for the first 10 matches stops scanning files after finding them rather than searching the entire tree.

**Composable pipelines.** `yield` is how LINQ works internally. Chaining `.Where().Select().Take()` produces a lazy pipeline where nothing happens until materialization. Writing custom filtering or transformation utilities with `yield` gives you the same composability.

**Hiding pagination behind a clean interface.** Streaming and pagination complement each other when the consumer genuinely processes items one at a time. You paginate internally with cursors and page tokens, but expose a flat `IAsyncEnumerable<T>` externally so callers don't know or care about the pagination.

```csharp
async IAsyncEnumerable<Order> StreamOrdersAsync(DateTime since)
{
    string? cursor = null;
    do
    {
        var page = await _api.GetOrdersAsync(since, cursor);
        foreach (var order in page.Items)
            yield return order;
        cursor = page.NextCursor;
    } while (cursor != null);
}
```

**Infinite or unbounded sequences.** Sequences where "all results" has no meaning: generating IDs, reading sensor data, producing test fixtures.

### When Materialization Is the Better Default

For most application-layer patterns involving API calls and database queries, paginating into a `List<T>` and closing the connection before processing is simpler, more predictable, and avoids starving other operations.

**You need all results to make decisions.** If categorizing, grouping, or sorting requires seeing the full dataset, you will call `.ToList()` anyway, and `yield` adds state machine overhead for no benefit.

**You need count or aggregates before processing.** Lazy evaluation means you cannot know the total without consuming the sequence.

**The dataset fits comfortably in memory.** If the result set is hundreds or even thousands of items from an API or query, the memory difference between streaming and materializing is negligible, but the connection hold time difference is not.

**You need to retry the entire batch on failure.** An `IEnumerable` produced by `yield` cannot be rewound without re-executing from scratch. A `List<T>` can be iterated multiple times.

**Multiple concurrent consumers share a connection pool.** In a web service handling many requests, each streaming consumer pins a connection for the duration of iteration. Materializing reads fast, releases the connection, and lets other requests proceed. This is the most common reason to prefer materialization in service-layer code.

## IAsyncEnumerable&lt;T&gt;

`IAsyncEnumerable<T>` (C# 8) is the async counterpart of `IEnumerable<T>`. An `async` method that uses `yield return` produces one, and each step of the iteration can await I/O before yielding the next item.

### Producing an Async Stream

```csharp
public async IAsyncEnumerable<Customer> GetCustomersAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await using var connection = await _connectionFactory.CreateConnectionAsync(cancellationToken);
    await using var command = connection.CreateCommand();
    command.CommandText = "SELECT Id, Name FROM Customers";

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        yield return new Customer(reader.GetInt32(0), reader.GetString(1));
    }
}
```

The BCL produces async streams too: `File.ReadLinesAsync` (.NET 7) yields a file's lines, `JsonSerializer.DeserializeAsyncEnumerable` yields the elements of a JSON array as they are parsed, and Entity Framework's `AsAsyncEnumerable()` yields query rows.

### Consuming an Async Stream

`await foreach` awaits each `MoveNextAsync` in turn:

```csharp
await foreach (var customer in GetCustomersAsync(cancellationToken))
{
    Process(customer);
}
```

A caller that received the stream from somewhere else can attach a token with `WithCancellation`:

```csharp
IAsyncEnumerable<Customer> customers = repository.StreamCustomers();

await foreach (var customer in customers.WithCancellation(cancellationToken))
{
    Process(customer);
}
```

That token reaches the iterator only through a parameter marked `[EnumeratorCancellation]`. Without the attribute, `WithCancellation` compiles and the iterator never sees the token. The compiler combines a token passed as an argument and one attached with `WithCancellation`, so either one cancels the loop.

`ConfigureAwait(false)` works on an async stream the same way it does on a task: `await foreach (var x in source.ConfigureAwait(false))`.

### Async LINQ

.NET 10 includes LINQ operators for `IAsyncEnumerable<T>` in the box, in `System.Linq.AsyncEnumerable`. Earlier versions need the `System.Linq.Async` NuGet package for the same operators.

```csharp
var firstErrors = await ReadLogAsync(path, ct)
    .Where(entry => entry.Level == LogLevel.Error)
    .Take(100)
    .ToListAsync(ct);

await foreach (var batch in GetRecordsAsync(ct).Chunk(100))
{
    await SaveBatchAsync(batch, ct);   // 100 records per database round trip
}
```

The operators are lazy like their synchronous counterparts. `Take(100)` stops pulling from the source after the hundredth match, which disposes the source iterator and runs its cleanup.

## Channels

A channel (`System.Threading.Channels`) is an async queue between code that produces items and code that consumes them. Producers write, consumers read, and either side awaits when it has to wait instead of blocking a thread. Channels are the tool when producer and consumer run at different speeds, run concurrently, or number more than one on either side.

### Bounded and Unbounded Channels

```csharp
// Unbounded: writes always succeed immediately; the queue can grow without limit
var unbounded = Channel.CreateUnbounded<Message>();

// Bounded: at most 100 items waiting
var bounded = Channel.CreateBounded<Message>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait,
    SingleReader = true,    // lets the channel use a faster implementation
    SingleWriter = false
});
```

The bound is what gives a channel **backpressure**. When a producer outruns its consumer, an unbounded channel absorbs the difference in memory until the process runs out. A bounded channel pushes the difference back onto the producer, and `FullMode` decides how:

| `FullMode` | When the channel is full |
| --- | --- |
| `Wait` (default) | `WriteAsync` waits until a consumer makes room, slowing the producer to the consumer's pace |
| `DropOldest` | The oldest waiting item is discarded to make room |
| `DropNewest` | The newest waiting item is discarded to make room |
| `DropWrite` | The item being written is discarded |

`Wait` suits work that must not be lost. The drop modes suit data where only recent values matter, such as telemetry samples or UI updates.

### Producer and Consumer

The producer must complete the writer when it's done, and complete it **with the exception** if it fails. Otherwise consumers wait forever for items that will never come, or finish normally without learning the producer failed:

```csharp
public async Task ProduceAsync(ChannelWriter<WorkItem> writer, IAsyncEnumerable<WorkItem> source,
    CancellationToken ct)
{
    try
    {
        await foreach (var item in source.WithCancellation(ct))
            await writer.WriteAsync(item, ct);   // waits while the channel is full

        writer.Complete();
    }
    catch (Exception ex)
    {
        writer.Complete(ex);                     // consumers see this exception
        throw;
    }
}

public async Task ConsumeAsync(ChannelReader<WorkItem> reader, CancellationToken ct)
{
    // Ends when the writer completes; rethrows if it completed with an exception
    await foreach (var item in reader.ReadAllAsync(ct))
        await ProcessAsync(item, ct);
}
```

Several consumers can read from the same channel, and each item goes to exactly one of them:

```csharp
var channel = Channel.CreateBounded<WorkItem>(100);

Task producer = ProduceAsync(channel.Writer, GetItemsAsync(ct), ct);
Task[] consumers = Enumerable.Range(0, 4)
    .Select(_ => ConsumeAsync(channel.Reader, ct))
    .ToArray();

await Task.WhenAll([producer, .. consumers]);
```

When the goal is only to process a stream's items with limited concurrency, `Parallel.ForEachAsync` accepts an `IAsyncEnumerable<T>` directly and handles the fan-out itself. Reach for a hand-built channel when the producer and consumers need their own lifetimes or the queue needs a bound of its own.

### Multi-Stage Pipelines

Chaining channels gives a pipeline in which every stage runs concurrently and each bound limits how far one stage can get ahead of the next:

```
source ─▶ parse ─▶ [ bounded 100 ] ─▶ validate ─▶ [ bounded 100 ] ─▶ save
             ◀── waits when full ──            ◀── waits when full ──
```

```csharp
static Task RunStageAsync<TIn, TOut>(ChannelReader<TIn> input, ChannelWriter<TOut> output,
    Func<TIn, CancellationToken, ValueTask<TOut>> transform, CancellationToken ct) =>
    Task.Run(async () =>
    {
        try
        {
            await foreach (var item in input.ReadAllAsync(ct))
                await output.WriteAsync(await transform(item, ct), ct);
            output.Complete();
        }
        catch (Exception ex)
        {
            output.Complete(ex);   // the failure flows downstream instead of hanging it
            throw;
        }
    }, ct);
```

Each stage completes its output with the exception it hit, so a failure in the first stage surfaces at the end of the pipeline instead of leaving later stages waiting. Keep a reference to every stage's task and await them all at the end, so no failure goes unobserved.

## System.IO.Pipelines

`System.IO.Pipelines` is built for parsing protocols and formats out of a byte stream, the job that `Stream.ReadAsync` into a byte array makes awkward. With a raw stream, a message can arrive split across two reads, so the parser has to copy partial data into its own growing buffer and track where the last message ended. A `Pipe` does that bookkeeping and pools the buffers.

A `Pipe` has a writer side and a reader side. The writer fills memory the pipe provides, and the reader receives everything written so far as one `ReadOnlySequence<byte>`, which may span several pooled buffers:

```csharp
var pipe = new Pipe();

// Writer: ask the pipe for memory, fill it, tell it how much was written
Memory<byte> memory = pipe.Writer.GetMemory(minimumSize: 512);
int written = FillBuffer(memory.Span);
pipe.Writer.Advance(written);
await pipe.Writer.FlushAsync();

// Reader: see everything available, then report what was used
ReadResult result = await pipe.Reader.ReadAsync();
ReadOnlySequence<byte> data = result.Buffer;
SequencePosition consumed = ParseWhatYouCan(data);
pipe.Reader.AdvanceTo(consumed, data.End);
```

`AdvanceTo` takes two positions, and that is the core of the model. `consumed` marks the bytes the parser has finished with, which the pipe can release. `examined` marks how far it looked. Bytes between the two, such as half a message, stay in the pipe, and the next `ReadAsync` waits until more data arrives beyond `examined` and then returns the leftover bytes together with the new ones.

### Reading Lines from a Stream

```csharp
public async Task ProcessLinesAsync(Stream stream, CancellationToken ct)
{
    PipeReader reader = PipeReader.Create(stream);   // wraps any Stream

    while (true)
    {
        ReadResult result = await reader.ReadAsync(ct);
        ReadOnlySequence<byte> buffer = result.Buffer;

        while (TryReadLine(ref buffer, out ReadOnlySequence<byte> line))
            ProcessLine(line);

        if (result.IsCompleted)
        {
            if (!buffer.IsEmpty)
                ProcessLine(buffer);   // the last line had no trailing newline
            break;
        }

        // Everything before buffer.Start is consumed; the rest is a partial line
        reader.AdvanceTo(buffer.Start, buffer.End);
    }

    await reader.CompleteAsync();
}

private static bool TryReadLine(ref ReadOnlySequence<byte> buffer, out ReadOnlySequence<byte> line)
{
    SequencePosition? newline = buffer.PositionOf((byte)'\n');
    if (newline is null)
    {
        line = default;
        return false;
    }

    line = buffer.Slice(0, newline.Value);
    buffer = buffer.Slice(buffer.GetPosition(1, newline.Value));
    return true;
}
```

`PipeReader.Create` wraps an existing `Stream`, so the reading side of pipelines can be used without writing a producer loop. The completion check comes before `AdvanceTo` on purpose. When the stream ends, whatever is left in the buffer is a final line with no terminator, and it has to be processed while the buffer is still valid. A loop that only breaks on completion silently drops that line.

### Working with ReadOnlySequence

A `ReadOnlySequence<byte>` is usually a single segment, and code can take a fast path for that case:

```csharp
if (line.IsSingleSegment)
{
    ParseRecord(line.FirstSpan);                 // one contiguous span, no copy
}
else
{
    Span<byte> joined = line.Length <= 256
        ? stackalloc byte[(int)line.Length]
        : new byte[line.Length];
    line.CopyTo(joined);                          // stitch segments together
    ParseRecord(joined);
}
```

Copying is only needed when a parser requires contiguous memory and the data straddles a buffer boundary.

## Writing JSON as a Stream

`JsonSerializer.SerializeAsync` accepts an `IAsyncEnumerable<T>` and writes a JSON array element by element, flushing as it goes, so the whole array never sits in memory:

```csharp
await JsonSerializer.SerializeAsync(responseStream, GetCustomersAsync(ct), cancellationToken: ct);
```

Its counterpart, `JsonSerializer.DeserializeAsyncEnumerable<T>`, reads an array element by element from a stream. Between them, a service can move a large JSON array from a database to a client without materializing it on either end.

## Key Takeaways

**Streaming trades memory for resource lifetime.** It keeps memory flat but holds connections and handles open for the whole iteration. In service code that shares a connection pool, materializing is usually the better default.

**Iterators run lazily and clean up on early exit.** Nothing runs until the first item is requested, and breaking out still runs the iterator's `finally` and `using` blocks.

**Flow cancellation with `[EnumeratorCancellation]`.** Without it, a token attached through `WithCancellation` never reaches the iterator.

**Bound your channels.** An unbounded channel converts a slow consumer into unbounded memory growth. A bounded one slows the producer, or drops items by an explicit policy.

**Complete writers with the exception.** A producer that fails without calling `Complete(ex)` leaves consumers waiting forever.

**Use pipelines for parsing byte streams.** `AdvanceTo(consumed, examined)` handles messages split across reads without hand-built buffers.
