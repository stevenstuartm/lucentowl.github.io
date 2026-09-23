---
title: "C# Span, Memory, and High-Performance Patterns"
layout: guide
category: ".NET & C#"
subcategory: "Collections & Data"
description: "Working with memory without copying it: Span<T> and ReadOnlySpan<T> over heap, stack, and native memory, why spans are confined to the stack, Memory<T> for async code, ArrayPool and MemoryPool, stackalloc, inline arrays, ref structs built over spans, and when these techniques are worth their complexity."
tags: [span, memory, arraypool, stackalloc, inline-arrays, performance, advanced]
---

## The Allocation Problem

Every time C# code creates a new object, array, or string, the runtime allocates memory on the managed heap. The garbage collector eventually reclaims that memory, but reclamation isn't free. GC pauses halt application threads, and the more frequently allocations happen, the more often GC runs. In high-throughput scenarios like web servers processing thousands of requests per second, parsers chewing through large files, or tight computational loops, allocation pressure becomes a dominant source of latency and throughput degradation.

Consider a common pattern: parsing a comma-separated line.

```csharp
string line = "Alice,42,Engineering";
string[] parts = line.Split(',');
string name = parts[0];
int age = int.Parse(parts[1]);
string dept = parts[2];
```

This allocates a `string[]` array and three new `string` objects. Each string copies characters from the original into its own heap memory. If this code runs millions of times (processing a CSV file, handling HTTP headers, parsing log lines), those allocations add up fast. The data already exists in memory as part of the original string, so the copies are pure waste.

The types in `System.Memory` solve this problem by providing ways to reference existing memory without copying it. They let code "look at" a region of memory that's already allocated, whether that memory lives on the heap, the stack, or even in unmanaged (native) space. The core idea is that reading and processing data should not require owning a separate copy of that data.

## Span&lt;T&gt;: A Window into Contiguous Memory

`Span<T>` is a value type that represents a contiguous region of arbitrary memory. It's defined internally as two fields: a managed reference (a `ref T` pointing to the start of the region) and an integer length. That's it. No object header, no heap allocation, no GC tracking. When code creates a `Span<T>`, it's creating a lightweight "view" that points into memory owned by something else.

```csharp
int[] array = { 10, 20, 30, 40, 50 };
Span<int> span = array.AsSpan();
Span<int> middle = span.Slice(1, 3);  // Points at elements [20, 30, 40]

middle[0] = 999;  // Modifies the original array
Console.WriteLine(array[1]);  // Prints 999
```

The `middle` span doesn't copy elements 1 through 3 into new memory. It stores a reference to `array[1]` and a length of 3. Modifying `middle[0]` modifies `array[1]` directly because they point to the same memory. This is what "zero-allocation" means in practice: the data stays where it is and the code just changes where it's looking.

### What Span Can Point To

The power of `Span<T>` is that it provides a unified abstraction over three different kinds of memory.

**Managed heap memory** is the most common source. Arrays, strings, and other managed objects live on the GC heap, and spans can point into them directly.

```csharp
byte[] heapBuffer = new byte[1024];
Span<byte> view = heapBuffer.AsSpan(0, 512);  // First 512 bytes
```

**Stack memory** is allocated with `stackalloc` and lives on the current thread's stack. It's extremely fast to allocate (just moves the stack pointer) and doesn't involve the GC at all since it vanishes automatically when the method returns.

```csharp
Span<byte> stackBuffer = stackalloc byte[128];
stackBuffer[0] = 0xFF;
```

**Unmanaged (native) memory** comes from native APIs, memory-mapped files, or direct allocation through `Marshal.AllocHGlobal` or `NativeMemory.Alloc`. Spans can wrap this memory too, which means C# code can process native buffers without copying data into managed arrays first.

```csharp
unsafe
{
    byte* nativePtr = (byte*)NativeMemory.Alloc(256);
    try
    {
        Span<byte> nativeSpan = new Span<byte>(nativePtr, 256);
        nativeSpan.Fill(0);  // Zero out native memory using safe Span API
    }
    finally
    {
        NativeMemory.Free(nativePtr);
    }
}
```

A method that accepts `Span<T>` or `ReadOnlySpan<T>` as a parameter doesn't need to know where the memory came from. It processes the data identically regardless of whether the caller passed a heap array, a stack buffer, or a pointer to native memory. This unification is what makes span-based APIs so composable.

### The Stack-Only Constraint

`Span<T>` is declared as a `ref struct`, so the compiler confines it to the stack: it can't be a field of a class or an ordinary struct, can't be boxed, can't be captured by a lambda, and can't stay alive across an `await`.

Two things make the confinement necessary. A span can point at a `stackalloc` buffer, and if the span escaped to the heap it would outlive the stack frame that buffer belongs to, leaving a dangling pointer to memory that now holds something else. And even a span over an array holds an interior reference, a pointer into the middle of an object rather than to its start, which the garbage collector can only track when it lives on the stack. The `ref struct` rules make both situations compile errors.

```csharp
class BadExample
{
    private Span<int> stored;   // error: a ref struct can't be a field of a class

    void Capture()
    {
        Span<int> local = stackalloc int[10];
        Action lambda = () => Console.WriteLine(local[0]);   // error: can't capture
    }

    async Task AsyncUse()
    {
        Span<int> buffer = stackalloc int[10];
        buffer[0] = 1;             // fine: before the await
        await Task.Delay(100);
        buffer[1] = 2;             // error: the span would have to survive the await
    }
}
```

The `await` rule follows from how `async` works: at an `await`, locals that are still needed afterward move into a state machine object on the heap, and a span can't go there. Since C# 13, a span local is allowed in an `async` method as long as every use of it falls between two awaits and none spans one.

These constraints are the price of `Span<T>`'s performance. When code stays within synchronous methods, `Span<T>` is the right tool. When a buffer has to cross an `await` or be stored for later, that's where `Memory<T>` comes in.

## ReadOnlySpan&lt;T&gt;: Immutable Views

`ReadOnlySpan<T>` is the immutable counterpart to `Span<T>`. It provides the same zero-allocation view into memory, but the indexed data cannot be modified through the span. The compiler enforces this: there's no `set` accessor on the indexer and no `Fill` or `Clear` methods.

This type exists primarily because of `string`. In .NET, strings are immutable. If `string.AsSpan()` returned a `Span<char>`, code could modify the string's characters in place, violating a fundamental invariant. So strings expose `ReadOnlySpan<char>` instead.

```csharp
string text = "Hello, World!";
ReadOnlySpan<char> greeting = text.AsSpan(0, 5);  // "Hello" - no allocation
ReadOnlySpan<char> name = text.AsSpan(7, 5);       // "World" - no allocation

// greeting[0] = 'J';  // Won't compile - read-only
```

`ReadOnlySpan<T>` is also the natural parameter type for methods that consume but don't modify data. A `Span<T>` implicitly converts to `ReadOnlySpan<T>`, so a method accepting `ReadOnlySpan<T>` can receive both mutable and immutable spans.

```csharp
int CountOccurrences(ReadOnlySpan<char> text, char target)
{
    int count = 0;
    foreach (char c in text)
    {
        if (c == target) count++;
    }
    return count;
}

// Works with string (ReadOnlySpan<char>)
int fromString = CountOccurrences("Hello".AsSpan(), 'l');

// Works with char array (Span<char> converts to ReadOnlySpan<char>)
char[] chars = { 'H', 'e', 'l', 'l', 'o' };
int fromArray = CountOccurrences(chars, 'l');

// Works with stackalloc
Span<char> stackChars = stackalloc char[] { 'H', 'e', 'l', 'l', 'o' };
int fromStack = CountOccurrences(stackChars, 'l');
```

The guideline is straightforward: accept `ReadOnlySpan<T>` when the method only reads data, accept `Span<T>` when it needs to write. This follows the same principle as accepting `IEnumerable<T>` instead of `List<T>` when you only need to iterate.

## Memory&lt;T&gt;: The Heap-Safe Sibling

`Memory<T>` solves the problem that `Span<T>`'s stack-only restriction creates. Many real-world scenarios require storing a reference to a buffer in a field, passing it to an async method, or capturing it in a callback. `Memory<T>` can do all of these because it's a regular struct (not a `ref struct`), so it can live on the heap.

The tradeoff is that `Memory<T>` can only point to managed heap memory (arrays) or memory managed through a custom `MemoryManager<T>`. It cannot wrap `stackalloc` buffers or raw native pointers directly. This restriction is what makes it safe to store on the heap: the GC knows about the underlying memory and won't collect it while a `Memory<T>` still references it.

```csharp
public class NetworkBuffer
{
    private Memory<byte> receiveBuffer;  // Can be a field - not possible with Span

    public NetworkBuffer(int size)
    {
        receiveBuffer = new byte[size];
    }

    public async Task<int> ReceiveAsync(Stream stream)
    {
        // Can use Memory<T> across await boundaries
        int bytesRead = await stream.ReadAsync(receiveBuffer);
        return bytesRead;
    }

    public void ProcessReceived(int length)
    {
        // Convert to Span for actual processing (synchronous, local scope)
        Span<byte> data = receiveBuffer.Span[..length];
        ParsePacket(data);
    }

    private void ParsePacket(Span<byte> data)
    {
        // Process bytes...
    }
}
```

The typical pattern is to store `Memory<T>` in fields and pass it through async pipelines, then call `.Span` to get a `Span<T>` when code needs to actually read or write the data in a synchronous context. Think of `Memory<T>` as the "carrier" and `Span<T>` as the "processor."

`ReadOnlyMemory<T>` is the immutable counterpart, mirroring the relationship between `Span<T>` and `ReadOnlySpan<T>`. String exposes `AsMemory()` which returns `ReadOnlyMemory<char>`.

### Choosing Between Span and Memory

The decision comes down to scope and lifetime.

| Question | Span&lt;T&gt; | Memory&lt;T&gt; |
|----------|---------|-----------|
| Does the reference stay within a single synchronous method? | Yes | Overkill |
| Does it need to survive across an `await`? | Can't | Yes |
| Does it need to be stored in a class field? | Can't | Yes |
| Does it need to wrap `stackalloc` or native memory? | Yes | Can't |
| Does it need to be captured in a lambda? | Can't | Yes |
| Which is faster for local processing? | Slightly (JIT can optimize ref struct better) | Still fast, but one extra indirection through `.Span` |

The rule of thumb: start with `Span<T>` for parameters and local processing. Upgrade to `Memory<T>` only when the compiler tells you `Span<T>` can't work in that context.

## ArrayPool&lt;T&gt;: Reusing Allocations

Even with spans, code sometimes needs actual arrays (for APIs that require `byte[]`, for storage across async boundaries, or when the data outlives a single method call). `ArrayPool<T>` addresses the allocation cost by renting arrays from a pool instead of allocating new ones each time.

The problem it solves is specific: code that frequently allocates and discards arrays of similar sizes. Each allocation adds GC pressure, and arrays of 85,000 bytes or more land on the Large Object Heap (LOH), which is only collected during expensive Gen 2 collections. Pooling reuses existing arrays instead of creating new ones.

```csharp
public void ProcessChunks(Stream input)
{
    byte[] buffer = ArrayPool<byte>.Shared.Rent(4096);
    try
    {
        int bytesRead;
        while ((bytesRead = input.Read(buffer, 0, 4096)) > 0)
        {
            ProcessChunk(buffer.AsSpan(0, bytesRead));
        }
    }
    finally
    {
        ArrayPool<byte>.Shared.Return(buffer);
    }
}
```

There are two important behaviors to understand. First, `Rent` may return an array larger than requested. The pool buckets arrays by size ranges, so requesting 4096 bytes might return a 4096-byte array or an 8192-byte one. Code must track the actual length it needs rather than relying on `buffer.Length`. Second, `Return` doesn't clear the array by default. If the buffer held sensitive data like passwords or tokens, pass `clearArray: true` to zero it out before returning.

Pooling also brings the bugs of manual memory management back into a garbage-collected language. Code that keeps using an array after returning it reads or corrupts data that another caller has since rented. Returning the same array twice lets two callers rent it at once. Neither fails loudly, so keep the rent and return in one method with a `try`/`finally`, and don't let the array escape it.

The `Shared` pool is a singleton suitable for most use cases. For specialized scenarios where the default pool's bucket sizes or retention policies don't fit, `ArrayPool<T>.Create()` creates a custom pool.

```csharp
// Custom pool for large buffers with limited retention
var largeBufferPool = ArrayPool<byte>.Create(
    maxArrayLength: 1024 * 1024,  // Up to 1MB arrays
    maxArraysPerBucket: 10);       // Keep at most 10 per size bucket
```

### MemoryPool&lt;T&gt;: Pooling with Memory Semantics

`MemoryPool<T>` wraps the same pooling concept but returns `IMemoryOwner<T>` instances, which expose `Memory<T>` and implement `IDisposable`. This makes it natural to use with `using` statements and in async code where `Memory<T>` is needed instead of raw arrays.

```csharp
public async Task ProcessAsync(Stream stream)
{
    using IMemoryOwner<byte> owner = MemoryPool<byte>.Shared.Rent(4096);
    Memory<byte> buffer = owner.Memory;

    int bytesRead = await stream.ReadAsync(buffer);
    await HandleDataAsync(buffer[..bytesRead]);
}
// owner.Dispose() returns the buffer to the pool
```

The `IMemoryOwner<T>` pattern makes ownership explicit. Whoever holds the owner is responsible for disposal. When the owner is disposed, the underlying array returns to the pool. This is especially useful when buffers flow through multiple async stages and it needs to be clear which stage is responsible for cleanup.

## stackalloc: Allocating on the Stack

`stackalloc` allocates memory directly on the current thread's stack frame. There's no heap allocation, no GC tracking, and no disposal needed. The memory vanishes automatically when the method returns, as the stack frame unwinds.

Before `Span<T>` existed, `stackalloc` required an `unsafe` context and returned a pointer. With `Span<T>`, stack-allocated memory can be used through safe, bounds-checked APIs.

```csharp
// Safe stack allocation through Span
Span<byte> buffer = stackalloc byte[128];
buffer[0] = 0xFF;
buffer.Fill(0);
// buffer[200] = 1;  // Throws IndexOutOfRangeException - bounds checked
```

Stack allocation is ideal for small, short-lived temporary buffers. The key constraint is size: a thread's stack is typically around a megabyte, and less on some platforms. Allocating too much on the stack causes a `StackOverflowException`, which can't be caught and terminates the process. A common defensive pattern allocates on the stack for small sizes and falls back to the heap for larger ones.

```csharp
public static bool TryFormatValue(int value, Span<char> destination, out int charsWritten)
{
    // 64 chars is plenty for any int, and safe for the stack
    Span<char> tempBuffer = stackalloc char[64];
    if (!value.TryFormat(tempBuffer, out int written))
    {
        charsWritten = 0;
        return false;
    }

    ReadOnlySpan<char> result = tempBuffer[..written];
    if (result.Length > destination.Length)
    {
        charsWritten = 0;
        return false;
    }

    result.CopyTo(destination);
    charsWritten = result.Length;
    return true;
}
```

A common cutoff for unconditional stack allocation is somewhere between a few hundred bytes and 1 KB. Above that, code should either fall back to the heap or use `ArrayPool<T>`.

```csharp
const int StackThreshold = 256;

Span<byte> buffer = size <= StackThreshold
    ? stackalloc byte[size]
    : new byte[size];  // Falls back to heap allocation for larger sizes
```

Never `stackalloc` inside a loop. Stack memory is released only when the method returns, not at the end of each iteration, so a loop that allocates 256 bytes per pass a few thousand times overflows the stack. Allocate the buffer once before the loop and reuse it.

## Inline Arrays (C# 12): Fixed-Size Buffers Without Unsafe

Before C# 12, embedding a fixed-size buffer directly inside a struct required `unsafe` code and `fixed` keyword buffers, which only supported primitive types. Inline arrays provide the same capability through safe, generic code.

An inline array is a struct decorated with `[InlineArray(N)]`. It contains exactly one field, but the runtime treats it as an array of N elements of that field's type. The elements are embedded directly in the struct's memory layout, with no separate heap allocation and no array object header.

```csharp
[System.Runtime.CompilerServices.InlineArray(4)]
public struct FourInts
{
    private int _element0;
}

var buffer = new FourInts();
buffer[0] = 10;
buffer[1] = 20;
buffer[2] = 30;
buffer[3] = 40;

// Converts to Span for bulk operations
Span<int> span = buffer;
span.Sort();
```

The primary use case is performance-critical types that need small, fixed-size storage without any heap allocation. Because the elements are inline in the struct, they're contiguous in memory and cache-friendly. An inline array inside a struct that lives on the stack means zero GC involvement.

A practical example is a lookup table for character classification. Instead of allocating a `byte[256]` on the heap, the lookup lives directly in the struct.

```csharp
[InlineArray(256)]
public struct AsciiLookup
{
    private byte _element0;
}

public struct FastAsciiClassifier
{
    private AsciiLookup table;

    public FastAsciiClassifier()
    {
        Span<byte> span = table;
        for (int i = 'a'; i <= 'z'; i++) span[i] = 1;
        for (int i = 'A'; i <= 'Z'; i++) span[i] = 1;
        for (int i = '0'; i <= '9'; i++) span[i] = 2;
    }

    public bool IsLetter(char c) => c < 256 && table[c] == 1;
    public bool IsDigit(char c) => c < 256 && table[c] == 2;
}
```

Inline arrays make sense when the size is known at compile time and small enough that copying the whole struct stays cheap. For dynamically sized or large buffers, `Span<T>` with `stackalloc` or `ArrayPool<T>` remains the better choice.

## Ref Structs Built Over Spans

A class or ordinary struct can't hold a `Span<T>` field, so a type that needs to keep a span, such as a parser that walks through a buffer, must itself be a `ref struct` and accept the same confinement.

```csharp
public ref struct LineReader
{
    private ReadOnlySpan<char> remaining;

    public LineReader(ReadOnlySpan<char> text)
    {
        remaining = text;
    }

    public bool TryReadLine(out ReadOnlySpan<char> line)
    {
        if (remaining.IsEmpty)
        {
            line = default;
            return false;
        }

        int newline = remaining.IndexOf('\n');
        if (newline < 0)
        {
            line = remaining;
            remaining = default;
            return true;
        }

        line = remaining[..newline];
        remaining = remaining[(newline + 1)..];
        return true;
    }
}
```

This `LineReader` iterates through the lines of a string or any character buffer without allocating a single object. Each "line" is a span pointing into the original text. Compare this to `string.Split('\n')`, which allocates an array and a new string for every line.

```csharp
string logFile = File.ReadAllText("server.log");
var reader = new LineReader(logFile);

while (reader.TryReadLine(out ReadOnlySpan<char> line))
{
    if (line.StartsWith("ERROR"))
    {
        ProcessErrorLine(line);
    }
}
```

A `ref struct` that rents a resource can still be used with `using`. Since C# 8, `using` accepts any `ref struct` with an accessible `Dispose()` method, without the type implementing `IDisposable`:

```csharp
public ref struct RentedBuffer<T>
{
    private T[]? array;
    private readonly int length;

    public RentedBuffer(int length)
    {
        array = ArrayPool<T>.Shared.Rent(length);
        this.length = length;
    }

    public Span<T> Span => array.AsSpan(0, length);

    public void Dispose()
    {
        if (array is not null)
        {
            ArrayPool<T>.Shared.Return(array);
            array = null;
        }
    }
}

// The array returns to the pool when 'buffer' goes out of scope
using var buffer = new RentedBuffer<byte>(4096);
int read = stream.Read(buffer.Span);
```

## Practical Patterns

### Zero-Copy String Parsing

The most common application of spans is parsing structured text without allocating intermediate strings. When code processes HTTP headers, CSV records, log lines, or configuration files, the input is typically a single string or byte buffer. Span-based parsing slices that buffer into views without copying.

```csharp
public static bool TryParseHeader(
    ReadOnlySpan<char> header,
    out ReadOnlySpan<char> name,
    out ReadOnlySpan<char> value)
{
    int colon = header.IndexOf(':');
    if (colon < 0)
    {
        name = default;
        value = default;
        return false;
    }

    name = header[..colon].Trim();
    value = header[(colon + 1)..].Trim();
    return true;
}
```

Each call to this method produces two spans that point back into the original `header` memory. No strings are allocated. If the caller needs an actual `string` (to store in a dictionary, for example), they call `.ToString()` on just the spans they need, controlling exactly when and where allocation happens.

### Buffer-Based Stream Processing

Reading files or network streams in chunks using pooled buffers avoids allocating fresh arrays for each read.

```csharp
public async Task<int> CountLinesAsync(string path)
{
    int lineCount = 0;
    byte[] buffer = ArrayPool<byte>.Shared.Rent(8192);

    try
    {
        await using var stream = File.OpenRead(path);
        int bytesRead;

        while ((bytesRead = await stream.ReadAsync(buffer.AsMemory(0, 8192))) > 0)
        {
            // Switch to Span for synchronous counting
            ReadOnlySpan<byte> chunk = buffer.AsSpan(0, bytesRead);
            foreach (byte b in chunk)
            {
                if (b == (byte)'\n') lineCount++;
            }
        }
    }
    finally
    {
        ArrayPool<byte>.Shared.Return(buffer);
    }

    return lineCount;
}
```

Notice how `Memory<T>` carries the buffer through the async `ReadAsync` call, and then `Span<T>` takes over for the synchronous processing loop. This is the carrier-processor pattern in action.

### Span-Friendly Formatting

Modern .NET numeric types, `DateTime`, `Guid`, and others implement `ISpanFormattable`, which means they can write their formatted representation directly into a caller-provided span rather than allocating a new string.

```csharp
Span<char> buffer = stackalloc char[64];

int id = 12345;
id.TryFormat(buffer, out int written);
ReadOnlySpan<char> formattedId = buffer[..written];

decimal price = 1234.56m;
price.TryFormat(buffer, out written, "C2", CultureInfo.CurrentCulture);
ReadOnlySpan<char> formattedPrice = buffer[..written];
```

The `string.Create` method takes this further, letting code build a string by writing directly into the string's internal buffer during construction. The string is allocated once at its final size rather than assembled through concatenation or `StringBuilder`.

That final size must be exact. `string.Create` allocates exactly the length it's given, and any characters the callback doesn't write stay as `'\0'` inside the returned string. Compute the length first:

```csharp
int id = 42;
string name = "Alice";

int length = CountDigits(id) + 2 + name.Length;   // "42: Alice" is 9 characters
string result = string.Create(length, (id, name), (chars, state) =>
{
    state.id.TryFormat(chars, out int written);
    ": ".CopyTo(chars[written..]);
    state.name.CopyTo(chars[(written + 2)..]);
});

static int CountDigits(int value) => value == 0 ? 1 : (int)Math.Floor(Math.Log10(Math.Abs((double)value))) + 1 + (value < 0 ? 1 : 0);
```

For most formatting, an interpolated string is simpler and, since C# 10 and .NET 6, already formats each value straight into one buffer without intermediate strings. `string.Create` is for hot paths where the length is cheap to know in advance.

## When These Optimizations Matter

These types add complexity to code. A method using `ReadOnlySpan<char>` is harder to read than one using `string`, and pooling requires discipline around return semantics. That complexity only pays off when allocation is actually a measurable problem.

**Use these types when** code processes data at high volume or high frequency: parsers that handle millions of records, servers that process thousands of requests per second, real-time systems with strict latency budgets, or library code consumed by performance-sensitive callers.

**Don't reach for these types when** allocations are infrequent or the code isn't on a hot path. A method that runs once during startup, a configuration parser that processes a 50-line file, or a CLI tool that runs and exits doesn't benefit meaningfully from zero-allocation techniques. The GC handles occasional allocations with negligible overhead.

Recent C# versions keep lowering the cost of using spans. C# 13 lets a method declare `params ReadOnlySpan<T>`, so callers pass a variable number of arguments without allocating an array. C# 14 adds implicit conversions from arrays to spans in more places, such as calling an extension method written for `ReadOnlySpan<T>` directly on an array.

The practical approach is to write straightforward code first, measure with a profiler or `BenchmarkDotNet`, and then apply span-based optimizations to the specific methods where allocation shows up as a cost. These types are surgical tools for measured problems, not defaults for all code.

## Key Takeaways

**A span is a view, not a copy.** Slicing an array, a string, stack memory, or native memory produces a window onto the same data, with no allocation.

**Spans stay on the stack.** They can't be fields of ordinary types, can't be captured, and can't survive an `await`. Use `Memory<T>` to carry a buffer through async code and take `.Span` to process it.

**Accept `ReadOnlySpan<T>` when a method only reads.** It takes arrays, strings, and stack buffers alike.

**Pool buffers carefully.** `ArrayPool<T>` may hand back a larger array, doesn't clear on return by default, and turns use-after-return into silent data corruption.

**Keep `stackalloc` small and out of loops.** Fall back to the heap or the pool above a fixed threshold.

**Measure first.** These techniques pay off on hot paths that a profiler has shown to be allocation-bound, and cost readability everywhere else.
