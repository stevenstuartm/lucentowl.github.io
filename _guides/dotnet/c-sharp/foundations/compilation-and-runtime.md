---
title: "Compilation and Runtime"
layout: guide
category: ".NET & C#"
subcategory: "Foundations"
description: "How .NET compiles and executes code: IL, JIT, AOT, tiered compilation, trimming, and deployment models"
tags: [dotnet, compilation, jit, aot, clr, runtime, performance, deployment, fundamentals]
---

Understanding how .NET compiles and runs code helps you make informed decisions about performance, deployment, and compatibility. This guide covers the compilation pipeline from source code to execution, including the tradeoffs between different compilation strategies.

## The .NET Compilation Pipeline

When you build a C# project, the compiler does not produce machine code directly. Instead, it produces an intermediate representation that the runtime later converts to native code. This two-stage process enables cross-platform compatibility and runtime optimizations.

```
C# Source → C# Compiler → IL + Metadata (Assembly) → Runtime → Native Code → Execution
```

### Intermediate Language (IL)

The C# compiler produces **Intermediate Language** (IL), also called MSIL or CIL. IL is a CPU-independent instruction set that describes operations at a higher level than machine code but lower than C#.

An assembly (`.dll` or `.exe`) contains IL bytecode plus metadata describing types, methods, and references. This metadata enables reflection, debugging, and cross-language interoperability.

IL has several advantages over compiling directly to machine code:

- **Platform independence**: The same assembly runs on Windows, Linux, and macOS
- **Runtime optimization**: The JIT compiler can optimize for the specific CPU running the code
- **Security verification**: The runtime can verify IL is type-safe before execution
- **Reflection**: Metadata enables runtime type inspection

You can examine IL using tools like `ildasm` (IL Disassembler) or ILSpy. Understanding IL helps when debugging performance issues or understanding what the compiler actually generates.

### The Common Language Runtime (CLR)

The **Common Language Runtime** is the execution engine that runs .NET code. It provides:

- **Memory management**: Garbage collection, stack allocation, object layout
- **Type safety**: Verifies IL before execution, enforces type rules
- **Exception handling**: Structured exception propagation across method boundaries
- **Security**: Code access security, stack walking for permission checks
- **JIT compilation**: Converts IL to native code at runtime
- **Interop**: Marshalling between managed and unmanaged code

The CLR abstracts the underlying operating system, providing a consistent execution environment across platforms. CoreCLR is the runtime used by modern .NET (5+), while the legacy .NET Framework uses a different CLR implementation.

## Just-In-Time (JIT) Compilation

**JIT compilation** converts IL to native machine code at runtime, just before execution. When a method is first called, the JIT compiler translates its IL to native instructions for the current CPU.

### How JIT Works

1. Application starts; CLR loads assemblies
2. First call to a method triggers JIT compilation
3. JIT analyzes the IL and generates optimized native code
4. Native code is cached in memory for subsequent calls
5. Future calls execute the cached native code directly

The JIT compiler has access to runtime information unavailable at build time: the exact CPU model, available instruction sets (AVX, SSE), and actual runtime behavior. This enables optimizations that ahead-of-time compilers cannot perform.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>JIT Advantages</h4>
<ul>
<li>Optimizes for the exact hardware running the code</li>
<li>Can inline methods based on actual runtime types</li>
<li>No need to ship platform-specific binaries</li>
<li>Enables dynamic code generation and reflection</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>JIT Disadvantages</h4>
<ul>
<li>Startup cost: first execution of each method incurs compilation time</li>
<li>Memory overhead: native code cache consumes RAM</li>
<li>Cannot optimize across assembly boundaries in some cases</li>
</ul>
</div>
</div>

For long-running applications like web servers, JIT startup cost is amortized over many requests. For short-lived processes like CLI tools, startup time dominates total execution time.

### Tiered Compilation

Modern .NET uses **tiered compilation** to balance startup speed with steady-state performance. Methods compile in stages:

**Tier 0 (Quick JIT)**: Fast compilation with minimal optimization. Gets code running quickly. Methods are instrumented to track call frequency.

**Tier 1 (Optimizing JIT)**: After a method is called enough times (typically 30 calls or 30 iterations of a loop), it recompiles with full optimizations. The optimized version replaces the tier 0 code.

This approach provides fast startup (tier 0) while eventually achieving peak performance (tier 1) for hot paths. Cold code that runs rarely never pays the cost of aggressive optimization.

Tiered compilation is enabled by default. For benchmarking, you may want to disable it to measure steady-state performance consistently:

```xml
<PropertyGroup>
  <TieredCompilation>false</TieredCompilation>
</PropertyGroup>
```

## Ahead-of-Time (AOT) Compilation

**AOT compilation** generates native code at build time rather than runtime. The published application contains machine code directly, eliminating JIT compilation at startup.

### Why AOT Matters

AOT addresses specific scenarios where JIT compilation is problematic:

**Startup time**: Applications start faster because no JIT compilation occurs. This matters for serverless functions, CLI tools, and mobile apps.

**Deployment size**: AOT automatically enables trimming since the compiler must analyze the entire program at build time and knows exactly what code is reachable.

**Platforms without JIT**: iOS prohibits JIT compilation for security reasons. Game consoles and some embedded systems have similar restrictions.

**Predictable performance**: No JIT compilation pauses during execution. Latency-sensitive applications benefit from consistent timing.

### What AOT Gives Up

AOT makes all optimization decisions at build time, losing access to information that only exists at runtime.

JIT with tiered compilation observes actual execution behavior and optimizes accordingly, inlining methods based on observed types, devirtualizing interface calls that consistently resolve to the same concrete type, and reordering code paths based on real branch frequencies. AOT compiles with static analysis alone and cannot adapt to runtime patterns.

AOT also compiles for a **baseline instruction set** for the target architecture. A binary targeting `linux-x64` uses the x86-64-v1 baseline (SSE2) and will not use AVX2 or AVX-512 even when the host CPU supports them. JIT detects the actual CPU at startup and generates code that takes advantage of whatever instruction sets are available. In container environments where pods can land on different node types within a cluster, AOT targets the lowest common denominator.

For long-running services where startup cost is amortized over hours of execution, JIT-compiled code with profile-guided optimization typically achieves higher steady-state throughput than equivalent AOT-compiled code. AOT is strongest where startup latency dominates: serverless functions, CLI tools, and containers that frequently scale from zero.

### Native AOT in .NET

.NET 7+ provides **Native AOT** publishing, which produces a fully native executable with no IL and no JIT. Because the output is native machine code, you must specify the target platform and architecture using a **Runtime Identifier (RID)**:

```xml
<PropertyGroup>
  <PublishAot>true</PublishAot>
  <RuntimeIdentifier>linux-x64</RuntimeIdentifier>
</PropertyGroup>
```

You can also specify the RID from the command line:

```bash
dotnet publish -r linux-x64 -c Release
```

Common RIDs for server and cloud deployments:

| RID | Target |
|-----|--------|
| `linux-x64` | Most cloud VMs and containers |
| `linux-arm64` | AWS Graviton, Azure Ampere, GCP Tau T2A |
| `linux-musl-x64` | Alpine-based containers |
| `linux-musl-arm64` | Alpine on ARM |
| `win-x64` | Windows Server |
| `osx-arm64` | macOS on Apple Silicon |

The output is a single native executable for the specified platform. No .NET runtime installation is required on the target machine, but each target requires a separate build. For multi-architecture container images, you build separately for each RID and combine them using a Docker manifest so the correct binary is served based on the host architecture.

<div class="callout callout--warning">
<p class="callout__title">AOT Limitations</p>
<p>Native AOT imposes constraints because the compiler must know the complete program at build time:</p>
<ul>
<li><strong>No dynamic code generation</strong>: <code>Reflection.Emit</code>, <code>Expression.Compile()</code>, and similar APIs that generate code at runtime do not work.</li>
<li><strong>Limited reflection</strong>: Reflection that relies on runtime metadata discovery may fail. Types and members must be statically reachable or explicitly preserved.</li>
<li><strong>No dynamic assembly loading</strong>: <code>Assembly.LoadFrom()</code> and similar APIs cannot load arbitrary assemblies at runtime.</li>
<li><strong>Platform-specific output</strong>: Each target platform requires a separate build. You cannot build once and run everywhere.</li>
</ul>
</div>

These limitations require using source generators instead of reflection for serialization, dependency injection, and similar concerns.

### ReadyToRun (R2R)

**ReadyToRun** is a hybrid approach: assemblies contain both IL and precompiled native code. At runtime, the precompiled code runs immediately while the JIT can still recompile hot methods with better optimizations.

```xml
<PropertyGroup>
  <PublishReadyToRun>true</PublishReadyToRun>
</PropertyGroup>
```

R2R provides faster startup than pure JIT without the restrictions of full AOT:
- Reflection works normally
- Dynamic code generation works
- Cross-platform IL remains available
- JIT recompilation can still optimize for the actual CPU's instruction sets

The tradeoff is larger deployment size since assemblies contain both IL and precompiled native code. For cloud-hosted services that run long enough to benefit from JIT recompilation but still need reasonable startup times, R2R often provides the best balance between startup latency and peak throughput.

## Trimming

**Trimming** removes unused code from published applications, reducing deployment size. The primary target is not your own code but the .NET runtime libraries and third-party dependencies that ship with self-contained deployments. A self-contained publish bundles the entire .NET base class library (~60MB+), but your application likely uses only a fraction of it. Trimming analyzes the application to determine which types and methods are actually reachable and excludes everything else.

Trimming is not enabled by default. For standard publishing, you opt in explicitly:

```xml
<PropertyGroup>
  <PublishTrimmed>true</PublishTrimmed>
</PropertyGroup>
```

Native AOT (`<PublishAot>true</PublishAot>`) enables trimming automatically because AOT requires whole-program analysis to produce the native binary. You do not need to set `PublishTrimmed` separately when using Native AOT.

### How Trimming Works

The trimmer performs static analysis starting from entry points:

1. Identify entry points (Main method, exported APIs)
2. Trace all reachable code paths
3. Mark all types, methods, and fields that might be used
4. Remove everything not marked

### Trimming Challenges

Trimming struggles with patterns that hide code dependencies from static analysis:

**Reflection**: `Type.GetType("MyNamespace.MyClass")` loads a type by string. The trimmer cannot know this string value at build time, so it might remove the type.

**Serialization**: JSON or XML serialization often discovers types through reflection. Without explicit hints, serialized types may be trimmed.

**Dependency injection**: Container frameworks that scan assemblies for types face similar issues.

### Trim Warnings and Annotations

.NET provides attributes to communicate trimming intent:

```csharp
// This method uses reflection and cannot be safely trimmed
[RequiresUnreferencedCode("Uses reflection to discover types")]
public void DiscoverPlugins() { /* ... */ }

// Preserve this type even if not statically reachable
[DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.All)]
public class PluginBase { }
```

When you build with trimming enabled, the compiler reports warnings for code patterns that may break. Addressing these warnings (either by restructuring code or adding annotations) ensures trimmed applications work correctly.

Source generators help by replacing reflection with static code generation. The JSON source generator, for example, produces trim-compatible serialization code.

## Choosing a Compilation Strategy

The three compilation strategies occupy different points on the tradeoff spectrum between startup speed, peak throughput, deployment flexibility, and ecosystem compatibility.

### Head-to-Head Comparison

| Dimension | JIT (Default) | ReadyToRun (R2R) | Native AOT |
|-----------|--------------|-------------------|------------|
| **Startup time** | Slowest (compiles on first call) | Fast (precompiled, skips initial JIT) | Fastest (fully native, no JIT at all) |
| **Peak throughput** | Highest (PGO + CPU-specific optimization) | High (JIT recompiles hot paths at runtime) | Lower (static optimization only) |
| **Deployment size** | Large with self-contained (~60MB+) | Largest (IL + native code in each assembly) | Smallest with trimming |
| **CPU adaptation** | Full (detects instruction sets at startup) | Full (JIT recompiles using actual CPU) | None (baseline instruction set only) |
| **Reflection** | Full support | Full support | Limited (must be statically analyzable) |
| **Dynamic code gen** | Full support | Full support | Not supported |
| **Plugin loading** | Supported | Supported | Not supported |
| **Runtime required** | Yes (or self-contained) | Yes (or self-contained) | No |

### When to Use Each

**JIT with tiered compilation** is the right default for long-running services like web APIs, background workers, and message consumers. Startup cost is paid once and amortized over hours or days of execution while the runtime continuously optimizes hot paths using actual profiling data and CPU capabilities. JIT is also the only option when the application relies heavily on reflection, dynamic assembly loading, or runtime code generation.

**ReadyToRun** fits cloud-hosted services that need faster startup without giving up runtime optimization. Container orchestrators that frequently restart or reschedule pods benefit from the reduced cold start time, and the JIT can still recompile hot methods using the actual CPU's instruction sets. R2R is also the safest upgrade path from pure JIT since it requires no code changes and imposes no API restrictions.

**Native AOT** is strongest for workloads where startup latency is the dominant concern and runtime adaptability is not needed. Serverless functions that scale from zero, CLI tools where users expect instant response, and sidecar containers that must be ready before the main container starts are all good candidates. AOT also makes sense on platforms that prohibit JIT, like iOS and some embedded systems. The tradeoff is that the application must work within AOT's constraints: no runtime reflection discovery, no dynamic code generation, and no dynamic assembly loading.

### Quick Reference

| Scenario | Strategy | Why |
|----------|----------|-----|
| Long-running web API | JIT | Peak throughput from PGO and CPU-specific optimization |
| Container with frequent restarts | R2R | Fast startup without losing runtime optimization |
| Serverless / scale-to-zero | Native AOT | Cold start latency directly impacts cost and user experience |
| CLI tool | Native AOT | Users expect instant response |
| Mobile app (iOS) | Native AOT | Platform prohibits JIT |
| Plugin-based system | JIT | Dynamic assembly loading required |
| Heterogeneous Kubernetes cluster | JIT or R2R | JIT adapts to whatever CPU the pod lands on |

## Runtime Configuration

Several runtime settings affect compilation and execution:

### Environment Variables

```bash
# Disable tiered compilation
DOTNET_TieredCompilation=0

# Disable ReadyToRun precompiled code
DOTNET_ReadyToRun=0

# Enable JIT stress modes for testing
DOTNET_JitStress=2
```

### Runtime Configuration Files

`runtimeconfig.json` controls runtime behavior for published applications:

```json
{
  "runtimeOptions": {
    "configProperties": {
      "System.GC.Concurrent": true,
      "System.GC.Server": true,
      "System.Runtime.TieredCompilation": true
    }
  }
}
```

### Debugging and Diagnostics

To observe JIT behavior:

```bash
# See what methods are JIT compiled
DOTNET_JitDisasm=*

# Dump compilation timing
DOTNET_JitTimeLogFile=jit-timing.log
```

These diagnostics help identify methods with high JIT time or unexpected compilation patterns.

## Deployment Models

How you deploy a .NET application affects what must be installed on target machines and how your application starts.

### Framework-Dependent Deployment

**Framework-dependent** applications require the .NET runtime to be installed on the target machine. The published output contains only your application code and dependencies.

```bash
dotnet publish -c Release
```

**Advantages:**
- Small deployment size
- Automatic security updates when the runtime is patched
- Shared runtime reduces disk and memory usage across applications

**Disadvantages:**
- Target machine must have compatible runtime installed
- Runtime version mismatches can cause issues

### Self-Contained Deployment

**Self-contained** applications include the .NET runtime with the published output. No runtime installation is required on the target machine.

```bash
dotnet publish -c Release --self-contained
```

**Advantages:**
- Works without runtime installation
- Isolates application from system runtime updates
- Full control over which runtime version runs

**Disadvantages:**
- Larger deployment size (~60MB+)
- Application is responsible for runtime security updates

### Single-File Deployment

**Single-file** publishing bundles the application and its dependencies into one executable:

```bash
dotnet publish -c Release --self-contained -p:PublishSingleFile=true
```

On first run, the single file extracts to a temporary directory. The application runs from extracted files.

Add `IncludeNativeLibrariesForSelfExtract=true` to include native libraries in the bundle:

```xml
<PropertyGroup>
  <PublishSingleFile>true</PublishSingleFile>
  <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
</PropertyGroup>
```

Combine with Native AOT for a true single-file native executable with no extraction.

### Choosing a Deployment Model

The deployment model matters most when you are distributing binaries directly to machines, whether that means shipping a desktop application to end users, copying a diagnostic tool onto a production server, or publishing a CLI utility to GitHub releases. In these scenarios, the choice between framework-dependent, self-contained, and single-file has real consequences for what users need to install, how large the download is, and how simple the experience feels.

When deploying to containers, the deployment model matters much less. The container image itself is the immutable versioned artifact. Whether it contains one file or fifty files internally is an implementation detail invisible to your deployment pipeline. Framework-dependent is the natural default in container workflows because the base image provides the runtime, image layers stay small, and runtime security patches flow through base image updates rather than per-application rebuilds.

For non-containerized scenarios, the choice depends on who controls the target environment and how much isolation you need from it.

**Framework-dependent** is the standard choice when you control or can specify the target environment. Enterprise applications deployed to servers managed by your operations team, web APIs running in Docker containers built from official .NET base images, and internal tools distributed to developer machines that already have the SDK installed all fit this model. The small deployment size and automatic runtime patching make it practical for environments where dozens of .NET applications share the same host, since each application ships only its own code while the shared runtime handles security updates centrally.

**Self-contained** makes sense when you cannot guarantee what is installed on the target machine or when you need strict version isolation. Desktop applications distributed to end users are the classic case: you have no control over whether the user has .NET installed, let alone which version. It also fits scenarios where two applications on the same server require different runtime versions that would conflict. The tradeoff is that you now own runtime patching. If a critical security fix ships for .NET, every self-contained application must be rebuilt and redeployed individually.

**Single-file** deployment is strongest for distribution scenarios where simplicity matters. CLI tools that users download and run immediately benefit from having no installation step and no folder of loose DLLs. DevOps utilities, diagnostic tools, and lightweight agents that get copied onto servers during incident response are also good candidates. When combined with Native AOT, the result is a single native binary with no extraction step and no runtime dependency, which is ideal for environments where you want minimal footprint and maximum portability.

| Scenario | Deployment Model | Reasoning |
|----------|-----------------|-----------|
| Web API in a managed Docker container | Framework-dependent | Base image includes the runtime; small image layers |
| Desktop app distributed to end users | Self-contained | No control over user's installed runtimes |
| Multiple apps on one server needing different runtime versions | Self-contained | Avoids version conflicts between applications |
| Internal tool for developers | Framework-dependent | Developers already have the SDK installed |
| CLI tool downloaded from GitHub releases | Single-file + AOT | Users expect one file, no prerequisites |
| Diagnostic agent copied onto production servers | Single-file | Minimal footprint, no installation step |
| Enterprise server farm with centralized patching | Framework-dependent | Security updates apply once to the shared runtime |

## Key Takeaways

- .NET compiles to **IL first**, then to **native code** either at runtime (JIT) or build time (AOT)
- **JIT compilation** enables runtime optimization but incurs startup cost
- **Tiered compilation** balances startup speed with steady-state performance by compiling methods in stages
- **Native AOT** eliminates JIT overhead but restricts reflection and dynamic code
- **ReadyToRun** provides a middle ground: precompiled native code with JIT fallback
- **Trimming** reduces deployment size but requires care with reflection-heavy code
- **Source generators** enable AOT-compatible patterns that traditionally required reflection

Understanding these compilation modes helps you choose the right tradeoffs for your application's performance, size, and platform requirements.
