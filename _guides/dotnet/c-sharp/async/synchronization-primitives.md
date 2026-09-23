---
title: "C# Synchronization Primitives"
layout: guide
category: ".NET & C#"
subcategory: "Async & Concurrency"
description: "Coordinating threads that share state in .NET: lock, Monitor, and the .NET 9 Lock type, why await can't cross a lock, SemaphoreSlim as the async lock, Mutex and cross-process locks, ReaderWriterLockSlim, signaling with events, CountdownEvent and Barrier, Interlocked and lock-free updates, spinning, and avoiding deadlock."
tags: [synchronization, lock, semaphoreslim, interlocked, deadlock, concurrency, advanced]
---

## Why Synchronization Matters

When threads share mutable state, an operation that reads as one step in C# can be several steps to the processor, and another thread can run between them:

```csharp
private int counter = 0;

public void IncrementBad()
{
    counter++;   // read, add, write: three steps
}

// Two threads calling IncrementBad() at once:
// Thread A reads counter = 0
// Thread B reads counter = 0
// Thread A writes counter = 1
// Thread B writes counter = 1
// Result: 1 instead of 2
```

A synchronization primitive makes such a sequence behave as one step, either by letting only one thread into it at a time (a lock) or by using a processor instruction that is atomic (`Interlocked`). Locks and `Interlocked` operations also act as memory barriers, so a value written by one thread inside a lock is visible to the next thread that takes the lock. Without them, the compiler and CPU are free to cache and reorder reads and writes.

## The lock Statement

`lock` gives mutual exclusion: while one thread is inside the block, any other thread reaching a `lock` on the same object waits.

```csharp
private readonly object _lock = new();
private int counter = 0;

public void IncrementSafe()
{
    lock (_lock)
    {
        counter++;   // one thread at a time
    }
}
```

On an ordinary object, `lock` compiles to `Monitor.Enter` and `Monitor.Exit` in a `try`/`finally`, so the lock is released even if the block throws:

```csharp
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
```

A `Monitor` lock is **reentrant**: a thread that already holds it can enter it again, as happens when one locked method calls another. It is also **owned by a thread**, which is the reason for the next rule.

### No await Inside a lock

```csharp
lock (_lock)
{
    await SaveAsync();   // error CS1996: cannot await in the body of a lock statement
}
```

The code after an `await` may resume on a different thread, and `Monitor.Exit` must be called by the thread that entered. The compiler therefore rejects `await` inside `lock`. To hold mutual exclusion across an `await`, use `SemaphoreSlim`, covered below.

### Lock Best Practices

```csharp
// GOOD: a private object that exists only to be locked
private readonly object _stateLock = new();

// BAD: other code can lock the same object and interfere or deadlock
lock (this) { }
lock (typeof(MyClass)) { }   // shared by every caller in the process
lock ("mylock") { }          // interned: every identical literal is the same object

// GOOD: copy under the lock, do the slow work outside it
public void Report()
{
    Snapshot copy;
    lock (_stateLock)
    {
        copy = _state.Snapshot();
    }
    Publish(copy);
}
```

Hold a lock only for the shared-state access itself. A lock held across I/O or a long computation makes every other thread that needs it wait for that work.

## The Lock Type (.NET 9, C# 13)

.NET 9 added `System.Threading.Lock`, a type that exists only to be locked. When the object in a `lock` statement is a `Lock`, the C# 13 compiler calls `Lock.EnterScope()` instead of using `Monitor`, which states the intent and uses a lock implementation designed for the purpose.

```csharp
public class SafeCounter
{
    private readonly Lock _lock = new();
    private int _count;

    public void Increment()
    {
        lock (_lock)   // compiles to _lock.EnterScope()
        {
            _count++;
        }
    }

    public bool TryIncrement(TimeSpan timeout)
    {
        if (!_lock.TryEnter(timeout))
            return false;

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
}
```

The special handling depends on the static type. A `Lock` stored in an `object` variable or passed as `object` falls back to `Monitor`, and the compiler flags the conversion with warning CS9216. Keep `Lock` fields typed as `Lock`.

## Monitor

`Monitor` is what `lock` uses on ordinary objects, and it offers two things `lock` doesn't: a timed attempt, and waiting for a condition while releasing the lock.

```csharp
public bool TryProcess(TimeSpan timeout)
{
    if (!Monitor.TryEnter(_lock, timeout))
        return false;   // couldn't get the lock in time

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
```

`Monitor.Wait` releases the lock and sleeps until another thread calls `Monitor.Pulse` on the same object, then reacquires it before returning:

```csharp
private readonly Queue<int> _queue = new();
private readonly object _queueLock = new();

public void Enqueue(int item)
{
    lock (_queueLock)
    {
        _queue.Enqueue(item);
        Monitor.Pulse(_queueLock);   // wake one waiting thread
    }
}

public int Dequeue()
{
    lock (_queueLock)
    {
        while (_queue.Count == 0)        // loop: re-check after every wake-up
            Monitor.Wait(_queueLock);
        return _queue.Dequeue();
    }
}
```

The `while` rather than `if` matters: by the time a woken thread reacquires the lock, another thread may already have taken the item. In new code, a `BlockingCollection<T>` or a channel does this job without hand-written signaling.

## SemaphoreSlim

A semaphore holds a count of available slots. `Wait` takes a slot, waiting if none is free, and `Release` returns one. A count of 1 makes it a lock; a count of N lets N callers in at once.

`SemaphoreSlim` is the one built-in lock with an awaitable wait, which makes it the standard way to hold mutual exclusion across `await`:

```csharp
private readonly SemaphoreSlim _gate = new(1, 1);

public async Task UpdateAsync(CancellationToken ct)
{
    await _gate.WaitAsync(ct);   // waits asynchronously, holding no thread
    try
    {
        var current = await LoadAsync(ct);
        await SaveAsync(Apply(current), ct);
    }
    finally
    {
        _gate.Release();
    }
}
```

Two differences from `lock` cause bugs:

- **It isn't reentrant.** A method holding the semaphore that calls another method which waits on the same semaphore waits forever. With `lock` that would have worked.
- **It has no owner.** Any code can call `Release`, and releasing more times than you acquired raises the count above its intended maximum unless the constructor's `maxCount` stops it with a `SemaphoreFullException`. Always pair `WaitAsync` and `Release` with `try`/`finally`.

With a count above one, the same pattern limits concurrency, such as allowing at most three calls to a remote service at a time:

```csharp
private readonly SemaphoreSlim _slots = new(3, 3);

public async Task<T> RunLimitedAsync<T>(Func<Task<T>> operation, CancellationToken ct)
{
    await _slots.WaitAsync(ct);
    try
    {
        return await operation();
    }
    finally
    {
        _slots.Release();
    }
}
```

That limits how many calls run at once, not how many start per second. For rate limits, the `System.Threading.RateLimiting` package (from .NET 7, and included in ASP.NET Core's shared framework) provides token-bucket, fixed-window, and sliding-window limiters alongside a `ConcurrencyLimiter`.

## Cross-Process Locks: Mutex and Semaphore

`SemaphoreSlim` and `lock` work within one process. To coordinate separate processes, the kernel-backed `Mutex` and `Semaphore` accept a name, and every process that opens the same name gets the same object.

| Feature | `SemaphoreSlim` | `Semaphore` | `Mutex` |
| --- | --- | --- | --- |
| Cross-process (named) | No | Yes, Windows only | Yes |
| Async wait | Yes (`WaitAsync`) | No | No |
| Owned by a thread | No | No | Yes |
| Cost | Cheap, user mode | Kernel call | Kernel call |

Named semaphores are not supported on Unix-based systems. Named mutexes are, with the restriction that the name must be a valid file name.

```csharp
// Detect a second instance of the application
public sealed class SingleInstance : IDisposable
{
    private readonly Mutex _mutex;
    private readonly bool _owned;

    public SingleInstance(string appName)
    {
        _mutex = new Mutex(initiallyOwned: false, $"Global\\{appName}");
        try
        {
            _owned = _mutex.WaitOne(0);
        }
        catch (AbandonedMutexException)
        {
            _owned = true;   // a previous instance exited without releasing it
        }
    }

    public bool IsFirstInstance => _owned;

    public void Dispose()
    {
        if (_owned)
            _mutex.ReleaseMutex();
        _mutex.Dispose();
    }
}
```

A `Mutex` is owned by the thread that acquired it, and releasing it from any other thread throws `ApplicationException`. That makes it unusable across an `await`, which may resume on a different thread. Acquire and release it in synchronous code on one thread.

## ReaderWriterLockSlim

`ReaderWriterLockSlim` lets any number of readers in at once, or one writer alone. It pays off when reads greatly outnumber writes and each read holds the lock long enough for readers to overlap.

```csharp
public sealed class ReadMostlyCache<TKey, TValue> : IDisposable where TKey : notnull
{
    private readonly Dictionary<TKey, TValue> _cache = new();
    private readonly ReaderWriterLockSlim _lock = new();

    public bool TryGet(TKey key, out TValue? value)
    {
        _lock.EnterReadLock();   // many readers at once
        try
        {
            return _cache.TryGetValue(key, out value);
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public void Set(TKey key, TValue value)
    {
        _lock.EnterWriteLock();   // exclusive
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
        _lock.EnterUpgradeableReadLock();   // one upgrader at a time, readers still allowed
        try
        {
            if (_cache.TryGetValue(key, out var value))
                return value;

            _lock.EnterWriteLock();          // upgrade without releasing
            try
            {
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

    public void Dispose() => _lock.Dispose();
}
```

For short critical sections, a plain `lock` is often faster, since reader-writer bookkeeping costs more per acquisition. For a shared dictionary specifically, `ConcurrentDictionary<TKey, TValue>` already gives lock-free reads. Like `Mutex`, `ReaderWriterLockSlim` is owned by a thread: exiting from a different thread throws `SynchronizationLockException`, so it can't span an `await` either.

## Signaling with Events

A lock protects data. An event does something different: it lets one thread tell others that something has happened.

### ManualResetEventSlim

Once `Set`, it stays signaled and releases every waiting thread, and every later `Wait` returns immediately, until `Reset` is called. It suits one-time conditions like "initialization finished":

```csharp
private readonly ManualResetEventSlim _initialized = new(false);

public void Initialize()
{
    LoadConfiguration();
    _initialized.Set();   // releases every waiting thread
}

public void HandleRequest()
{
    _initialized.Wait();  // returns immediately once Set
    Serve();
}
```

`ManualResetEventSlim` and `SemaphoreSlim` spin briefly before blocking, so a signal that arrives quickly never pays for a kernel wait. The non-`Slim` `ManualResetEvent` is a kernel object, needed only for waiting on several handles at once with `WaitHandle.WaitAny` or for cross-process signaling.

### AutoResetEvent

`AutoResetEvent` releases exactly one waiting thread per `Set` and then resets itself, like a turnstile that admits one person per token. It supports simple one-at-a-time handoff:

```csharp
public sealed class SingleItemHandoff<T>
{
    private T? _item;
    private readonly AutoResetEvent _hasItem = new(false);
    private readonly AutoResetEvent _slotFree = new(true);

    public void Send(T item)
    {
        _slotFree.WaitOne();   // wait until the previous item was taken
        _item = item;
        _hasItem.Set();
    }

    public T Receive()
    {
        _hasItem.WaitOne();
        var item = _item!;
        _item = default;
        _slotFree.Set();
        return item;
    }
}
```

A `Set` with no thread waiting is remembered only once: two `Set` calls before anyone waits release one waiter, not two. For queues of work, a channel or `BlockingCollection<T>` is almost always the better tool.

### CountdownEvent

`CountdownEvent` is signaled when its count reaches zero, so a thread can wait for N other operations to report in:

```csharp
using var remaining = new CountdownEvent(items.Count);

foreach (var item in items)
{
    ThreadPool.QueueUserWorkItem(_ =>
    {
        try { item.Process(); }
        finally { remaining.Signal(); }   // always count down, even on failure
    });
}

remaining.Wait();   // blocks until every item has signaled
```

When the work items are tasks, `Task.WhenAll` expresses the same wait without a shared counter.

### Barrier

A `Barrier` makes a fixed set of participants meet at the end of each phase: every participant calls `SignalAndWait`, and none continues until all have arrived. It suits algorithms whose phases each need the previous phase finished everywhere, such as a simulation that updates all cells and then all boundaries.

```csharp
int workers = Environment.ProcessorCount;
using var barrier = new Barrier(workers, b => Console.WriteLine($"Phase {b.CurrentPhaseNumber} done"));

var tasks = Enumerable.Range(0, workers).Select(id =>
    Task.Factory.StartNew(() =>
    {
        for (int phase = 0; phase < 5; phase++)
        {
            DoPhaseWork(id, phase);
            barrier.SignalAndWait();   // wait for every participant
        }
    }, TaskCreationOptions.LongRunning)).ToArray();

Task.WaitAll(tasks);
```

Every participant must be running at the same time, or the ones that arrive wait for one that never starts. That is why the example gives each participant its own thread. Driving a `Barrier` from `Parallel.For` risks exactly that stall, because `Parallel.For` doesn't guarantee its iterations run concurrently: it may run them on fewer threads than there are iterations, leaving a waiting iteration blocking the thread another one needs.

## Interlocked Operations

`Interlocked` performs single operations on a variable atomically, using processor instructions rather than a lock. For a counter or a flag, it is the cheapest correct option.

```csharp
private int _counter;
private long _total;

public void Increment() => Interlocked.Increment(ref _counter);
public void AddToTotal(long amount) => Interlocked.Add(ref _total, amount);
public int GetAndReset() => Interlocked.Exchange(ref _counter, 0);
```

`CompareExchange` is the building block for everything else: it writes a new value only if the variable still holds the value you expected, and returns what was there. A loop around it performs any update atomically, retrying if another thread got in first:

```csharp
public static bool TryRaise(ref int location, int candidate)
{
    int current;
    do
    {
        current = Volatile.Read(ref location);
        if (candidate <= current)
            return false;   // nothing to do
    }
    while (Interlocked.CompareExchange(ref location, candidate, current) != current);

    return true;
}
```

The same retry loop works on references, which enables lock-free structures:

```csharp
public sealed class LockFreeStack<T>
{
    private sealed class Node(T value, Node? next)
    {
        public T Value { get; } = value;
        public Node? Next { get; } = next;
    }

    private Node? _head;

    public void Push(T value)
    {
        Node? head;
        do
        {
            head = Volatile.Read(ref _head);
        }
        while (Interlocked.CompareExchange(ref _head, new Node(value, head), head) != head);
    }

    public bool TryPop(out T value)
    {
        Node? head;
        do
        {
            head = Volatile.Read(ref _head);
            if (head is null)
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

Lock-free code is hard to get right and easy to get subtly wrong. `ConcurrentStack<T>` and `ConcurrentQueue<T>` already implement these structures, and the example is here to show the technique rather than to be copied.

## SpinLock and SpinWait

Blocking a thread costs a trip into the kernel. For a lock held only for a handful of instructions, spinning in a loop until it frees up can be cheaper.

```csharp
private SpinLock _spinLock = new();   // a struct: never readonly, never copied

public void QuickUpdate()
{
    bool taken = false;
    try
    {
        _spinLock.Enter(ref taken);
        _value++;
    }
    finally
    {
        if (taken)
            _spinLock.Exit();
    }
}
```

`SpinLock` is a mutable struct. Marking the field `readonly` or copying it into a local makes each operation act on a copy, and the lock silently stops protecting anything.

Spinning burns a core for as long as it waits, so `SpinLock` is only a win when the lock is held very briefly and rarely contended, and a benchmark shows it beating `lock`. `Monitor`, `SemaphoreSlim`, and `ManualResetEventSlim` already spin briefly before they block, which captures most of the benefit without the risk. `SpinWait` is the helper they use: each `SpinOnce` spins a little longer and eventually yields the thread.

## Choosing the Right Primitive

| Need | Primitive |
| --- | --- |
| Protect shared state, synchronous code | `lock` on a `Lock` (.NET 9) or a private `object` |
| Protect shared state across `await` | `SemaphoreSlim(1, 1)` |
| Cap concurrent operations | `SemaphoreSlim(n, n)`, or `Parallel.ForEachAsync` |
| Cap operations per second | `System.Threading.RateLimiting` |
| Coordinate separate processes | Named `Mutex` (or named `Semaphore` on Windows) |
| Many readers, rare writers, long reads | `ReaderWriterLockSlim` |
| Tell waiting threads a condition is now true | `ManualResetEventSlim` |
| Wait for N operations | `CountdownEvent`, or `Task.WhenAll` for tasks |
| Phased work across a fixed set of threads | `Barrier` |
| Update a single counter or reference | `Interlocked` |
| Hand work from producers to consumers | A channel or `BlockingCollection<T>` |

## Lazy Initialization Under Contention

Creating a shared object on first use needs the creation to happen once even when several threads ask at the same moment. `Lazy<T>` does this correctly with no hand-written locking:

```csharp
private readonly Lazy<Service> _service = new(() => new Service());
public Service Service => _service.Value;   // created once, on first access
```

The hand-written equivalent is double-checked locking, which needs the field to be `volatile` so that a thread outside the lock can't see a reference to a half-constructed object:

```csharp
private volatile Service? _instance;
private readonly Lock _lock = new();

public Service Instance
{
    get
    {
        if (_instance is null)
        {
            lock (_lock)
            {
                _instance ??= new Service();
            }
        }
        return _instance;
    }
}
```

Prefer `Lazy<T>`. The manual version exists in older code and is easy to break by dropping `volatile` or the second check.

## Deadlock Prevention

A deadlock needs two threads each holding a lock the other wants. Thread 1 takes A then waits for B, and thread 2 takes B then waits for A. Neither can proceed, and neither will ever release what it holds.

**Always acquire locks in one global order.** If every code path takes A before B, the cycle can't form:

```csharp
public void Transfer(Account from, Account to, decimal amount)
{
    // Order by a unique, stable key, never by GetHashCode, which can collide
    var (first, second) = from.Id < to.Id ? (from, to) : (to, from);

    lock (first.SyncRoot)
    {
        lock (second.SyncRoot)
        {
            from.Withdraw(amount);
            to.Deposit(amount);
        }
    }
}
```

**Or give up instead of waiting forever.** `Monitor.TryEnter` with a timeout turns a potential deadlock into a failed attempt the caller can retry or report:

```csharp
public bool TryTransfer(TimeSpan timeout)
{
    if (!Monitor.TryEnter(_lockA, timeout))
        return false;
    try
    {
        if (!Monitor.TryEnter(_lockB, timeout))
            return false;
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
    finally
    {
        Monitor.Exit(_lockA);
    }
}
```

**And don't call out while holding a lock.** Invoking an event, a callback, or a virtual method inside a lock runs code you don't control, which may take its own locks in an order you can't see.

## Key Takeaways

**Start with `lock`.** It handles most shared-state protection. On .NET 9 and later, lock on a private `Lock` field.

**Use `SemaphoreSlim` across `await`.** `lock`, `Mutex`, and `ReaderWriterLockSlim` belong to a thread, and an `await` can resume on a different one. Remember that `SemaphoreSlim` isn't reentrant.

**Use `Interlocked` for single-variable updates.** It is atomic and needs no lock.

**Hold locks briefly.** Copy the shared state inside the lock and do the slow work outside it.

**Prevent deadlocks by ordering.** Take multiple locks in one consistent order, keyed on something unique, and don't run foreign code while holding a lock.

**Prefer higher-level tools.** Concurrent collections, channels, `Lazy<T>`, and `Task.WhenAll` replace most hand-built signaling with code that is already correct.
