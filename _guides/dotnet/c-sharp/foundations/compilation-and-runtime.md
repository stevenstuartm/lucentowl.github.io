---
title: "Compilation and Runtime"
layout: guide
category: ".NET & C#"
subcategory: "Platform & Runtime"
description: "How .NET turns C# into running code: IL, the CLR, JIT and tiered compilation, Native AOT, ReadyToRun, trimming, and the deployment models built on them"
tags: [jit, native-aot, readytorun, trimming, clr, deployment, fundamentals]
---

Understanding how .NET compiles and runs code helps you make informed decisions about performance, deployment, and compatibility. This guide covers the compilation pipeline from source code to execution, including the tradeoffs between different compilation strategies.

## The .NET Compilation Pipeline

When you build a C# project, the compiler does not produce machine code directly. Instead, it produces an intermediate representation that the runtime later converts to native code. This two-stage process enables cross-platform compatibility and runtime optimizations.

Which stage does the IL-to-native conversion, and when, is the whole of what separates the three compilation strategies this guide covers:

{% include figure.html id="dn-build-run-paths" %}

### Intermediate Language (IL)

The C# compiler produces **Intermediate Language** (IL), also called MSIL or CIL. IL is a CPU-independent instruction set that describes operations at a higher level than machine code but lower than C#.

An assembly (`.dll` or `.exe`) contains IL bytecode plus metadata describing types, methods, and references. This metadata enables reflection, debugging, and cross-language interoperability.

IL has several advantages over compiling directly to machine code:

- **Platform independence**: The same assembly runs on Windows, Linux, and macOS
- **Runtime optimization**: The JIT compiler can optimize for the specific CPU running the code
- **Type safety**: IL carries enough type information for the runtime to enforce type rules rather than trusting the producer of the code
- **Reflection**: Metadata enables runtime type inspection

You can examine IL with a decompiler such as [ILSpy](https://ilspy.net/){:target="_blank" rel="noopener noreferrer"}, which shows both the raw IL and a reconstructed C# view. Reading IL helps when a performance question turns on what the compiler actually generated: whether a `foreach` allocated an enumerator, whether a struct got copied, whether an `async` method's state machine boxed.

### The Common Language Runtime (CLR)

The **Common Language Runtime** is the execution engine that runs .NET code. It provides:

- **Memory management**: Garbage collection, stack allocation, object layout
- **Type safety**: Enforces type rules, bounds checks, and null checks that IL alone does not guarantee
- **Exception handling**: Structured exception propagation across method boundaries
- **Assembly loading**: Resolving and loading assemblies into load contexts
- **JIT compilation**: Converts IL to native code at runtime
- **Interop**: Marshalling between managed and unmanaged code

The CLR abstracts the underlying operating system, providing a consistent execution environment across platforms. CoreCLR is the runtime used by modern .NET, and it is what everything below describes. Mono is a second .NET runtime used for WebAssembly and for the mobile targets in .NET MAUI, and it has its own AOT story that differs from the CoreCLR one covered here.

One capability of the legacy .NET Framework CLR deliberately did not carry forward: **Code Access Security**. CAS let a host grant partial trust to an assembly and enforce it with permission demands and stack walks. Its infrastructure exists only in .NET Framework, and most of its API surface is obsolete in .NET 5 and later, producing compile-time warning `SYSLIB0003`. Calls that were no-ops on .NET Core stay no-ops; calls that threw `PlatformNotSupportedException` keep throwing. Isolation in modern .NET comes from the process and the operating system, not from the runtime.

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
<li>Memory overhead: native code cache and JIT working set consume RAM</li>
<li>Peak performance arrives late: hot methods run unoptimized until tiering promotes them</li>
<li>Requires a JIT, which some platforms prohibit outright</li>
</ul>
</div>
</div>

For long-running applications like web servers, JIT startup cost is amortized over many requests. For short-lived processes like CLI tools, startup time dominates total execution time.

### Tiered Compilation

Modern .NET uses **tiered compilation** to balance startup speed with steady-state performance. Methods compile in stages:

**Tier 0 (Quick JIT)**: Fast compilation with minimal optimization. Gets code running quickly. Methods are instrumented to count calls.

**Tier 1 (Optimizing JIT)**: Once the call counter reaches its threshold (30 calls by default), the method is queued for recompilation with full optimizations, in the background. The optimized version replaces the tier 0 code for subsequent calls.

This approach provides fast startup (tier 0) while eventually achieving peak performance (tier 1) for hot paths. Cold code that runs rarely never pays the cost of aggressive optimization.

A call counter alone handles a method that is hot because it is called often. It does nothing for a method that is hot because it is called once and then loops a million times, since the call never returns and the counter never advances. **On-stack replacement (OSR)** closes that hole: the JIT instruments loops in tier 0 code with iteration counts, and when a loop gets hot, it compiles an optimized version and transfers execution into it mid-loop, on the existing stack frame. OSR is enabled by default on x64 and Arm64. On architectures without it, methods containing loops skip tier 0 and are compiled optimized from the start.

### Dynamic PGO

Tier 0 does more than count calls. It also records which concrete types actually show up at virtual and interface call sites, and tier 1 compiles against that profile, devirtualizing a call that always lands on the same implementation, or emitting a fast path with a type check and a fallback. This is **dynamic profile-guided optimization**, on by default since .NET 8, and it is the main reason a long-running JIT-compiled service can outrun the same code compiled ahead of time. A static compiler has to assume every interface call is polymorphic. The JIT gets to watch.

Tiered compilation is enabled by default. For benchmarking, you may want to disable it so measurements reflect steady-state code from the first iteration:

```xml
<PropertyGroup>
  <TieredCompilation>false</TieredCompilation>
</PropertyGroup>
```

In practice, a benchmark harness handles this for you by running warmup iterations until measurements stabilize, which is more reliable than disabling tiering. Turning tiering off also turns off dynamic PGO, so you end up measuring code the production runtime would never execute.

## Ahead-of-Time (AOT) Compilation

**AOT compilation** generates native code at build time rather than runtime. The published application contains machine code directly, eliminating JIT compilation at startup.

### Why AOT Matters

AOT addresses specific scenarios where JIT compilation is problematic:

**Startup time**: Applications start faster because no JIT compilation occurs. This matters wherever a process is short-lived or frequently recreated.

**Predictable performance**: No JIT compilation pauses during execution, and no window where hot code is still running at tier 0. Latency-sensitive applications benefit from consistent timing from the first request rather than the thousandth.

**Memory footprint**: No JIT means no compiler working set and no native code cache, which is why AOT shows its largest wins on workloads running many small instances rather than a few large ones.

**Platforms without JIT**: iOS prohibits JIT compilation for security reasons. Game consoles and some embedded systems have similar restrictions.

### What AOT Gives Up

AOT makes all optimization decisions at build time, losing access to information that only exists at runtime.

JIT with tiered compilation observes actual execution behavior and optimizes accordingly, inlining methods based on observed types, devirtualizing interface calls that consistently resolve to the same concrete type, and reordering code paths based on observed branch frequencies. AOT compiles with static analysis alone and cannot adapt to runtime patterns.

AOT also compiles for a **baseline instruction set**: by default the compiler targets the minimum instruction set the target OS and architecture guarantee, so a binary targeting `linux-x64` will not use AVX2 or AVX-512 even when the host CPU supports them. JIT detects the actual CPU at startup and generates code that takes advantage of whatever instruction sets are available. In container environments where pods can land on different node types within a cluster, AOT targets the lowest common denominator.

You can raise the AOT baseline with `<IlcInstructionSet>`, naming the sets to assume (`avx2,bmi2,fma,popcnt`) or `native` to target the machine doing the build. The binary then requires that hardware to run at all, which trades the portability that made you pick a fixed RID in the first place. Fine when you own the fleet, a crash on startup when you do not.

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
| `linux-x64` | glibc-based Linux on x64, covering most cloud VMs and containers |
| `linux-arm64` | glibc-based Linux on Arm64, the Arm instance families the major clouds offer |
| `linux-musl-x64` | musl-based Linux on x64, such as Alpine containers |
| `linux-musl-arm64` | musl-based Linux on Arm64 |
| `win-x64` | Windows on x64 |
| `osx-arm64` | macOS on Apple Silicon |

The `musl` split matters more than it looks: Alpine images link against musl rather than glibc, and a `linux-x64` binary will not run on one. Choosing the RID is choosing a C library, not just a CPU.

The output is a single native executable for the specified platform. No .NET runtime installation is required on the target machine, but each target requires a separate build. Linux builds are also forward-compatible only: a binary produced on Ubuntu 20.04 runs on 20.04 and later, not on 18.04, so the build image's glibc version sets the floor for where the binary can run. For multi-architecture container images, you build separately for each RID and combine them using a Docker manifest so the correct binary is served based on the host architecture.

<div class="callout callout--warning">
<p class="callout__title">AOT Limitations</p>
<p>Native AOT imposes constraints because the compiler must know the complete program at build time:</p>
<ul>
<li><strong>No runtime code generation</strong>: <code>System.Reflection.Emit</code> does not work.</li>
<li><strong>No dynamic loading</strong>: <code>Assembly.LoadFile</code> and similar APIs cannot load arbitrary assemblies at runtime.</li>
<li><strong>Limited reflection</strong>: Reflection that relies on runtime metadata discovery may fail. Types and members must be statically reachable or explicitly preserved.</li>
<li><strong>Trimming and single-file are implied</strong>: an AOT app inherits every trimming and single-file restriction as well.</li>
<li><strong>No C++/CLI, and no built-in COM on Windows.</strong></li>
<li><strong>Platform-specific output</strong>: Each target platform requires a separate build. You cannot build once and run everywhere.</li>
</ul>
</div>

Two of these bite in ways that are easy to misread.

`System.Linq.Expressions` is not on the list, and that is deliberate: `Expression.Compile()` still works under Native AOT, but it always falls back to the interpreter rather than emitting IL. Code that compiles an expression tree once and invokes it in a hot loop keeps working and gets quietly slower. It fails a benchmark, not a smoke test.

Generic code over value types also behaves differently. The JIT generates a specialized body per struct instantiation on demand, so instantiations you never hit cost nothing. AOT has to pre-generate every instantiation it can prove reachable, which can push binary size up sharply in code that is generic over many struct types. Generic virtual methods are the worst case, since every implementing or overriding type needs its own instantiation.

Both push in the same direction as the reflection limits: replace runtime code generation with source generators, which cover JSON serialization, logging, regular expressions, and dependency injection registration, so the work happens at build time where AOT can see it.

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

**Trimming is only supported for self-contained apps**, which follows from what it is for. A framework-dependent app ships none of the runtime libraries, so there is nothing to trim; the shared runtime on the machine belongs to every application on it. Setting `PublishTrimmed` on a framework-dependent publish does not produce a smaller app.

Trimming is not enabled by default. You opt in explicitly, and because self-contained publishing needs a target, with a RID:

```xml
<PropertyGroup>
  <PublishTrimmed>true</PublishTrimmed>
</PropertyGroup>
```

Native AOT (`<PublishAot>true</PublishAot>`) enables trimming automatically because AOT requires whole-program analysis to produce the native binary. You do not need to set `PublishTrimmed` separately when using Native AOT.

### Trimming Is an Application-Level Operation

This trips people up more than the mechanics do. **Trimming and AOT compilation happen to an application at publish time, never to a library at build time.** A library cannot be trimmed, because trimming means deciding what the whole program does not reach, and a library does not know its callers.

The two sets of properties follow from that, and they are not interchangeable:

| Property | Scope | What it does |
|---|---|---|
| `PublishTrimmed`, `PublishAot` | The application | Actually trims or AOT-compiles, at publish |
| `IsTrimmable`, `IsAotCompatible` | A library | Declares the library safe to trim and turns on the analyzers that check the claim |

A library author sets `IsTrimmable` and fixes the warnings so that applications consuming the library can trim successfully. Nothing about the library's own build output changes. The payoff arrives in someone else's publish.

This also explains why trim warnings are so hard to get complete. Building a library only analyzes that library; the trimmer needs the *implementations* of its dependencies, and reference assemblies do not carry them. Getting every warning means publishing a small self-contained test app that references the library and roots it with `TrimmerRootAssembly`, so the analysis sees the whole graph.

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

.NET provides three attributes to communicate trimming intent, and they do genuinely different jobs. Reaching for the wrong one is the usual reason a trim warning gets suppressed without being fixed.

`[RequiresUnreferencedCode]` is a surrender flag. It marks a method as incompatible with trimming and pushes the warning to its callers, who must either annotate themselves in turn or stop calling it. It preserves nothing:

```csharp
[RequiresUnreferencedCode("Scans loaded assemblies for plugin types")]
public void DiscoverPlugins() { /* ... */ }
```

`[DynamicallyAccessedMembers]` is a contract on a location that holds a `Type`: a parameter, field, property, or return value. It states which members of whatever type flows through there must survive trimming, and the analyzer then checks every assignment into that location:

```csharp
// Any Type passed here keeps its public constructors.
static object Create(
    [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
    Type type)
    => Activator.CreateInstance(type);
```

It does not go on a class declaration to mean "keep this type." For that, `[DynamicDependency]` names members to preserve whenever the annotated member is preserved:

```csharp
[DynamicDependency("Helper", "MyType", "MyAssembly")]
static void RunHelper()
{
    var helper = Assembly.Load("MyAssembly").GetType("MyType").GetMethod("Helper");
    helper.Invoke(null, null);
}
```

`[DynamicDependency]` is the last resort of the three. It keeps members but does not silence the warning on its own, and it expresses no intent the analyzer can check, so it goes stale silently when the reflected-over code is renamed. Prefer restructuring the code until `[DynamicallyAccessedMembers]` can describe it.

When you build with trimming enabled, the compiler reports warnings for code patterns that may break. Addressing these warnings, by restructuring code or by annotating it, is what makes a trimmed application work. The trimmed app builds either way. The failure shows up at runtime as a missing type.

Source generators help by replacing reflection with static code generation. The JSON source generator, for example, produces trim-compatible serialization code.

## Choosing a Compilation Strategy

The three compilation strategies occupy different points on the tradeoff spectrum between startup speed, peak throughput, deployment flexibility, and ecosystem compatibility.

### Head-to-Head Comparison

| Dimension | JIT (Default) | ReadyToRun (R2R) | Native AOT |
|-----------|--------------|-------------------|------------|
| **Startup time** | Slowest (compiles on first call) | Fast (precompiled, skips initial JIT) | Fastest (fully native, no JIT at all) |
| **Peak throughput** | Highest (PGO + CPU-specific optimization) | High (JIT recompiles hot paths at runtime) | Lower (static optimization only) |
| **Deployment size** | Smallest framework-dependent; ~60MB+ self-contained | Adds native code alongside the IL, so larger than the same app without it | Always self-contained, but trimmed to what the app reaches |
| **CPU adaptation** | Full (detects instruction sets at startup) | Full (JIT recompiles using actual CPU) | None (baseline instruction set only) |
| **Reflection** | Full support | Full support | Limited (must be statically analyzable) |
| **Runtime code generation** | Full support | Full support | `Reflection.Emit` unsupported; expression trees fall back to interpretation |
| **Plugin loading** | Supported | Supported | Not supported |
| **Runtime required** | Yes (or self-contained) | Yes (or self-contained) | No |

### When to Use Each

**JIT with tiered compilation** is the right default for long-running services like web APIs, background workers, and message consumers. Startup cost is paid once and amortized over hours or days of execution while the runtime continuously optimizes hot paths using actual profiling data and CPU capabilities. JIT is also the only option when the application relies heavily on reflection, dynamic assembly loading, or runtime code generation.

**ReadyToRun** fits cloud-hosted services that need faster startup without giving up runtime optimization. Container orchestrators that frequently restart or reschedule pods benefit from the reduced cold start time, and the JIT can still recompile hot methods using the actual CPU's instruction sets. R2R is also the safest upgrade path from pure JIT since it requires no code changes and imposes no API restrictions.

**Native AOT** is strongest for workloads where startup latency is the dominant concern and runtime adaptability is not needed. Serverless functions that scale from zero, CLI tools where users expect instant response, and sidecar containers that must be ready before the main container starts are all good candidates. Ahead-of-time compilation in some form is also mandatory on platforms that prohibit JIT, though on iOS that means Mono's AOT compiler in .NET MAUI, not the Native AOT described here. The tradeoff is that the application must work within AOT's constraints: no runtime reflection discovery, no runtime code generation, and no dynamic assembly loading.

### Ruling Options Out First

Ask the eliminating questions before the preference questions. Two of the three strategies can be ruled out by a constraint, and no amount of startup-latency argument overrides one.

```
Does the app load assemblies, emit code, or discover
types by reflection at runtime?
  │
  ├── yes ──────────────────────────────────► JIT
  │        (R2R if startup also matters,
  │         it imposes no API restrictions)
  │
  └── no
       │
       Does the target platform allow a JIT?
       │
       ├── no ───────────────────────────────► AOT is mandatory
       │       (Native AOT on server and desktop
       │        targets; Mono AOT on iOS via MAUI)
       │
       └── yes
            │
            Is startup latency the dominant cost:
            scale-to-zero, a CLI invocation, a sidecar
            that gates another container?
            │
            ├── yes ──────────────────────────► Native AOT
            │        (fall back to R2R if any
            │         dependency is not AOT-compatible)
            │
            └── no
                 │
                 Does the process live long enough for
                 tier 1 and PGO to pay off, in hours not
                 seconds?
                 │
                 ├── yes ─────────────────────► JIT
                 │
                 └── no ──────────────────────► ReadyToRun
```

The first question eliminates more candidates than the rest combined, and it is the one most often answered from intent rather than evidence. Publish with `PublishAot` and read the warnings: the compiler reports every pattern it cannot analyze, across your dependencies as well as your own code, which is a faster answer than reasoning about it.

## Runtime Configuration

Several runtime settings affect compilation and execution:

### Environment Variables

```bash
# Disable tiered compilation
DOTNET_TieredCompilation=0

# Disable quick JIT, keeping tiering but compiling optimized from the start
DOTNET_TC_QuickJit=0

# Disable dynamic profile-guided optimization
DOTNET_TieredPGO=0

# Ignore ReadyToRun precompiled code and JIT framework code instead
DOTNET_ReadyToRun=0
```

These are useful for isolating a regression to a specific optimization stage. Turning each one off in turn tells you whether a slowdown came from tiering, from PGO's type profile going wrong, or from something unrelated to compilation.

### Runtime Configuration Files

Environment variables configure a machine. `runtimeconfig.json` configures an application: the SDK generates it next to the published output, and it travels with the app, so the settings hold wherever it runs.

```json
{
  "runtimeOptions": {
    "configProperties": {
      "System.Runtime.TieredCompilation": true,
      "System.Runtime.TieredCompilation.QuickJit": true,
      "System.GC.Server": true
    }
  }
}
```

Don't hand-edit the generated file. It is a build output and gets overwritten on every publish. Set the corresponding MSBuild properties (`TieredCompilation`, `TieredCompilationQuickJit`, `ServerGarbageCollection`) in the project file, or add a `runtimeconfig.template.json` beside the project for settings with no MSBuild property, and the SDK merges them in.

### Debugging and Diagnostics

Since .NET 7, the JIT can dump its own output from a release runtime, with no special build required:

```bash
# List every method as it is JIT compiled, with its tier
DOTNET_JitDisasmSummary=1

# Dump generated assembly for matching methods
DOTNET_JitDisasm="OrderService:*"

# Send that output to a file instead of stdout
DOTNET_JitStdOutFile=jit.txt
```

`JitDisasmSummary` answers "what is still being JIT compiled, and at which tier". That is the quick way to confirm that a method you expected ReadyToRun to cover is in fact being compiled at startup, or that a hot method never reached tier 1. `JitDisasm` takes a method-set pattern and prints the actual generated code, which is how you settle whether a bounds check was elided or a call was inlined. Most of the deeper JIT knobs, such as the `JitStress` modes, exist only in checked runtime builds and are not available on the runtime you ship.

## Deployment Models

How you deploy a .NET application affects what must be installed on target machines and how your application starts.

Two of these are genuine alternatives and the third is not. Framework-dependent and self-contained are mutually exclusive: either the runtime comes from the machine or it ships with the app. Single-file is a modifier that applies to either one, and it changes the shape of the output rather than where the runtime comes from.

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
- Target machine must have a compatible runtime installed
- The app inherits whatever patch level that machine happens to be at

The host resolves the runtime version at startup, and the default `RollForward` policy is `Minor`. An app built against `net8.0` takes the highest installed `8.0.*` patch; if no `8.0.*` is present but `8.2.0` is, it rolls forward to that. **It never rolls forward across a major version.** A `net8.0` app on a machine with only .NET 9 installed does not start.

Minor roll-forward has a consequence that surprises people in production: the runtime an app binds to can change when someone installs an *older* version. An app running on 8.2.0 because nothing else was there will switch to 8.0.3 once 8.0.3 is installed, since exact-minor matches win. Pin with `<RollForward>LatestPatch</RollForward>` where that matters.

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

**Single-file** publishing bundles the application and its dependencies into one executable. It works with either of the other two models, though the self-contained combination is the one people usually mean:

```bash
dotnet publish -c Release --self-contained -p:PublishSingleFile=true
```

Only **managed** assemblies are bundled by default, and they are loaded straight from the bundle into memory, with nothing written to disk. The native binaries of the runtime itself stay as separate files next to the executable, so "single file" out of the box usually means one executable plus a handful of native libraries.

To get genuinely one file, embed the native libraries too:

```xml
<PropertyGroup>
  <PublishSingleFile>true</PublishSingleFile>
  <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
</PropertyGroup>
```

The property name says what it costs. Native libraries cannot be loaded from memory, so embedding them reintroduces extraction: on startup the app writes them to a directory under `%TEMP%\.net` on Windows or `$HOME/.net` elsewhere, overridable with `DOTNET_BUNDLE_EXTRACT_BASE_DIR`. That directory must not be writable by less-privileged users, or you have handed them a way to swap a library out from under your process. Under `systemd`, `$HOME` is often undefined and extraction fails outright unless you set the variable in the unit file.

Bundling also breaks the APIs that assume files on disk. `Assembly.Location` returns an empty string, `Assembly.GetFile` throws, and `Assembly.CodeBase` throws `PlatformNotSupportedException`. Code that locates its own configuration by walking up from `Assembly.Location` fails in ways that look nothing like a packaging problem. Use `AppContext.BaseDirectory` for files beside the executable and `Environment.ProcessPath` for the executable itself.

Combining single-file with Native AOT sidesteps all of this: the output is genuinely one native executable with no extraction step, because there are no managed assemblies or separate runtime libraries left to bundle.

### Choosing a Deployment Model

The deployment model matters most when you are distributing binaries directly to machines, whether that means shipping a desktop application to end users, copying a diagnostic tool onto a production server, or publishing a CLI utility to GitHub releases. In these scenarios, the choice changes what users must install, how large the download is, and how many moving parts they see.

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
- **Tiered compilation** balances startup speed with steady-state performance by compiling methods in stages, with on-stack replacement covering methods that are hot because they loop rather than because they are called
- **Dynamic PGO** is the JIT's structural advantage: it optimizes against types actually observed at runtime, which no ahead-of-time compiler can do
- **Native AOT** eliminates JIT overhead but restricts reflection and runtime code generation, and implies trimming and single-file with them
- **ReadyToRun** provides a middle ground: precompiled native code with JIT fallback
- **Trimming** reduces deployment size, applies only to self-contained apps, and requires care with reflection-heavy code
- **Source generators** enable AOT-compatible patterns that traditionally required reflection
- **Framework-dependent apps roll forward across minor versions but never across major ones**, and the version they bind to can change as runtimes are installed or removed

Understanding these compilation modes helps you choose the right tradeoffs for your application's performance, size, and platform requirements.
