---
title: "Benchmarking and Diagnostics"
layout: guide
category: ".NET & C#"
subcategory: "Tooling & Quality"
description: "Measuring whether a change actually made .NET code faster: writing a benchmark that means something, and the runtime counters, traces, and dumps that show what a running process is doing."
tags: [benchmarkdotnet, profiling, diagnostics, garbage-collection, advanced]
---

<!-- PHASE 0 SEED. Scope per the ownership map: BenchmarkDotNet and why
microbenchmarks mislead; dotnet-counters; dotnet-trace; dotnet-gcdump; memory
dumps; EventCounters; reading a GC trace. Profiling methodology, load testing,
and capacity planning are owned by architecture/performance-engineering.md —
clause only. Written in full at its Phase 1 row. Do not link to siblings in
scope. -->

## Runtime Memory Counters


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