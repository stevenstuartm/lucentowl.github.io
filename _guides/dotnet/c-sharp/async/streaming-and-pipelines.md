---
title: "C# Streaming and Pipelines"
layout: guide
category: ".NET & C#"
subcategory: "Async & Concurrency"
description: "IAsyncEnumerable, System.IO.Pipelines, channels, and high-performance streaming patterns."
tags: [c-sharp, dotnet, async, streaming, performance, pipelines, advanced]
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

If the caller breaks out of the `foreach` early, the remaining code never runs. That is the fundamental difference from building a `List<T>` upfront: work that nobody asks for simply does not happen.

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

## IAsyncEnumerable<T>

Async iteration for streaming data asynchronously.

### Producing Async Streams

```csharp
// yield return in async method
public async IAsyncEnumerable<int> GenerateNumbersAsync(int count)
{
    for (int i = 0; i < count; i++)
    {
        await Task.Delay(100);  // Simulate async work
        yield return i;
    }
}

// From database
public async IAsyncEnumerable<Customer> GetCustomersAsync(
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await using var connection = await _connectionFactory.CreateConnectionAsync();
    await using var command = connection.CreateCommand();
    command.CommandText = "SELECT * FROM Customers";

    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        yield return new Customer
        {
            Id = reader.GetInt32(0),
            Name = reader.GetString(1)
        };
    }
}

// Wrapping synchronous enumerable
public async IAsyncEnumerable<string> ReadLinesAsync(string path)
{
    using var reader = new StreamReader(path);
    string? line;
    while ((line = await reader.ReadLineAsync()) != null)
    {
        yield return line;
    }
}
```

### Consuming Async Streams

```csharp
// await foreach
await foreach (var number in GenerateNumbersAsync(10))
{
    Console.WriteLine(number);
}

// With cancellation
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
await foreach (var item in GetItemsAsync().WithCancellation(cts.Token))
{
    Process(item);
}

// ConfigureAwait
await foreach (var item in GetItemsAsync().ConfigureAwait(false))
{
    Process(item);
}

// Manual enumeration
var enumerator = GetItemsAsync().GetAsyncEnumerator();
try
{
    while (await enumerator.MoveNextAsync())
    {
        Process(enumerator.Current);
    }
}
finally
{
    await enumerator.DisposeAsync();
}
```

### LINQ for Async Streams

```csharp
// System.Linq.Async package
using System.Linq;

var results = await GetRecordsAsync()
    .Where(r => r.IsActive)
    .Select(r => r.Name)
    .Take(10)
    .ToListAsync();

// First/Single
var first = await GetRecordsAsync().FirstOrDefaultAsync();

// Aggregate
var count = await GetRecordsAsync().CountAsync();
var sum = await GetRecordsAsync().SumAsync(r => r.Amount);

// Any/All
bool hasActive = await GetRecordsAsync().AnyAsync(r => r.IsActive);
```

### Buffering and Batching

```csharp
// Buffer into chunks
public static async IAsyncEnumerable<T[]> BufferAsync<T>(
    this IAsyncEnumerable<T> source,
    int batchSize,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    var buffer = new List<T>(batchSize);

    await foreach (var item in source.WithCancellation(cancellationToken))
    {
        buffer.Add(item);
        if (buffer.Count >= batchSize)
        {
            yield return buffer.ToArray();
            buffer.Clear();
        }
    }

    if (buffer.Count > 0)
    {
        yield return buffer.ToArray();
    }
}

// Usage
await foreach (var batch in GetRecordsAsync().BufferAsync(100))
{
    await ProcessBatchAsync(batch);  // Process 100 at a time
}
```

## System.IO.Pipelines

High-performance I/O processing with minimal allocations.

### Core Concepts

```csharp
// Pipe: a channel between writer and reader
var pipe = new Pipe();
PipeWriter writer = pipe.Writer;
PipeReader reader = pipe.Reader;

// Writing
Memory<byte> buffer = writer.GetMemory(minimumSize: 512);
int bytesWritten = FillBuffer(buffer.Span);
writer.Advance(bytesWritten);
await writer.FlushAsync();

// Reading
ReadResult result = await reader.ReadAsync();
ReadOnlySequence<byte> buffer = result.Buffer;
ProcessBuffer(buffer);
reader.AdvanceTo(buffer.End);  // Mark consumed
```

### Pipeline Processing Pattern

```csharp
public class LineProcessor
{
    public async Task ProcessAsync(Stream input)
    {
        var pipe = new Pipe();

        // Producer: read from stream into pipe
        Task writing = FillPipeAsync(input, pipe.Writer);

        // Consumer: process pipe data
        Task reading = ReadPipeAsync(pipe.Reader);

        await Task.WhenAll(reading, writing);
    }

    private async Task FillPipeAsync(Stream stream, PipeWriter writer)
    {
        const int minimumBufferSize = 512;

        while (true)
        {
            Memory<byte> memory = writer.GetMemory(minimumBufferSize);
            int bytesRead = await stream.ReadAsync(memory);

            if (bytesRead == 0)
                break;

            writer.Advance(bytesRead);
            FlushResult result = await writer.FlushAsync();

            if (result.IsCompleted)
                break;
        }

        await writer.CompleteAsync();
    }

    private async Task ReadPipeAsync(PipeReader reader)
    {
        while (true)
        {
            ReadResult result = await reader.ReadAsync();
            ReadOnlySequence<byte> buffer = result.Buffer;

            while (TryReadLine(ref buffer, out ReadOnlySequence<byte> line))
            {
                ProcessLine(line);
            }

            // Tell reader how much we consumed
            reader.AdvanceTo(buffer.Start, buffer.End);

            if (result.IsCompleted)
                break;
        }

        await reader.CompleteAsync();
    }

    private bool TryReadLine(
        ref ReadOnlySequence<byte> buffer,
        out ReadOnlySequence<byte> line)
    {
        SequencePosition? position = buffer.PositionOf((byte)'\n');

        if (position == null)
        {
            line = default;
            return false;
        }

        line = buffer.Slice(0, position.Value);
        buffer = buffer.Slice(buffer.GetPosition(1, position.Value));
        return true;
    }
}
```

### Working with ReadOnlySequence

```csharp
// ReadOnlySequence can span multiple segments
ReadOnlySequence<byte> sequence = ...;

// Single segment (common case)
if (sequence.IsSingleSegment)
{
    ProcessSpan(sequence.FirstSpan);
}
else
{
    // Multi-segment: iterate or copy
    foreach (ReadOnlyMemory<byte> segment in sequence)
    {
        ProcessMemory(segment);
    }
}

// Copy to contiguous buffer when needed
byte[] array = sequence.ToArray();

// Parse from sequence
if (Utf8Parser.TryParse(sequence.FirstSpan, out int value, out int consumed))
{
    // Use value
}
```

## Channels

Thread-safe producer-consumer queues for async programming.

### Basic Channel Usage

```csharp
// Unbounded channel
var channel = Channel.CreateUnbounded<int>();

// Bounded channel (backpressure)
var boundedChannel = Channel.CreateBounded<int>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait,  // Wait when full
    SingleReader = true,   // Optimization hint
    SingleWriter = false
});

// Write
await channel.Writer.WriteAsync(42);
bool written = channel.Writer.TryWrite(42);
channel.Writer.Complete();

// Read
int value = await channel.Reader.ReadAsync();
bool read = channel.Reader.TryRead(out int item);

// Async enumeration
await foreach (var item in channel.Reader.ReadAllAsync())
{
    Process(item);
}
```

### Producer-Consumer Pattern

```csharp
public class DataProcessor
{
    private readonly Channel<WorkItem> _channel;

    public DataProcessor(int bufferSize)
    {
        _channel = Channel.CreateBounded<WorkItem>(bufferSize);
    }

    // Producer
    public async Task ProduceAsync(IAsyncEnumerable<WorkItem> source)
    {
        await foreach (var item in source)
        {
            await _channel.Writer.WriteAsync(item);
        }
        _channel.Writer.Complete();
    }

    // Consumer
    public async Task ConsumeAsync(CancellationToken cancellationToken)
    {
        await foreach (var item in _channel.Reader.ReadAllAsync(cancellationToken))
        {
            await ProcessAsync(item);
        }
    }

    // Multiple consumers
    public Task StartConsumersAsync(int count, CancellationToken cancellationToken)
    {
        var tasks = Enumerable.Range(0, count)
            .Select(_ => ConsumeAsync(cancellationToken));
        return Task.WhenAll(tasks);
    }
}

// Usage
var processor = new DataProcessor(bufferSize: 100);
var producer = processor.ProduceAsync(GetItemsAsync());
var consumers = processor.StartConsumersAsync(4, cancellationToken);
await Task.WhenAll(producer, consumers);
```

### Fan-Out Pattern

```csharp
public async Task FanOutAsync<T>(
    IAsyncEnumerable<T> source,
    Func<T, Task> processor,
    int maxConcurrency)
{
    var channel = Channel.CreateBounded<T>(maxConcurrency * 2);

    // Producer
    var producer = Task.Run(async () =>
    {
        await foreach (var item in source)
        {
            await channel.Writer.WriteAsync(item);
        }
        channel.Writer.Complete();
    });

    // Consumers
    var consumers = Enumerable.Range(0, maxConcurrency)
        .Select(_ => Task.Run(async () =>
        {
            await foreach (var item in channel.Reader.ReadAllAsync())
            {
                await processor(item);
            }
        }));

    await Task.WhenAll(consumers.Append(producer));
}
```

### Pipeline with Multiple Stages

```csharp
public class Pipeline<TInput, TOutput>
{
    public async Task<IAsyncEnumerable<TOutput>> ProcessAsync(
        IAsyncEnumerable<TInput> source,
        Func<TInput, Task<TOutput>> transform)
    {
        var channel = Channel.CreateUnbounded<TOutput>();

        _ = Task.Run(async () =>
        {
            await foreach (var input in source)
            {
                var output = await transform(input);
                await channel.Writer.WriteAsync(output);
            }
            channel.Writer.Complete();
        });

        return channel.Reader.ReadAllAsync();
    }
}

// Multi-stage pipeline
public async IAsyncEnumerable<ProcessedData> ProcessPipelineAsync(
    IAsyncEnumerable<RawData> source)
{
    // Stage 1: Parse
    var stage1 = Channel.CreateBounded<ParsedData>(100);

    // Stage 2: Validate
    var stage2 = Channel.CreateBounded<ValidatedData>(100);

    // Stage 3: Transform
    var stage3 = Channel.CreateBounded<ProcessedData>(100);

    // Run stages concurrently
    var parseTask = ParseAsync(source, stage1.Writer);
    var validateTask = ValidateAsync(stage1.Reader, stage2.Writer);
    var transformTask = TransformAsync(stage2.Reader, stage3.Writer);

    await foreach (var result in stage3.Reader.ReadAllAsync())
    {
        yield return result;
    }

    await Task.WhenAll(parseTask, validateTask, transformTask);
}
```

## Stream Processing

### Processing Large Files

```csharp
public async IAsyncEnumerable<LogEntry> ParseLargeLogFileAsync(
    string path,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await using var stream = new FileStream(
        path,
        FileMode.Open,
        FileAccess.Read,
        FileShare.Read,
        bufferSize: 4096,
        useAsync: true);

    using var reader = new StreamReader(stream);

    string? line;
    while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
    {
        if (TryParseLogEntry(line, out var entry))
        {
            yield return entry;
        }
    }
}

// Usage with filtering
var errors = ParseLargeLogFileAsync("large.log")
    .Where(e => e.Level == LogLevel.Error)
    .Take(100);

await foreach (var error in errors)
{
    Console.WriteLine(error);
}
```

### Network Streaming

```csharp
public async IAsyncEnumerable<Message> StreamMessagesAsync(
    Stream networkStream,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    var buffer = new byte[4096];
    var messageBuffer = new List<byte>();

    while (!cancellationToken.IsCancellationRequested)
    {
        int bytesRead = await networkStream.ReadAsync(
            buffer.AsMemory(), cancellationToken);

        if (bytesRead == 0)
            yield break;  // Connection closed

        for (int i = 0; i < bytesRead; i++)
        {
            if (buffer[i] == '\n')  // Message delimiter
            {
                var message = ParseMessage(messageBuffer.ToArray());
                yield return message;
                messageBuffer.Clear();
            }
            else
            {
                messageBuffer.Add(buffer[i]);
            }
        }
    }
}
```

### JSON Streaming

```csharp
// Stream JSON array elements
public async IAsyncEnumerable<T> StreamJsonArrayAsync<T>(
    Stream stream,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await foreach (var item in JsonSerializer.DeserializeAsyncEnumerable<T>(
        stream,
        cancellationToken: cancellationToken))
    {
        if (item != null)
        {
            yield return item;
        }
    }
}

// Write streaming JSON
public async Task WriteJsonStreamAsync<T>(
    Stream stream,
    IAsyncEnumerable<T> items,
    CancellationToken cancellationToken = default)
{
    await using var writer = new Utf8JsonWriter(stream);

    writer.WriteStartArray();

    await foreach (var item in items.WithCancellation(cancellationToken))
    {
        JsonSerializer.Serialize(writer, item);
    }

    writer.WriteEndArray();
}
```

## Backpressure Handling

Control flow when producer is faster than consumer.

```csharp
public class BackpressureController<T>
{
    private readonly Channel<T> _channel;
    private readonly int _highWaterMark;
    private readonly int _lowWaterMark;

    public BackpressureController(int capacity)
    {
        _highWaterMark = (int)(capacity * 0.8);
        _lowWaterMark = (int)(capacity * 0.2);

        _channel = Channel.CreateBounded<T>(new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait
        });
    }

    public async ValueTask ProduceAsync(T item, CancellationToken ct = default)
    {
        // Writer will await if channel is full
        await _channel.Writer.WriteAsync(item, ct);
    }

    public IAsyncEnumerable<T> ConsumeAsync() =>
        _channel.Reader.ReadAllAsync();
}
```

## Combining Streams

```csharp
// Merge multiple streams
public static async IAsyncEnumerable<T> MergeAsync<T>(
    params IAsyncEnumerable<T>[] sources)
{
    var channel = Channel.CreateUnbounded<T>();

    var tasks = sources.Select(async source =>
    {
        await foreach (var item in source)
        {
            await channel.Writer.WriteAsync(item);
        }
    }).ToList();

    var completion = Task.WhenAll(tasks).ContinueWith(_ =>
        channel.Writer.Complete());

    await foreach (var item in channel.Reader.ReadAllAsync())
    {
        yield return item;
    }
}

// Zip two streams
public static async IAsyncEnumerable<(T1, T2)> ZipAsync<T1, T2>(
    IAsyncEnumerable<T1> first,
    IAsyncEnumerable<T2> second)
{
    var enum1 = first.GetAsyncEnumerator();
    var enum2 = second.GetAsyncEnumerator();

    try
    {
        while (await enum1.MoveNextAsync() && await enum2.MoveNextAsync())
        {
            yield return (enum1.Current, enum2.Current);
        }
    }
    finally
    {
        await enum1.DisposeAsync();
        await enum2.DisposeAsync();
    }
}
```

## Performance Patterns

### Object Pooling with ArrayPool

```csharp
public async IAsyncEnumerable<byte[]> ProcessChunksAsync(Stream stream)
{
    var pool = ArrayPool<byte>.Shared;
    byte[] buffer = pool.Rent(4096);

    try
    {
        int bytesRead;
        while ((bytesRead = await stream.ReadAsync(buffer)) > 0)
        {
            // Copy to right-sized array for yielding
            var chunk = new byte[bytesRead];
            buffer.AsSpan(0, bytesRead).CopyTo(chunk);
            yield return chunk;
        }
    }
    finally
    {
        pool.Return(buffer);
    }
}
```

### Memory-Efficient Transformations

```csharp
public async IAsyncEnumerable<TOutput> TransformAsync<TInput, TOutput>(
    IAsyncEnumerable<TInput> source,
    Func<TInput, TOutput> transform)
{
    await foreach (var item in source)
    {
        yield return transform(item);
        // Input is eligible for GC immediately
    }
}
```

## Key Takeaways

**Use IAsyncEnumerable for async iteration**: Stream data without loading everything into memory.

**Channels for producer-consumer**: Thread-safe, async-friendly queues with backpressure support.

**Pipelines for high-throughput I/O**: Zero-allocation processing with System.IO.Pipelines.

**Bounded channels for backpressure**: Prevent memory issues when producer outpaces consumer.

**Yield return for lazy production**: Data is generated only when consumed.

**Combine with LINQ.Async**: Apply familiar LINQ operations to async streams.
