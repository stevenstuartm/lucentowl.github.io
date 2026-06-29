---
title: "C# Synchronization Primitives"
layout: guide
category: ".NET & C#"
subcategory: "Async & Concurrency"
description: "Thread synchronization with locks, semaphores, mutexes, and signaling mechanisms for safe concurrent programming."
tags: [c-sharp, dotnet, concurrency, threading, synchronization, advanced]
---

## Why Synchronization Matters

When multiple threads access shared state, you need synchronization to prevent race conditions, data corruption, and unpredictable behavior. Without proper synchronization, operations that appear atomic can be interrupted mid-execution.

```csharp
// Race condition - NOT thread-safe
private int counter = 0;

public void IncrementBad()
{
    counter++;  // Read-modify-write is not atomic
}

// Two threads calling IncrementBad() simultaneously:
// Thread A reads counter = 0
// Thread B reads counter = 0
// Thread A writes counter = 1
// Thread B writes counter = 1
// Result: 1 instead of 2
```

## The lock Statement

The most common synchronization mechanism. Provides mutual exclusion for a critical section.

```csharp
private readonly object _lock = new();
private int counter = 0;

public void IncrementSafe()
{
    lock (_lock)
    {
        counter++;  // Only one thread at a time
    }
}

// lock is syntactic sugar for Monitor.Enter/Exit
public void IncrementEquivalent()
{
    bool lockTaken = false;
    try
    {
        Monitor.Enter(_lock, ref lockTaken);
        counter++;
    }
    finally
    {
        if (lockTaken)
            Monitor.Exit(_lock);
    }
}
```

### Lock Best Practices

```csharp
// GOOD: Private, dedicated lock object
private readonly object _stateLock = new();

// BAD: Locking on 'this' - external code could deadlock
public void Bad1()
{
    lock (this) { }  // Avoid
}

// BAD: Locking on Type - global lock across app domain
public void Bad2()
{
    lock (typeof(MyClass)) { }  // Avoid
}

// BAD: Locking on string - interned strings shared
public void Bad3()
{
    lock ("mylock") { }  // Avoid
}

// GOOD: Minimal lock scope
public void GoodPattern()
{
    var localCopy;
    lock (_stateLock)
    {
        localCopy = _sharedData;  // Quick copy inside lock
    }
    ProcessData(localCopy);  // Long operation outside lock
}
```

## Lock Type (C# 13)

.NET 9 introduces a dedicated `Lock` type with better performance than `object` locks.

```csharp
using System.Threading;

public class SafeCounter
{
    private readonly Lock _lock = new();
    private int _count;

    public void Increment()
    {
        lock (_lock)  // Uses Lock.EnterScope() under the hood
        {
            _count++;
        }
    }

    // Explicit scope usage
    public int GetAndReset()
    {
        using (_lock.EnterScope())
        {
            var value = _count;
            _count = 0;
            return value;
        }
    }

    // Try to acquire with timeout
    public bool TryIncrement(TimeSpan timeout)
    {
        if (_lock.TryEnter(timeout))
        {
            try
            {
                _count++;
                return true;
            }
            finally
            {
                _lock.Exit();
            }
        }
        return false;
    }
}
```

## Monitor Class

The underlying mechanism for `lock`. Provides additional capabilities like TryEnter and Wait/Pulse.

```csharp
private readonly object _lock = new();

// Try to acquire lock with timeout
public bool TryProcess(TimeSpan timeout)
{
    if (Monitor.TryEnter(_lock, timeout))
    {
        try
        {
            DoWork();
            return true;
        }
        finally
        {
            Monitor.Exit(_lock);
        }
    }
    return false;  // Couldn't acquire lock in time
}

// Wait and Pulse for producer-consumer scenarios
private Queue<int> _queue = new();
private readonly object _queueLock = new();

public void Enqueue(int item)
{
    lock (_queueLock)
    {
        _queue.Enqueue(item);
        Monitor.Pulse(_queueLock);  // Wake one waiting thread
    }
}

public int Dequeue()
{
    lock (_queueLock)
    {
        while (_queue.Count == 0)
        {
            Monitor.Wait(_queueLock);  // Release lock and wait
        }
        return _queue.Dequeue();
    }
}
```

## SemaphoreSlim

Controls access to a resource pool. Allows N concurrent accesses.

```csharp
// Allow up to 3 concurrent operations
private readonly SemaphoreSlim _semaphore = new(3);

public async Task ProcessAsync()
{
    await _semaphore.WaitAsync();  // Blocks if 3 already active
    try
    {
        await DoWorkAsync();
    }
    finally
    {
        _semaphore.Release();
    }
}

// Useful for rate limiting
public class RateLimiter
{
    private readonly SemaphoreSlim _limiter;

    public RateLimiter(int maxConcurrent)
    {
        _limiter = new SemaphoreSlim(maxConcurrent, maxConcurrent);
    }

    public async Task<T> ExecuteAsync<T>(Func<Task<T>> operation)
    {
        await _limiter.WaitAsync();
        try
        {
            return await operation();
        }
        finally
        {
            _limiter.Release();
        }
    }
}

// With timeout
public async Task<bool> TryProcessAsync(TimeSpan timeout)
{
    if (await _semaphore.WaitAsync(timeout))
    {
        try
        {
            await DoWorkAsync();
            return true;
        }
        finally
        {
            _semaphore.Release();
        }
    }
    return false;
}
```

### SemaphoreSlim vs Semaphore

| Feature | SemaphoreSlim | Semaphore |
|---------|---------------|-----------|
| Cross-process | No | Yes (named) |
| Async support | Yes (WaitAsync) | No |
| Performance | Better | Slower (kernel object) |
| Use case | In-process throttling | Cross-process coordination |

## Mutex

Mutual exclusion across processes. Use for cross-process synchronization.

```csharp
// Named mutex for single-instance application
public class SingleInstance : IDisposable
{
    private readonly Mutex _mutex;
    private readonly bool _hasHandle;

    public SingleInstance(string appName)
    {
        _mutex = new Mutex(false, $"Global\\{appName}");
        try
        {
            _hasHandle = _mutex.WaitOne(0, false);
        }
        catch (AbandonedMutexException)
        {
            // Previous instance crashed while holding mutex
            _hasHandle = true;
        }
    }

    public bool IsFirstInstance => _hasHandle;

    public void Dispose()
    {
        if (_hasHandle)
            _mutex.ReleaseMutex();
        _mutex.Dispose();
    }
}

// Usage
using var instance = new SingleInstance("MyApplication");
if (!instance.IsFirstInstance)
{
    Console.WriteLine("Application already running");
    return;
}
```

## ReaderWriterLockSlim

Allows multiple readers or one writer. Optimal when reads far outnumber writes.

```csharp
public class ThreadSafeCache<TKey, TValue> where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _cache = new();
    private readonly ReaderWriterLockSlim _lock = new();

    public TValue? Get(TKey key)
    {
        _lock.EnterReadLock();  // Multiple readers allowed
        try
        {
            return _cache.TryGetValue(key, out var value) ? value : default;
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public void Set(TKey key, TValue value)
    {
        _lock.EnterWriteLock();  // Exclusive access
        try
        {
            _cache[key] = value;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    public TValue GetOrAdd(TKey key, Func<TKey, TValue> factory)
    {
        // Try read first
        _lock.EnterUpgradeableReadLock();
        try
        {
            if (_cache.TryGetValue(key, out var value))
                return value;

            // Upgrade to write lock
            _lock.EnterWriteLock();
            try
            {
                // Double-check after acquiring write lock
                if (_cache.TryGetValue(key, out value))
                    return value;

                value = factory(key);
                _cache[key] = value;
                return value;
            }
            finally
            {
                _lock.ExitWriteLock();
            }
        }
        finally
        {
            _lock.ExitUpgradeableReadLock();
        }
    }

    public void Dispose()
    {
        _lock.Dispose();
    }
}
```

### When to Use ReaderWriterLockSlim

- Read-heavy workloads (reads >> writes)
- Lock held for significant time
- Many concurrent readers expected

For short critical sections with balanced read/write, simple `lock` often performs better due to lower overhead.

## Signaling with Events

### ManualResetEvent and ManualResetEventSlim

Remains signaled until manually reset. All waiting threads released simultaneously.

```csharp
// ManualResetEventSlim - lightweight, for in-process use
private readonly ManualResetEventSlim _startSignal = new(false);

public void WaitForStart()
{
    _startSignal.Wait();  // Block until signaled
    DoWork();
}

public void StartAll()
{
    _startSignal.Set();  // Release all waiting threads
}

public void Reset()
{
    _startSignal.Reset();  // Reset to non-signaled state
}

// Common pattern: coordinated startup
public class CoordinatedWorkers
{
    private readonly ManualResetEventSlim _ready = new(false);
    private readonly List<Task> _workers = new();

    public void AddWorker(Action<CancellationToken> work, CancellationToken ct)
    {
        _workers.Add(Task.Run(() =>
        {
            _ready.Wait(ct);  // Wait for signal
            work(ct);
        }, ct));
    }

    public void StartAll()
    {
        _ready.Set();  // All workers start simultaneously
    }
}
```

### AutoResetEvent

Automatically resets after releasing one waiting thread. Like a turnstile.

```csharp
private readonly AutoResetEvent _signal = new(false);

// Producer
public void Produce(int item)
{
    ProcessItem(item);
    _signal.Set();  // Release one waiting consumer
}

// Consumer (one released per Set())
public void Consume()
{
    _signal.WaitOne();  // Wait for signal, then auto-reset
    ProcessNextItem();
}

// Pattern: single-item handoff
public class SingleItemChannel<T>
{
    private T? _item;
    private readonly AutoResetEvent _hasItem = new(false);
    private readonly AutoResetEvent _itemTaken = new(true);

    public void Send(T item)
    {
        _itemTaken.WaitOne();  // Wait for previous item to be taken
        _item = item;
        _hasItem.Set();  // Signal item available
    }

    public T Receive()
    {
        _hasItem.WaitOne();  // Wait for item
        var item = _item!;
        _item = default;
        _itemTaken.Set();  // Signal item taken
        return item;
    }
}
```

### CountdownEvent

Signals when a count reaches zero. Useful for fork-join parallelism.

```csharp
public void ProcessInParallel(List<Work> items)
{
    using var countdown = new CountdownEvent(items.Count);

    foreach (var item in items)
    {
        ThreadPool.QueueUserWorkItem(_ =>
        {
            try
            {
                item.Process();
            }
            finally
            {
                countdown.Signal();  // Decrement count
            }
        });
    }

    countdown.Wait();  // Block until all complete
    Console.WriteLine("All items processed");
}

// Dynamic work - can add more work
public void DynamicProcessing()
{
    using var countdown = new CountdownEvent(1);  // Start with 1

    void ProcessNode(Node node)
    {
        foreach (var child in node.Children)
        {
            countdown.AddCount();  // Add work
            ThreadPool.QueueUserWorkItem(_ =>
            {
                ProcessNode(child);
                countdown.Signal();
            });
        }
    }

    ProcessNode(root);
    countdown.Signal();  // Signal initial count
    countdown.Wait();
}
```

### Barrier

Synchronizes multiple threads at a rendezvous point.

```csharp
// Three threads that must synchronize at each phase
private readonly Barrier _barrier = new(3, barrier =>
{
    Console.WriteLine($"Phase {barrier.CurrentPhaseNumber} complete");
});

public void WorkerThread(int id)
{
    for (int phase = 0; phase < 5; phase++)
    {
        DoPhaseWork(id, phase);
        _barrier.SignalAndWait();  // Wait for all threads
    }
}

// Practical example: parallel image processing with phases
public void ProcessImageInParallel(byte[,] image)
{
    int threadCount = Environment.ProcessorCount;
    using var barrier = new Barrier(threadCount);

    Parallel.For(0, threadCount, threadId =>
    {
        int startRow = threadId * (image.GetLength(0) / threadCount);
        int endRow = (threadId + 1) * (image.GetLength(0) / threadCount);

        // Phase 1: Blur
        ApplyBlur(image, startRow, endRow);
        barrier.SignalAndWait();

        // Phase 2: Edge detection (needs blur complete)
        DetectEdges(image, startRow, endRow);
        barrier.SignalAndWait();

        // Phase 3: Enhancement
        Enhance(image, startRow, endRow);
    });
}
```

## Interlocked Operations

Lock-free atomic operations for simple updates. Best performance for simple scenarios.

```csharp
private int _counter;
private long _total;

// Atomic increment/decrement
public void IncrementCounter()
{
    Interlocked.Increment(ref _counter);
}

public int GetAndResetCounter()
{
    return Interlocked.Exchange(ref _counter, 0);
}

// Atomic add
public void AddToTotal(long amount)
{
    Interlocked.Add(ref _total, amount);
}

// Compare and swap (CAS) - fundamental lock-free operation
public bool TryUpdateIfGreater(ref int location, int newValue)
{
    int current;
    do
    {
        current = location;
        if (newValue <= current)
            return false;
    }
    while (Interlocked.CompareExchange(ref location, newValue, current) != current);
    return true;
}

// Lock-free stack using CAS
public class LockFreeStack<T>
{
    private class Node
    {
        public T Value;
        public Node? Next;
    }

    private Node? _head;

    public void Push(T value)
    {
        var node = new Node { Value = value };
        do
        {
            node.Next = _head;
        }
        while (Interlocked.CompareExchange(ref _head, node, node.Next) != node.Next);
    }

    public bool TryPop(out T value)
    {
        Node? head;
        do
        {
            head = _head;
            if (head == null)
            {
                value = default!;
                return false;
            }
        }
        while (Interlocked.CompareExchange(ref _head, head.Next, head) != head);

        value = head.Value;
        return true;
    }
}
```

## SpinLock and SpinWait

For very short critical sections where blocking overhead exceeds spin time.

```csharp
private SpinLock _spinLock = new();

public void QuickUpdate()
{
    bool lockTaken = false;
    try
    {
        _spinLock.Enter(ref lockTaken);
        // Very quick operation only
        _value++;
    }
    finally
    {
        if (lockTaken)
            _spinLock.Exit();
    }
}

// SpinWait - efficient waiting before blocking
public void WaitForCondition()
{
    SpinWait spinner = default;
    while (!_conditionMet)
    {
        spinner.SpinOnce();  // Yields to OS after spinning
    }
}

// Pattern: spin then block
public void WaitEfficiently()
{
    SpinWait spinner = default;
    while (!_conditionMet)
    {
        if (spinner.NextSpinWillYield)
        {
            // Spinning too long, use real wait
            _event.WaitOne();
            break;
        }
        spinner.SpinOnce();
    }
}
```

### When to Use SpinLock

- Critical section < 20 instructions
- Lock contention is rare
- Not holding across await/blocking operations
- Performance-critical code after profiling shows benefit

## Choosing the Right Primitive

| Scenario | Recommended Primitive |
|----------|----------------------|
| Simple mutual exclusion | `lock` or `Lock` (C# 13) |
| Rate limiting / resource pool | `SemaphoreSlim` |
| Cross-process sync | `Mutex` or `Semaphore` |
| Read-heavy cache | `ReaderWriterLockSlim` |
| One-time signaling | `ManualResetEventSlim` |
| Producer-consumer handoff | `AutoResetEvent` |
| Wait for N operations | `CountdownEvent` |
| Phased parallel work | `Barrier` |
| Simple counters | `Interlocked` |
| Very short locks | `SpinLock` (rare) |

## Common Patterns

### Double-Checked Locking

```csharp
private volatile Service? _instance;
private readonly object _lock = new();

public Service Instance
{
    get
    {
        if (_instance == null)
        {
            lock (_lock)
            {
                _instance ??= new Service();
            }
        }
        return _instance;
    }
}

// Better: Use Lazy<T>
private readonly Lazy<Service> _lazyInstance = new(() => new Service());
public Service Instance => _lazyInstance.Value;
```

### Async Lock (SemaphoreSlim)

```csharp
private readonly SemaphoreSlim _asyncLock = new(1, 1);

public async Task ProcessAsync()
{
    await _asyncLock.WaitAsync();
    try
    {
        await DoWorkAsync();
    }
    finally
    {
        _asyncLock.Release();
    }
}

// Reusable async lock wrapper
public sealed class AsyncLock
{
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public async Task<IDisposable> LockAsync()
    {
        await _semaphore.WaitAsync();
        return new Releaser(_semaphore);
    }

    private sealed class Releaser : IDisposable
    {
        private readonly SemaphoreSlim _semaphore;
        public Releaser(SemaphoreSlim semaphore) => _semaphore = semaphore;
        public void Dispose() => _semaphore.Release();
    }
}

// Usage
private readonly AsyncLock _lock = new();

public async Task SafeMethodAsync()
{
    using (await _lock.LockAsync())
    {
        await DoWorkAsync();
    }
}
```

## Deadlock Prevention

```csharp
// DEADLOCK: Acquiring locks in different order
// Thread 1: Lock A then B
// Thread 2: Lock B then A

// Solution 1: Always acquire in consistent order
private readonly object _lockA = new();
private readonly object _lockB = new();

public void Safe()
{
    lock (_lockA)        // Always A first
    {
        lock (_lockB)    // Then B
        {
            DoWork();
        }
    }
}

// Solution 2: Try-lock with timeout
public bool TryTransfer()
{
    if (Monitor.TryEnter(_lockA, TimeSpan.FromSeconds(1)))
    {
        try
        {
            if (Monitor.TryEnter(_lockB, TimeSpan.FromSeconds(1)))
            {
                try
                {
                    DoWork();
                    return true;
                }
                finally
                {
                    Monitor.Exit(_lockB);
                }
            }
        }
        finally
        {
            Monitor.Exit(_lockA);
        }
    }
    return false;  // Couldn't acquire locks
}

// Solution 3: Lock ordering by object hash
public void TransferOrdered(Account from, Account to, decimal amount)
{
    var first = from.GetHashCode() < to.GetHashCode() ? from : to;
    var second = from.GetHashCode() < to.GetHashCode() ? to : from;

    lock (first.Lock)
    {
        lock (second.Lock)
        {
            from.Withdraw(amount);
            to.Deposit(amount);
        }
    }
}
```

## Key Takeaways

**Start with lock**: The `lock` statement handles most scenarios. Only reach for other primitives when profiling shows a need.

**SemaphoreSlim for async**: The only built-in async-compatible synchronization primitive. Use for async rate limiting and resource pooling.

**Interlocked for counters**: For simple increment/decrement operations, Interlocked is lock-free and fastest.

**ReaderWriterLockSlim for read-heavy**: When reads significantly outnumber writes and locks are held for meaningful time.

**Avoid SpinLock unless profiling proves benefit**: Spinning wastes CPU. Only use for extremely short critical sections.

**Consistent lock ordering prevents deadlocks**: Always acquire multiple locks in the same order across all code paths.

**Minimize lock scope**: Hold locks for the shortest time possible. Copy data inside locks, process outside.
