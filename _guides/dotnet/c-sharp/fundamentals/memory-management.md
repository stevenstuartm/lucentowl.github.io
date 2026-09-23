---
title: "C# Memory Management and Garbage Collection"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "How .NET memory actually works: where objects live, why allocation is cheap and survival is expensive, generations and the large object heap, reachability and roots, workstation versus server GC, deterministic cleanup with IDisposable and the using forms, finalizers and SafeHandle, and what counts as a leak in a garbage-collected runtime."
tags: [garbage-collection, idisposable, finalizers, generations, large-object-heap, memory-leaks, practical]
---

## Where Objects Live

The managed runtime uses two kinds of memory. Each thread has a **stack**, a small fixed-size region holding the frames of the methods currently running, with their locals and arguments. A frame is reclaimed the instant its method returns. The **managed heap** is one large region shared by all threads, where objects live until the garbage collector (GC) reclaims them.

Where a given value ends up follows from two rules:

- **Every instance of a class, array, string, delegate, or boxed value lives on the managed heap.** A variable of a reference type holds only a reference to it.
- **A value type lives wherever its container lives.** A local `int` sits in the method's stack frame or a CPU register. An `int` field of a class sits inside that object on the heap. A captured local in a lambda, or a local in an `async` method that survives an `await`, is moved by the compiler into a heap object.

```csharp
public void Example()
{
    int count = 42;                  // in this frame or a register
    var customer = new Customer();   // reference in the frame; the Customer object on the heap
    int[] numbers = new int[100];    // reference in the frame; the array, and its 100 ints, on the heap
}

public class Customer
{
    public int Age;                  // a value type, stored inside each Customer on the heap
}
```

"Value types go on the stack" is repeated widely and is wrong often enough to mislead. What makes a value type different is that assigning it copies it, not where it's stored.

| | Stack | Managed heap |
|---|-------|--------------|
| Holds | Method frames: locals and arguments not captured by a closure | Every reference-type object, plus any value type stored inside one |
| Allocation | Moving the stack pointer | Moving the heap's allocation pointer (almost as cheap) |
| Reclaimed | Immediately, when the method returns | When the GC finds the object unreachable |
| Size | Small and fixed per thread | Grows as needed |

## Allocation Is Cheap, Survival Is Expensive

The managed heap allocates by bumping a pointer, so `new` on a small object costs little more than a stack allocation. The cost comes later. A collection has to find every object still in use and, for most collections, copy the survivors together to close the gaps left by dead ones. The work is proportional to what **survives**, not to what was allocated. Ten million objects that die before the next collection cost almost nothing to collect. Ten thousand that live for minutes are copied repeatedly and inspected on every full collection.

That asymmetry explains most of the GC's design and most advice about it.

## Generations

Most objects die young, such as a string built for one log line or an enumerator used for one loop. The GC exploits that by dividing the heap into **generations** and collecting the young ones far more often than the old.

| Generation | Holds | Collected |
|------------|-------|-----------|
| Gen 0 | Newly allocated objects | Very often. Most objects die here |
| Gen 1 | Survivors of one collection | Less often. A buffer between short and long lived |
| Gen 2 | Long-lived objects: caches, singletons, static data | Rarely, in a **full** collection that also collects gen 0 and 1 |
| Large object heap (LOH) | Objects of 85,000 bytes or more, almost always arrays | Only with gen 2, and not compacted by default |
| Pinned object heap (POH, .NET 5) | Arrays allocated as pinned with `GC.AllocateArray(..., pinned: true)` | With gen 2, and never moved |

Each collection promotes its survivors one generation up, so an object that lives long enough ends in gen 2 and stays there until a full collection finds it dead. A gen 0 collection only examines gen 0, which is why it's fast. A gen 2 collection examines everything.

This produces the most important practical rule. **Objects that live a medium time are the expensive ones.** An object that survives just long enough to be promoted to gen 2, then dies, is paid for twice. It is copied during promotion, and then it waits for the rare, expensive full collection to reclaim it. Caching something for a few seconds, holding request data in a long-lived collection, or keeping objects in a queue that drains slowly all produce this pattern.

The LOH exists because copying very large arrays during compaction would be expensive. Its objects are logically part of gen 2, so even a short-lived large buffer is only reclaimed by a full collection, and because the LOH isn't compacted by default, free space between surviving large objects can fragment it. Large buffers that are allocated often should be pooled, which is what `ArrayPool<T>` is for. The LOH is compacted automatically when a container memory limit or a GC hard limit is set, and on demand with `GCSettings.LargeObjectHeapCompactionMode`.

## Reachability and Roots

The GC decides what is alive by **reachability**. It starts from a set of **roots** and follows every reference, and anything it can't reach is garbage. The roots are static fields, locals and arguments on each thread's stack and in CPU registers, GC handles created by the runtime or by `GCHandle`, and objects waiting to be finalized.

Two consequences follow.

**Cycles are not leaks.** Two objects that reference each other, and that nothing else references, are unreachable and get collected together. .NET doesn't use reference counting, so there's no need to break cycles by hand.

**A local's lifetime is decided by the JIT, not by its scope.** Optimized code may stop reporting a local as a root after its last use, so an object can be collected while the method that created it is still running. Unoptimized code may keep it alive longer. This matters only when something outside the GC's view depends on the object, such as a native handle whose owning object has a finalizer. `GC.KeepAlive(obj)` at the point where the object must still exist extends it that far:

```csharp
IntPtr handle = wrapper.Handle;
NativeMethods.Use(handle);   // native code uses the handle
GC.KeepAlive(wrapper);       // wrapper (and its finalizer) can't run before this line
```

## When Collections Happen

A collection starts when allocations in a generation pass a threshold the GC continually adjusts, when the operating system reports low memory, or when code calls `GC.Collect()`. Almost all collections are the first kind, which is why reducing allocations in hot code reduces GC time directly.

Before a collection, the runtime suspends all managed threads. Gen 0 and gen 1 collections are short. Gen 2 collections usually run as **background** collections, concurrently with the application and with only brief pauses. Background collection is on by default for both GC flavors in .NET.

### Workstation and Server GC

| | Workstation GC | Server GC |
|---|----------------|-----------|
| Heaps | One | One per logical CPU |
| Collects on | The thread that triggered it | Dedicated high-priority threads, one per heap, in parallel |
| Tuned for | Low memory use, responsiveness | Throughput |
| Default for | Standalone apps | Chosen by the host where one applies, and by project setting |

Server GC is faster per collection on large heaps because several threads collect at once, and it lets heaps grow more before collecting. That trades memory for throughput, and on a machine running many processes it can oversubscribe the CPUs, since each process runs one GC thread per core. **DATAS** (dynamic adaptation to application sizes), on by default since .NET 9, softens this. It starts server GC with one heap and adds or removes heaps as the load changes, keeping the heap roughly proportional to the live data, which suits containers. The flavor is set with `<ServerGarbageCollection>true</ServerGarbageCollection>` in the project file or the equivalent runtime configuration setting.

### Latency Modes

`GCSettings.LatencyMode` adjusts how intrusive collections are for the whole process. `Interactive` is the default. `SustainedLowLatency` suppresses blocking gen 2 collections for longer periods, relying on background collections, at the cost of a larger heap. `LowLatency` suppresses gen 2 collections entirely for short periods and is available only with workstation GC. `Batch` disables background collection for maximum throughput. `GC.TryStartNoGCRegion` goes further, reserving enough memory up front that no collection happens at all while the region's allocation budget lasts, and `GC.EndNoGCRegion` ends it. These are tools for measured problems, and none of them should be set speculatively.

## Deterministic Cleanup with IDisposable

The GC reclaims memory. It knows nothing about file handles, sockets, database connections, or locks, and it runs at unpredictable times. Anything holding such a resource implements `IDisposable`, and its `Dispose` method releases the resource **now**, rather than whenever the object happens to be collected.

### The using Forms

`using` guarantees `Dispose` runs when a block is left by any route, including an exception. It compiles to `try`/`finally`.

```csharp
// using statement: disposed at the closing brace
using (var reader = new StreamReader(path))
{
    Process(reader.ReadToEnd());
}

// using declaration (C# 8): disposed at the end of the enclosing scope
using var input = File.OpenRead(inputPath);
using var output = File.Create(outputPath);
input.CopyTo(output);
// output is disposed first, then input: reverse order of declaration

// await using: for types implementing IAsyncDisposable
await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();
```

The declaration form is shorter but holds the resource until the end of the scope, which in a long method may be much later than needed. Use the statement form when a resource should be released partway through.

`await using` calls `DisposeAsync()`, for resources whose cleanup involves I/O, such as flushing a stream or closing a network connection. Disposing those synchronously would block a thread.

### Implementing IDisposable

Most classes that need `Dispose` own other disposable objects and have no unmanaged resources directly. For them, and for any `sealed` class, `Dispose` just disposes what it owns:

```csharp
public sealed class ReportWriter : IDisposable
{
    private readonly StreamWriter _writer;
    private bool _disposed;

    public ReportWriter(string path) => _writer = new StreamWriter(path);

    public void Write(string line)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        _writer.WriteLine(line);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _writer.Dispose();
        _disposed = true;
    }
}
```

`Dispose` should be safe to call more than once, and other members should throw `ObjectDisposedException` after it. The larger pattern, with a `protected virtual Dispose(bool disposing)` method and `GC.SuppressFinalize(this)`, exists for **unsealed** classes whose derived types may add resources, and for classes that hold unmanaged handles directly. The `disposing` flag tells the method whether it was called from `Dispose`, where other managed objects are still safe to touch, or from a finalizer, where they may already have been finalized.

### Finalizers and SafeHandle

A **finalizer** (`~ClassName()`) runs on a dedicated thread at some point after the GC finds the object unreachable. It is a safety net for an unmanaged resource whose owner forgot to call `Dispose`, and it is costly:

- An object with a finalizer survives at least one extra collection, because it has to be kept alive until the finalizer has run. So it is promoted to an older generation, which is the expensive medium-lifetime pattern.
- The finalizer thread runs finalizers one at a time in no guaranteed order, so a slow one delays all the others.
- An unhandled exception in a finalizer terminates the process.

Almost no application code should write one. The standard alternative is to wrap the native handle in a `SafeHandle` subclass, which the runtime finalizes reliably and releases exactly once, and to have the owning class dispose the `SafeHandle`:

```csharp
internal sealed class NativeResourceHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public NativeResourceHandle() : base(ownsHandle: true) { }

    protected override bool ReleaseHandle() => NativeMethods.CloseResource(handle);
}
```

`GC.SuppressFinalize(this)` in `Dispose` tells the runtime the finalizer no longer needs to run, so a properly disposed object avoids the extra survival.

## Leaks in a Garbage-Collected Runtime

A managed memory leak is not memory the runtime forgot to free. It is an object that is **still reachable** but that the program no longer needs. The GC is doing its job correctly, and the fix is always to find and remove the reference that keeps the object alive. The common sources are:

- **Collections that only grow.** A static dictionary used as a cache, a list of "recent" items that is never trimmed, or a map from request ID to state that isn't cleaned up on failure. A cache needs an eviction policy, which is what `MemoryCache` provides.
- **Event subscriptions.** A long-lived publisher's event holds every subscriber that hasn't unsubscribed.
- **Captured variables.** A lambda stored somewhere long-lived keeps alive everything it captured, which may include `this` and, through it, a whole object graph.

Finding which reference is responsible means comparing heap snapshots or dumps taken over time, with the diagnostic tools.

### Weak References

A `WeakReference<T>` refers to an object without keeping it alive. `TryGetTarget` returns the object if it hasn't been collected yet. That makes weak references poor caches, because a value referenced only by the cache is eligible at the next collection, often within milliseconds, and the cache empties itself under exactly the load where it's needed. To attach data to objects without extending their lifetime, `ConditionalWeakTable<TKey, TValue>` is the built-in structure. It keeps each value alive only as long as its key.

## Reducing Allocation Pressure

Because collection cost tracks allocation volume and survival, the allocation-focused techniques all aim at making fewer objects, or objects that die immediately:

- **Pool large or frequent buffers** with `ArrayPool<T>.Shared`, especially anything at LOH size. For expensive objects other than arrays, `Microsoft.Extensions.ObjectPool` provides the same rent-and-return model.
- **Store small data inline.** An array of 1,000 structs is one allocation with the values inside it. An array of 1,000 class instances is 1,001 allocations.
- **Avoid hidden allocations in hot loops**, such as boxing a value type through an interface, capturing lambdas, LINQ iterator objects, and string concatenation.
- **Don't make objects live longer than they need to.** Medium-lived objects are the expensive ones, so releasing references promptly often helps more than any pooling.

Measure before and after. The GC is heavily optimized, allocation-reduction work can make code harder to read, and only a profile shows whether allocations are the actual cost.

### Calling GC.Collect

`GC.Collect()` forces a full, blocking collection. It pauses the application, and it promotes every surviving young object a generation early, turning short-lived data into the expensive long-lived kind. Calling it in normal code usually makes performance worse. Legitimate uses are narrow, such as after unloading a very large one-time structure at a known quiet point, or in tests that need finalizers or weak references to have been processed. Where it's used, `GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();` is the usual sequence to also reclaim objects freed by finalizers.

## Key Takeaways

**A value type lives wherever its container lives.** Objects of reference types always live on the managed heap, and locals live in stack frames unless a closure or `async` method moves them.

**Allocation is cheap and survival is expensive.** The GC's cost tracks what survives, and objects that live just long enough to reach gen 2 cost the most.

**Reachability, not scope or reference counting, decides lifetime.** Cycles are collected, and a leak is always a reference that should have been removed.

**Release non-memory resources with `using`.** Prefer the declaration form for brevity and the statement form to release early, and use `await using` for async cleanup.

**Don't write finalizers.** Wrap native handles in `SafeHandle`, and keep `Dispose` simple in sealed classes.

**Don't tune the GC speculatively.** Choose workstation or server GC for the workload, pool large buffers, and change latency modes or call `GC.Collect` only when a measurement says so.
