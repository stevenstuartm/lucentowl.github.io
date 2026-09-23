---
title: "Benchmarking and Diagnostics"
layout: guide
category: ".NET & C#"
subcategory: "Tooling & Quality"
description: "Measuring whether a change made .NET code faster, and finding out what a running process is doing: writing BenchmarkDotNet benchmarks that mean something, reading their output, and using dotnet-counters, dotnet-trace, dotnet-gcdump, and dotnet-dump to diagnose CPU, allocation, and memory problems."
tags: [advanced, benchmarkdotnet, dotnet-counters, dotnet-trace, dotnet-dump, profiling, garbage-collection]
---

## Two Different Questions

Performance work in .NET splits into two questions that need different tools.

- **Is this code faster than that code?** A **benchmark** answers it. It runs a small piece of code in isolation, many thousands of times, under controlled conditions, and reports a time and an allocation figure you can compare.
- **Why is this running process slow, busy, or growing?** **Diagnostics** answer it. They attach to a real process, under real load, and report what the runtime is doing: how often the GC runs, where CPU time goes, which objects fill the heap.

A benchmark can't tell you where production time goes, and a trace can't tell you whether your rewrite of one method is faster. Confusing the two is the most common way to optimize the wrong thing. The usual order is diagnostics first to find the hot spot, a benchmark to compare fixes for it, then diagnostics again to confirm the fix mattered under real load.

How to plan performance work as a whole, including load testing and capacity planning, is a methodology question beyond this guide. This guide covers the .NET tools.

---

## Why Timing Code Yourself Misleads

The obvious approach is a `Stopwatch` around a loop. On .NET it gives numbers that are wrong in ways that look plausible:

- **The first calls measure the JIT, not your code.** A method's first run includes compiling it. Tiered compilation then recompiles hot methods with better optimizations after they have run a number of times, so the same method gets faster partway through the loop.
- **Unused results get optimized away.** If the code under test computes a value nothing reads, the JIT can remove the computation, and the loop measures nothing.
- **One run is noise.** Timer resolution, other processes, CPU frequency scaling, and a GC that happens to land inside the measurement all move a single result by more than most optimizations are worth.
- **Debug builds measure a different program.** Without optimization, the JIT keeps every local alive and inlines nothing, so a Debug timing says little about Release behaviour.

A benchmark harness exists to handle all four.

---

## BenchmarkDotNet

[BenchmarkDotNet](https://benchmarkdotnet.org){:target="_blank" rel="noopener noreferrer"} is the standard benchmark harness for .NET, and the .NET runtime team uses it for its own performance tests. It runs each benchmark in a separate process, warms it up until tiering settles, runs enough iterations to reach a stable result, and reports statistics rather than a single number.

### Writing a Benchmark

Benchmarks live in their own console project that references the code under test. A benchmark is a public method with `[Benchmark]` in a public class:

```csharp
using System.Text;
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;

BenchmarkRunner.Run<StringBuilding>();

[MemoryDiagnoser]
public class StringBuilding
{
    [Params(10, 1000)]
    public int Count;

    [Benchmark(Baseline = true)]
    public string Concat()
    {
        string s = "";
        for (int i = 0; i < Count; i++) s += i;
        return s;
    }

    [Benchmark]
    public string Builder()
    {
        var sb = new StringBuilder();
        for (int i = 0; i < Count; i++) sb.Append(i);
        return sb.ToString();
    }
}
```

- `[Params]` runs every benchmark once per value, so one class measures how cost grows with input size.
- `[Benchmark(Baseline = true)]` makes the other results report a ratio against that one.
- `[MemoryDiagnoser]` adds the allocation columns, which are often more informative than the time.
- `[GlobalSetup]` marks a method that builds the inputs once, outside the measurement.

Each benchmark **returns** its result. BenchmarkDotNet consumes the return value, which stops the JIT from removing the work as dead code.

Run it in Release with `dotnet run -c Release`. In a Debug build BenchmarkDotNet refuses to run and reports that the assembly "is non-optimized."

### Reading the Results

Running the class above on .NET 10 produced this (with `[ShortRunJob]`, which runs fewer iterations to finish quickly):

```
| Method    | Count | Mean          | Error        | Ratio | Gen0     | Allocated | Alloc Ratio |
|---------- |------ |--------------:|-------------:|------:|---------:|----------:|------------:|
| Concat    | 10    |      55.15 ns |     23.14 ns |  1.00 |   0.0268 |     336 B |        1.00 |
| Builder   | 10    |      33.04 ns |     14.75 ns |  0.60 |   0.0121 |     152 B |        0.45 |
| Concat    | 1000  | 103,463.55 ns | 19,278.96 ns |  1.00 | 226.3184 | 2840456 B |       1.000 |
| Builder   | 1000  |   2,939.51 ns |  3,326.79 ns |  0.03 |   1.1711 |   14712 B |       0.005 |
```

| Column | Meaning |
|---|---|
| **Mean** | Average time per call |
| **Error** | Half the 99.9% confidence interval around the mean. When two means differ by less than their errors, the benchmark hasn't shown a difference |
| **Ratio** | This row's time divided by the baseline's |
| **Gen0** | Gen 0 collections per 1,000 calls |
| **Allocated** | Managed memory allocated per call |
| **Alloc Ratio** | This row's allocation divided by the baseline's |

Two lessons are in this one table. The answer depends on input size: at 10 items `StringBuilder` is about 1.7 times faster, and at 1,000 it is about 35 times faster, because concatenation copies the whole string on every append and allocates 2.8 MB to build a string of under 3,000 characters. A benchmark at one size would have given a misleading answer at the other. And the short run's errors are large, 23 ns on a 55 ns mean, which is why real comparisons use the default job and its longer runs.

### When the JIT Removes Your Benchmark

A benchmark whose result is discarded measures the empty method:

```csharp
[Benchmark]
public void Discarded() { Math.Sqrt(_x); }   // result unused

[Benchmark]
public double Returned() => Math.Sqrt(_x);   // result consumed
```

`Returned` measured 2.2 ns and `Discarded` measured 0.03 ns, which is less than a CPU cycle. BenchmarkDotNet flags it with a **ZeroMeasurement** warning: "The method duration is indistinguishable from the empty method duration." Read the warnings section of every run. A warning means that row's number doesn't measure what you think it measures.

### Comparing Runtimes and Settings

A job describes how a benchmark runs: which runtime, which JIT settings, how many iterations. Adding jobs runs every benchmark under each and puts the results side by side:

```csharp
using BenchmarkDotNet.Jobs;

[SimpleJob(RuntimeMoniker.Net80)]
[SimpleJob(RuntimeMoniker.Net10_0, baseline: true)]
[MemoryDiagnoser]
public class ParsingBenchmarks { /* ... */ }
```

The benchmark project must target every runtime it compares. The same mechanism compares server and workstation GC, or tiered compilation on and off.

### What a Microbenchmark Can't Tell You

A benchmark measures one method, alone, with warm caches, on data you chose, with no other threads competing. Production has none of those conditions. A method that is 30% faster in a benchmark can make no measurable difference to an application whose time goes to database calls, and a change that allocates less can matter far more than its benchmark time suggests, because it reduces GC work for everything else in the process. Use benchmarks to choose between implementations of code you have already shown is hot, and confirm the result with the diagnostics below.

---

## How the Diagnostic Tools Reach a Process

The .NET diagnostic tools don't need a debugger or a profiler installed in the process. Every .NET process opens a **diagnostic port**, a named pipe on Windows and a Unix domain socket elsewhere. The tools connect to it and ask the runtime to stream events through **EventPipe**, the runtime's built-in event system, or to write out its heap:

{% include figure.html id="dn-diagnostic-port" %}

That design means the tools work against any .NET process you can reach, with no code change and no restart. The port is local, so a tool must run on the same machine or in the same container, with the same user or more privileges. In a container the usual pattern is a sidecar container sharing the diagnostic socket, or the [dotnet-monitor](https://learn.microsoft.com/dotnet/core/diagnostics/dotnet-monitor){:target="_blank" rel="noopener noreferrer"} service, which exposes the same operations over HTTP. `dotnet-dump` additionally needs the `SYS_PTRACE` capability inside a container.

The tools install as .NET global tools, for example `dotnet tool install -g dotnet-counters`. With the .NET 10 SDK, `dnx dotnet-counters <args>` runs one without a permanent install. Every tool has a `ps` command that lists the .NET processes it can attach to.

---

## dotnet-counters: Is Something Wrong?

`dotnet-counters` is the first tool to reach for. It samples the runtime's built-in metrics once a second and shows them live, so a problem's shape shows up within seconds:

```bash
dotnet-counters monitor --process-id 20132 --counters System.Runtime
```

`monitor` refreshes the console in place. `collect` writes the same values to a CSV or JSON file for later analysis.

From .NET 9, the runtime publishes its metrics through `System.Diagnostics.Metrics` under names that follow OpenTelemetry conventions. The ones that answer most first questions:

| Metric | What it tells you |
|---|---|
| `dotnet.gc.heap.total_allocated` | Allocation rate. High and steady means a lot of short-lived garbage and a busy gen 0 |
| `dotnet.gc.collections` (per generation) | How often each generation is collected. Frequent gen 2 collections are the expensive kind |
| `dotnet.gc.pause.time` | Time the GC paused the application. The most direct measure of GC cost |
| `dotnet.gc.last_collection.heap.size` (per generation) | Heap size by generation after the last GC. Gen 2 climbing across many collections suggests a leak |
| `dotnet.process.cpu.time` | CPU used by the process, split into user and system time |
| `dotnet.thread_pool.queue.length` | Work waiting for a thread. A growing queue with idle CPU usually means threads blocked on synchronous I/O |
| `dotnet.monitor.lock_contentions` | Lock contention. A high rate means threads waiting on each other |

Applications on .NET 8 and earlier publish an older set of `System.Runtime` counters, with names like `% Time in GC since last GC` and `gen-0-gc-count`. `dotnet-counters` shows whichever set the target process emits, and for a .NET 9 or later process it shows the new metrics by default. Older articles and dashboards may use names you won't see without asking for them.

`dotnet-counters` also shows your own metrics. Name a `Meter` you create in application code in `--counters`, for example `--counters System.Runtime,MyApp.Orders`, and its instruments appear next to the runtime's numbers. The default shows `System.Runtime` only. Exporting metrics continuously to a monitoring system belongs to observability tooling such as OpenTelemetry, not to this tool.

Counters tell you *that* something is wrong and roughly *what kind* of problem it is. The next tool depends on the answer.

---

## dotnet-trace: Where Does the Time Go?

`dotnet-trace` records a stream of runtime events and stack samples for a period, into a `.nettrace` file:

```bash
dotnet-trace collect --process-id 20132 --duration 00:00:00:30
```

With no profile named, it collects two:

| Profile | What it records |
|---|---|
| `dotnet-common` | Low-overhead runtime events: GC, JIT, assembly loading, exceptions, threading |
| `dotnet-sampled-thread-time` | A stack sample of every managed thread about 100 times a second |

`dotnet-trace list-profiles` shows the rest, including `gc-verbose` (collections plus allocation sampling), `gc-collect` (collections only, at very low overhead), and `database` (ADO.NET and EF Core commands). On Linux, `dotnet-trace collect-linux` adds kernel CPU sampling through `perf_events` (with the caveats below).

### Reading a Trace

`dotnet-trace report <file> topN` prints the methods where samples landed most often. A trace of a process that spent its time sleeping between bursts of work reported this:

```
Top 5 Functions (Exclusive)                      Inclusive    Exclusive
1. WaitHandle.WaitOneNoCheck(...)                50%          50%
2. Thread.Sleep(int32)                           47.76%       47.76%
3. Target!Program.<Main>$(...)                   50%          1.82%
4. SpanHelpers.Memmove(...)                      0.19%        0.19%
5. StringBuilder.ToString()                      0.29%        0.13%
```

This output is the most common trap in reading a trace. The sampler records **thread time**, meaning the stack of every thread whether it is running or blocked, so waiting and sleeping dominate. That is the right view for "why is this request slow" (it was waiting), and the wrong view for "why is the CPU at 100%". For CPU questions you need true CPU sampling, which records only threads that are on a CPU. On Windows, PerfView's own collection and Visual Studio's CPU Usage tool provide it. On Linux, `dotnet-trace collect-linux` adds kernel CPU sampling, but it is a preview feature that needs root, kernel 6.4 or later, and .NET 10, and `report` and `convert` may not yet read its traces. Open them in PerfView instead.

**Exclusive** time is spent in the method's own code, and **inclusive** time adds everything it called. A method with high inclusive and low exclusive time is only a caller, so look further down its call tree for the method that actually spends the time.

For real analysis, open the `.nettrace` in a viewer with a call tree and a flame graph: [PerfView](https://github.com/microsoft/perfview){:target="_blank" rel="noopener noreferrer"} on Windows, or Visual Studio's profiler. Pass `--format Speedscope` to also write a file for the browser-based [speedscope](https://www.speedscope.app){:target="_blank" rel="noopener noreferrer"} viewer, which works on any OS.

### Reading GC Behaviour From a Trace

The GC events in `dotnet-common` record every collection: its generation, its reason, and how long it paused the application. PerfView's GCStats view summarizes them per process. The questions to ask:

- **What share of time is spent paused?** A few percent is normal. Tens of percent means the application is spending its time collecting garbage.
- **Which generation dominates?** Many cheap gen 0 collections point at allocation rate, which fewer allocations in hot paths fix. Frequent gen 2 collections point at objects surviving too long, or at a heap near its limit.
- **Why did each collection happen?** An `Induced` reason means code calls `GC.Collect`. A `LowMemory` reason means the machine or container is under memory pressure.

To find *which code* allocates, collect with `gc-verbose`, which samples allocations with their stacks, and look at allocation by type and by call site.

---

## dotnet-gcdump: What Is on the Heap?

When memory grows and doesn't come back, the question becomes which objects are alive and what keeps them alive. `dotnet-gcdump` captures a snapshot of the managed heap's object graph:

```bash
dotnet-gcdump collect --process-id 20132
dotnet-gcdump report 20132_20260923_101500.gcdump
```

`report` prints the largest types by total size. From a process that added a 10 KB buffer to a list on every iteration:

```
   Object Bytes     Count  Type
         10,024     1,173  System.Byte[] (Bytes > 10K)
```

A gcdump is small (this one was 200 KB for a 12 MB heap) because it records the object graph, not the objects' contents, which also makes it safer to move off a production machine. Collecting one forces a full gen 2 collection and pauses the process while the heap is walked, which takes longer the larger the heap is.

A leak has a recognizable shape in the gen 2 heap size reported after each collection, the `dotnet.gc.last_collection.heap.size` counter. A healthy process saws up and down above a level floor. A leaking one saws too, but the floor it drops back to keeps rising:

{% include figure.html id="dn-heap-sawtooth" %}

The standard way to find what is leaking is to **take two gcdumps some time apart and compare them**. Types whose count keeps growing between snapshots are the leak candidates. Visual Studio and PerfView, both Windows-only, open `.gcdump` files, show the difference between two of them, and trace an object's **path to root**: the chain of references from a static field, a live thread's stack, or a GC handle that keeps it alive. The typical findings are an event handler still subscribed to a long-lived publisher, a static cache that never evicts, or a timer that holds its callback's target.

---

## dotnet-dump: Everything, Frozen

`dotnet-dump` writes a full memory dump: every byte of the process, every thread's stack, and every object's contents. It is the tool for problems a live process won't reveal, such as a hang, a deadlock, or a crash.

```bash
dotnet-dump collect --process-id 20132
dotnet-dump analyze dump_20260923_101530.dmp
```

`analyze` opens an interactive prompt with SOS, the runtime's debugging extension. The commands that do most of the work:

| Command | Answers |
|---|---|
| `dumpheap -stat` | Which types use the most memory, by count and total size |
| `gcroot <address>` | What keeps one object alive |
| `clrstack -all` | Every managed thread's current stack. The first step for a hang |
| `syncblk` | Which threads hold which locks. Two threads each waiting on a lock the other holds is a deadlock |
| `pe` | The exception on the current thread, with its stack |

On the leaking process, `dumpheap -stat` showed the same story as the gcdump, with the contents included:

```
          MT Count  TotalSize Class Name
7ffebdcf35f8 2,306 23,122,165 System.Byte[]
```

`MT` is the method table address, the runtime's internal identifier for the type, which other SOS commands such as `dumpheap -mt <address>` take to list that type's instances.

A full dump is as large as the process's memory, and it contains everything in that memory: connection strings, tokens, customer data. Treat a production dump as sensitive data. Prefer a gcdump when all you need is object counts and references.

To capture a dump at the moment of a crash rather than afterwards, start the process with `DOTNET_DbgEnableMiniDump=1`. The runtime then writes a dump when the process crashes. It writes a heap dump by default, which omits some memory. Add `DOTNET_DbgMiniDumpType=4` for a full dump.

---

## Reading the GC From Code

Sometimes the cheapest diagnostic is a few numbers logged from inside the process, for example in a health endpoint or a test that guards an allocation budget:

```csharp
GCMemoryInfo info = GC.GetGCMemoryInfo();

Console.WriteLine($"Heap size:      {info.HeapSizeBytes:N0}");
Console.WriteLine($"Fragmented:     {info.FragmentedBytes:N0}");
Console.WriteLine($"GC pause time:  {info.PauseTimePercentage}%");
Console.WriteLine($"Collections:    {GC.CollectionCount(0)} / {GC.CollectionCount(1)} / {GC.CollectionCount(2)}");
Console.WriteLine($"Allocated ever: {GC.GetTotalAllocatedBytes():N0}");

// GenerationInfo is indexed by generation: 0, 1, 2, then the large and pinned object heaps
string[] names = ["gen0", "gen1", "gen2", "LOH", "POH"];
for (int g = 0; g < info.GenerationInfo.Length; g++)
{
    Console.WriteLine($"{names[g]} after last GC: {info.GenerationInfo[g].SizeAfterBytes:N0}");
}
```

`GC.GetGCMemoryInfo()` describes the most recent collection, not the current moment, with one exception: `PauseTimePercentage` is a running figure, total GC pause time as a share of the process's whole lifetime. `GC.GetTotalAllocatedBytes()` counts every byte ever allocated, so the difference between two readings around a piece of code is what that code allocated, which makes it a cheap allocation check in a test.

---

## Which Tool for Which Question

```
Something is wrong in a running process
│
├─ Don't know what yet ──────────────────────► dotnet-counters monitor
│
├─ High CPU, or slow requests ───────────────► dotnet-trace collect
│                                               (thread time; for CPU: PerfView or VS on Windows,
│                                                collect-linux on Linux)
├─ GC pause time or allocation rate high ────► dotnet-trace with gc-verbose
│
├─ Memory grows and never comes back ────────► two dotnet-gcdumps, compared
│
└─ Hang, deadlock, or crash ─────────────────► dotnet-dump, then clrstack / syncblk

Choosing between two implementations of hot code ──► BenchmarkDotNet
```
