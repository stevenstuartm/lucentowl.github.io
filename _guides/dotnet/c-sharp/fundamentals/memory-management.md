---
title: "C# Memory Management and Garbage Collection"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Understanding the .NET garbage collector, memory allocation, generations, finalization, and best practices for efficient memory usage."
tags: [c-sharp, dotnet, memory-management, garbage-collection, performance, advanced]
---

## Memory Fundamentals

The .NET runtime manages memory automatically through the garbage collector (GC). Understanding how it works helps you write efficient code and avoid memory-related issues.

### Stack vs Heap

```csharp
public void MemoryExample()
{
    // Stack allocation - value types and references
    int count = 42;           // Value stored on stack
    double price = 19.99;     // Value stored on stack

    // Heap allocation - objects
    var customer = new Customer();  // Reference on stack, object on heap
    string name = "Alice";          // Reference on stack, string on heap
    int[] numbers = new int[100];   // Reference on stack, array on heap
}
```

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Stack</h4>
<ul>
<li><strong>Allocation</strong>: Very fast (pointer move)</li>
<li><strong>Deallocation</strong>: Automatic (scope exit)</li>
<li><strong>Size</strong>: Small (~1MB per thread)</li>
<li><strong>Lifetime</strong>: Method scope</li>
<li><strong>Content</strong>: Value types, references</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Heap</h4>
<ul>
<li><strong>Allocation</strong>: Slower (GC managed)</li>
<li><strong>Deallocation</strong>: GC determines when</li>
<li><strong>Size</strong>: Large (limited by RAM)</li>
<li><strong>Lifetime</strong>: GC decides</li>
<li><strong>Content</strong>: Objects, arrays</li>
</ul>
</div>
</div>

### The Managed Heap

.NET divides the managed heap into generations based on object lifetime:

- **Generation 0 (Gen0)**: Newly allocated objects. Most objects die young.
- **Generation 1 (Gen1)**: Survived one GC. Buffer between Gen0 and Gen2.
- **Generation 2 (Gen2)**: Long-lived objects. Expensive to collect.
- **Large Object Heap (LOH)**: Objects >= 85,000 bytes. Collected with Gen2.
- **Pinned Object Heap (POH)**: .NET 5+. Pinned objects to avoid fragmentation.

```csharp
// Check which generation an object is in
var obj = new byte[1000];
int generation = GC.GetGeneration(obj);  // Usually 0 for new objects

// After surviving collections
GC.Collect(0);  // Gen0 collection
generation = GC.GetGeneration(obj);  // Now in Gen1
```

## How Garbage Collection Works

### GC Triggers

Garbage collection runs when:
- Gen0 threshold reached (most common)
- System memory pressure
- `GC.Collect()` called explicitly
- Application is idle (workstation GC)

### Collection Process

1. **Mark**: Identify live objects by tracing from roots (statics, stack, CPU registers)
2. **Sweep/Compact**: Remove dead objects, compact memory (except LOH by default)
3. **Promote**: Move surviving objects to next generation

```csharp
// GC roots include:
// - Static variables
// - Local variables on stack
// - CPU registers
// - Finalization queue
// - GC handles (GCHandle)

public class RootExample
{
    private static Customer? _staticCustomer;  // GC root

    public void Method()
    {
        var local = new Customer();  // GC root while in scope
        _staticCustomer = local;     // Now rooted by static field
    }  // local goes out of scope, but object still rooted by static
}
```

### GC Modes

```csharp
// Check current GC settings
bool isServer = GCSettings.IsServerGC;
GCLatencyMode latency = GCSettings.LatencyMode;

// Server GC: One heap per CPU core, parallel collection
// Workstation GC: Single heap, concurrent collection

// Configure in project file
// <ServerGarbageCollection>true</ServerGarbageCollection>
```

| Mode | Best For | Characteristics |
|------|----------|-----------------|
| Workstation | Desktop apps | Lower latency, one heap |
| Server | Web servers | Higher throughput, parallel |
| Concurrent | UI apps | Background collection |
| Background | Most apps | Default, non-blocking Gen2 |

### Latency Modes

```csharp
// Temporarily suppress GC for latency-critical sections
var oldMode = GCSettings.LatencyMode;
try
{
    GCSettings.LatencyMode = GCLatencyMode.LowLatency;
    PerformLatencyCriticalWork();
}
finally
{
    GCSettings.LatencyMode = oldMode;
}

// Available modes:
// - Batch: Max throughput, full blocking collections
// - Interactive: Default, balanced
// - LowLatency: Minimize pauses (may increase memory)
// - SustainedLowLatency: Long-term low latency
// - NoGCRegion: Prevent GC entirely (limited allocation)
```

## IDisposable and Resource Management

The GC handles memory, but unmanaged resources (files, connections, handles) need explicit cleanup.

### The Dispose Pattern

```csharp
public class ResourceHolder : IDisposable
{
    private FileStream? _fileStream;
    private bool _disposed;

    public ResourceHolder(string path)
    {
        _fileStream = new FileStream(path, FileMode.Open);
    }

    public void DoWork()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        // Use _fileStream
    }

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);  // No need for finalizer
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            // Dispose managed resources
            _fileStream?.Dispose();
            _fileStream = null;
        }

        // Free unmanaged resources here (rare)

        _disposed = true;
    }
}

// Usage
using var holder = new ResourceHolder("file.txt");
holder.DoWork();
// Automatically disposed at end of scope
```

### Finalizers (Destructors)

Finalizers are a safety net for unmanaged resources if Dispose isn't called. They have significant performance cost.

```csharp
public class UnmanagedWrapper : IDisposable
{
    private IntPtr _handle;  // Unmanaged resource
    private bool _disposed;

    public UnmanagedWrapper()
    {
        _handle = NativeMethods.CreateResource();
    }

    ~UnmanagedWrapper()  // Finalizer
    {
        Dispose(disposing: false);
    }

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);  // Don't run finalizer
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            // Dispose managed resources
        }

        // Always free unmanaged resources
        if (_handle != IntPtr.Zero)
        {
            NativeMethods.CloseResource(_handle);
            _handle = IntPtr.Zero;
        }

        _disposed = true;
    }
}
```

<div class="callout callout--warning">
<p class="callout__title">Finalizer Costs</p>
<ul>
<li>Objects with finalizers survive Gen0 collection (promoted to Gen1)</li>
<li>Finalizers run on dedicated thread (delays cleanup)</li>
<li>Finalizer exceptions can crash the app</li>
<li>Use only when wrapping unmanaged resources directly</li>
</ul>
<p>Prefer <code>SafeHandle</code> over manual finalizers whenever possible.</p>
</div>

```csharp
// Prefer SafeHandle over manual finalizers
public class SafeResourceHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeResourceHandle() : base(true) { }

    protected override bool ReleaseHandle()
    {
        return NativeMethods.CloseResource(handle);
    }
}
```

## Memory Allocation Patterns

### Reducing Allocations

```csharp
// BAD: Allocates new string each call
public string GetGreeting(string name)
{
    return $"Hello, {name}!";  // String allocation
}

// GOOD: Use Span for parsing without allocation
public int ParseNumber(ReadOnlySpan<char> input)
{
    int index = input.IndexOf(':');
    var numberSpan = input[(index + 1)..].Trim();
    return int.Parse(numberSpan);  // No string allocation
}

// BAD: LINQ creates many small allocations
public int SumEven(int[] numbers)
{
    return numbers.Where(n => n % 2 == 0).Sum();  // Allocates enumerator
}

// GOOD: Manual loop avoids allocations
public int SumEvenNoAlloc(int[] numbers)
{
    int sum = 0;
    foreach (var n in numbers)
        if (n % 2 == 0) sum += n;
    return sum;
}
```

### ArrayPool for Temporary Buffers

```csharp
// BAD: Frequent allocation of temporary arrays
public byte[] ProcessData(Stream source)
{
    var buffer = new byte[4096];  // Allocation
    source.Read(buffer, 0, buffer.Length);
    return Transform(buffer);
}

// GOOD: Rent from pool
public byte[] ProcessDataPooled(Stream source)
{
    byte[] buffer = ArrayPool<byte>.Shared.Rent(4096);
    try
    {
        int read = source.Read(buffer, 0, 4096);
        return Transform(buffer.AsSpan(0, read));
    }
    finally
    {
        ArrayPool<byte>.Shared.Return(buffer);
    }
}
```

### Object Pooling

```csharp
using Microsoft.Extensions.ObjectPool;

// Configure pool
var policy = new DefaultPooledObjectPolicy<StringBuilder>();
var pool = new DefaultObjectPool<StringBuilder>(policy, maximumRetained: 100);

// Use pooled object
public string BuildReport(IEnumerable<Item> items)
{
    var sb = pool.Get();
    try
    {
        foreach (var item in items)
            sb.AppendLine($"{item.Name}: {item.Value}");
        return sb.ToString();
    }
    finally
    {
        sb.Clear();
        pool.Return(sb);
    }
}
```

### Value Types to Avoid Heap Allocation

```csharp
// Class - allocated on heap
public class PointClass
{
    public int X { get; set; }
    public int Y { get; set; }
}

// Struct - allocated on stack (when local) or inline
public struct PointStruct
{
    public int X { get; set; }
    public int Y { get; set; }
}

// Record struct combines value semantics with record features
public readonly record struct PointRecord(int X, int Y);

// Array of structs: single allocation, values inline
PointStruct[] structArray = new PointStruct[1000];  // One allocation

// Array of classes: 1001 allocations (array + each object)
PointClass[] classArray = new PointClass[1000];
for (int i = 0; i < 1000; i++)
    classArray[i] = new PointClass();  // 1000 additional allocations
```

## Large Object Heap

Objects >= 85,000 bytes go to the LOH. Different collection rules apply.

```csharp
// LOH threshold
const int LohThreshold = 85_000;

// This goes to SOH (Small Object Heap)
var smallArray = new byte[84_000];

// This goes to LOH
var largeArray = new byte[86_000];

// LOH considerations:
// - Collected with Gen2 (expensive)
// - Not compacted by default (fragmentation)
// - Survives longer in memory

// Enable LOH compaction (use sparingly)
GCSettings.LargeObjectHeapCompactionMode =
    GCLargeObjectHeapCompactionMode.CompactOnce;
GC.Collect();  // Compact happens on next collection
```

### Avoiding LOH Fragmentation

```csharp
// Strategy 1: Use ArrayPool for large buffers
var buffer = ArrayPool<byte>.Shared.Rent(100_000);
try
{
    // Use buffer
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer);
}

// Strategy 2: Pre-allocate and reuse
public class LargeBufferPool
{
    private readonly byte[][] _buffers;
    private int _index;

    public LargeBufferPool(int count, int size)
    {
        _buffers = new byte[count][];
        for (int i = 0; i < count; i++)
            _buffers[i] = new byte[size];
    }

    public byte[] Rent() => _buffers[_index++ % _buffers.Length];
}
```

## Memory Diagnostics

### Monitoring GC

```csharp
// GC statistics
int gen0Collections = GC.CollectionCount(0);
int gen1Collections = GC.CollectionCount(1);
int gen2Collections = GC.CollectionCount(2);
long totalMemory = GC.GetTotalMemory(forceFullCollection: false);

// Detailed info
GCMemoryInfo info = GC.GetGCMemoryInfo();
Console.WriteLine($"Heap size: {info.HeapSizeBytes}");
Console.WriteLine($"Fragmented: {info.FragmentedBytes}");
Console.WriteLine($"High memory: {info.HighMemoryLoadThresholdBytes}");

// Generation sizes
foreach (var genInfo in info.GenerationInfo)
{
    Console.WriteLine($"Gen{genInfo.Generation}: {genInfo.SizeAfterBytes}");
}
```

### Finding Memory Leaks

Common leak patterns:
- Event handlers not unsubscribed
- Static collections growing unbounded
- Closures capturing objects unintentionally
- Circular references with weak references

```csharp
// LEAK: Event handler keeps subscriber alive
public class Publisher
{
    public event EventHandler? DataChanged;
}

public class Subscriber
{
    public Subscriber(Publisher pub)
    {
        pub.DataChanged += OnDataChanged;  // Publisher references Subscriber
    }

    private void OnDataChanged(object? sender, EventArgs e) { }
}

// FIX: Unsubscribe or use weak events
public class SafeSubscriber : IDisposable
{
    private readonly Publisher _publisher;

    public SafeSubscriber(Publisher pub)
    {
        _publisher = pub;
        _publisher.DataChanged += OnDataChanged;
    }

    public void Dispose()
    {
        _publisher.DataChanged -= OnDataChanged;
    }
}
```

### WeakReference for Caches

```csharp
public class WeakCache<TKey, TValue> where TKey : notnull where TValue : class
{
    private readonly Dictionary<TKey, WeakReference<TValue>> _cache = new();

    public void Add(TKey key, TValue value)
    {
        _cache[key] = new WeakReference<TValue>(value);
    }

    public TValue? Get(TKey key)
    {
        if (_cache.TryGetValue(key, out var weakRef))
        {
            if (weakRef.TryGetTarget(out var value))
                return value;

            _cache.Remove(key);  // Clean up dead reference
        }
        return null;
    }
}
```

## GC Control (Use Sparingly)

```csharp
// Force collection (rarely needed)
GC.Collect();                    // All generations
GC.Collect(0);                   // Gen0 only
GC.Collect(2, GCCollectionMode.Optimized);  // Let GC decide

// Wait for finalizers
GC.WaitForPendingFinalizers();

// No-GC region for real-time scenarios
if (GC.TryStartNoGCRegion(1024 * 1024))  // 1MB allocation budget
{
    try
    {
        PerformRealTimeWork();
    }
    finally
    {
        GC.EndNoGCRegion();
    }
}

// Keep object alive past last use
void ProcessWithHandle(object resource)
{
    var handle = CreateHandle(resource);
    Process(handle);
    GC.KeepAlive(resource);  // Ensure resource not collected during Process
}
```

## Best Practices

### Do

- Let GC manage memory automatically
- Use `using` statements for IDisposable resources
- Pool frequently allocated temporary objects
- Prefer value types for small, immutable data
- Use Span<T> for slicing without allocation

### Don't

- Call `GC.Collect()` without profiling justification
- Implement finalizers unless wrapping unmanaged resources directly
- Hold references longer than needed
- Allocate large objects frequently
- Ignore memory warnings from profilers

## Key Takeaways

**Trust the GC**: It's highly optimized. Manual intervention rarely helps and often hurts.

**Reduce allocations**: Fewer allocations means less GC work. Use pooling, Span<T>, and value types strategically.

**Dispose deterministically**: Use `using` for unmanaged resources. Don't rely on finalizers for cleanup.

**Profile before optimizing**: Use profilers to identify actual memory issues before adding complexity.

**Watch for leaks**: Event handlers, static collections, and captured closures are common leak sources.

**LOH awareness**: Large objects have different lifecycle. Pool them or break into smaller chunks when possible.
