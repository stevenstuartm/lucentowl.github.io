# .NET & C# Study Guides Consolidation and Refinement Plan

Tracks the consolidation and review-and-refine pass over the ".NET & C#" category of `assets/data/study_guides_config.json`. Phase 0 took the category from 43 guides to 46, plus three extracted resources. Guides live in `_guides/dotnet/c-sharp/` (43) and `_guides/dotnet/iot/` (3).

**Scope boundary.** `_guides/dotnet/` also holds `asp/`, `aspire/`, and `winui/`, which the config files under the separate **ASP.NET Core** and **WinUI 3** categories. Those are out of scope. So measure, grep, and count this pass from the config list, not from the `_guides/dotnet/` directory.

Guides are consumed sequentially in config order. That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The checklist, the Phase 0 method, the process rules, and the cross-domain gotchas live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md) and [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

**Current position: Phase 1, row 23.**

**Cadence, set after row 2.** Rows 1 and 2 ran deep, and row 2 (a new guide) took three independent review rounds. That is affordable for authored-from-scratch content and not affordable 47 more times. From row 3 on:

- **Refinement rows** (existing guides) run inline: the full nine-item checklist, item 1 aimed at the load-bearing, falsifiable, consequential claims rather than every sentence, and `/refine-prose`. No subagent review round unless a row turns up something structural, a contradiction against a cross-guide fact, or a whole feature that may not exist.
- **New-guide rows** (44, 45) and the three unverified resources (47-49) keep the independent review the study-guide guide requires, but stop at one round unless that round finds a factual error.
- A claim that cannot be confirmed cheaply gets **softened and logged** under *Unverified, left standing*, not researched exhaustively. That section is the pressure valve that makes this cadence safe.

Decided with the user: perfection per row is not the goal; finishing the scope at a defensible standard is.

---

## Sources

- **Primary:** [Microsoft Learn — .NET](https://learn.microsoft.com/dotnet/), the [C# language reference](https://learn.microsoft.com/dotnet/csharp/language-reference/), and the [.NET API browser](https://learn.microsoft.com/dotnet/api/) for every type, member, overload, and attribute name.
- **Language features and versions:** the [C# language specification](https://learn.microsoft.com/dotnet/csharp/language-reference/language-specification/) and the `dotnet/roslyn` and `dotnet/csharplang` repos for which C# version shipped a feature and whether it is still preview.
- **Runtime and BCL behavior:** `dotnet/runtime` docs and the per-release "what's new" and "breaking changes" pages on Microsoft Learn.
- **Support matrix:** the [.NET support policy](https://dotnet.microsoft.com/platform/support/policy/dotnet-core) page for which versions are in support. Any "as of .NET N" claim is a dated claim and item 1 checks it.
- **Third-party libraries named in scope** (Polly, StackExchange.Redis, Serilog, MQTTnet, nanoFramework): the project's own docs and release notes, not blog posts.
- **Off-limits as fact:** Stack Overflow, blog posts, and AI-authored summaries. Useful for finding a lead, never for citing one.

---

## Domain notes

**Item 1 (factual correctness)** in this domain is dominated by **code**, not prose. Almost every guide in scope is code-heavy, and per the standing gotcha "verify code samples as claims, not as illustration," the checks that matter most here are method and overload signatures, attribute names, return types, generic constraints, `ref`/`in`/`out` modifiers, and which C# version a syntax form requires. A sample that reads plausibly is the default failure mode of this whole category.

**Item 1, second axis: version drift.** This category accumulated syntax across many C# and .NET releases. Every "(C# N)" and "(.NET N+)" annotation in a heading or sentence is a falsifiable claim, and several in scope are already visible in the headings (`Lock Type (C# 13)`, `Collection Expressions (C# 12)`, `Inline Arrays (C# 12)`, `HybridCache (.NET 9)`, `Output Caching (.NET 7+)`, `PeriodicTimer (.NET 6+)`, `Source-Generated Regex (.NET 7+)`). Each needs confirming against the release notes, including whether the feature has left preview.

**Item 7 (hierarchy and scope clarity)** in this domain means four distinct containment hierarchies, and a guide should say which one it is talking about when a constraint depends on it:

| Hierarchy | Levels |
| --- | --- |
| Compilation and packaging | solution → project (target framework moniker) → assembly → namespace → type → member |
| Runtime memory | stack → heap (gen 0/1/2) → Large Object Heap → Pinned Object Heap → unmanaged/native |
| Load and isolation | process → AssemblyLoadContext → assembly |
| Execution context | thread pool → TaskScheduler → SynchronizationContext → `await` continuation |

The tell described in the standard shows up here as a constraint bullet like "this only works in a `ref struct`" or "this cannot cross an `await`," which is meaningful only to a reader who already knows the stack-versus-heap rule behind it.

**Item 9 (tag audit)** — measured across the 43 guides before the pass:

| Tag | Count | Reading |
| --- | --- | --- |
| `dotnet` | 42/43 | Pure category restatement. Zero discriminating power. Drop. |
| `c-sharp` | 38/43 | Same. Drop. |
| `practical` | 32/43 | A skill-level tag, so one must stay, but the levels do not currently split the set. Rebalance against `fundamentals` (12) and `advanced` (9). |
| `performance` | 9/43 | Real signal where the guide is about performance, filler where it is a third-order concern. Keep selectively. |
| `async`, `concurrency`, `memory-management`, `metaprogramming`, `interop` | 2-4 each | Genuine cross-guide signal. Keep. |

Everything else appears exactly once. So for this category: drop `dotnet` and `c-sharp` outright, keep exactly one skill-level tag and make it honest, and spend the two freed slots on the specific nouns a reader would type — the actual type and API names (`span`, `ihttpclientfactory`, `system-text-json`, `arraypool`, `ilogger`, `pinvoke`) rather than the category.

**Decided at the gate:** drop both, as recommended. `c-sharp` and `dotnet` also appear on ASP.NET Core and WinUI 3 guides, where they do *not* restate the category, so a site-wide `c-sharp` tag filter will return only out-of-category guides once this pass finishes. That was raised and accepted; the tagging policy as written governs.

---

## Phase 0: Consolidation (complete)

### Structure and reading order

Nine subcategories, 46 guides: the 43 that were in scope, minus one moved to `_resources/`, plus four new.

| # | Subcategory | Guides | Change |
| --- | --- | --- | --- |
| 1 | **Platform & Runtime** *(was Foundations)* | 2 | Renamed; glossary moved out, one new guide in |
| 2 | Language Fundamentals | 11 | One new guide |
| 3 | Object-Oriented Programming | 3 | Unchanged |
| 4 | Async & Concurrency | 4 | Unchanged |
| 5 | Collections & Data | 3 | Unchanged |
| 6 | Core Libraries | 13 | Unchanged count; `linq.md` and `console-and-environment.md` rescoped |
| 7 | Advanced Topics | 4 | Unchanged |
| 8 | IoT & Embedded | 3 | Unchanged |
| 9 | **Tooling & Quality** *(was Tooling)* | 3 | Renamed; two new guides |

**Order rationale across subcategories.** Platform & Runtime leads because compilation, assemblies, and target frameworks are the vocabulary every later guide assumes. That slot previously held a language-agnostic glossary, which taught nothing about .NET specifically. The middle five are unchanged and already correct: the language, then the types built from it, then concurrency, then the data structures concurrency operates on, then the BCL that uses all of it. Advanced Topics stays where it is, since source generators, unsafe code, expression trees, and interop each assume most of what precedes them. IoT & Embedded follows as C# applied to a constrained target. Tooling & Quality closes the category because measuring, testing, and enforcing quality apply to everything before them.

**Order rationale inside changed subcategories.**

- **Platform & Runtime:** `compilation-and-runtime.md` first (what the compiler and runtime do to your code), then `assemblies-packages-and-targeting.md` (how that output is packaged, versioned, and resolved).
- **Language Fundamentals:** `dates-times-and-numbers.md` slots after `strings-and-text.md`, since both are about BCL primitives that carry formatting and culture concerns, and it needs the value-type framing from `types-and-variables.md` first.
- **Tooling & Quality:** `unit-testing-in-dotnet.md`, then `benchmarking-and-diagnostics.md`, then `code-formatting-standards.md`. Correctness before performance before style, which is also the order a team adopts them.

### Topic ownership map

Stays for the life of the pass. "Clause" means a non-owner defines the concept in a clause where it's used, or omits it, and does not link to the owner. Out-of-scope owners are named by path.

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| JIT, tiered compilation, AOT, trimming, deployment models | `compilation-and-runtime.md` | span-and-memory, source-generators, json-serialization (AOT): clause |
| Target frameworks, assemblies, NuGet resolution, `AssemblyLoadContext`, library versioning | `assemblies-packages-and-targeting.md` (New) | compilation-and-runtime, attributes-and-reflection, code-formatting-standards: clause |
| Value vs reference semantics, boxing and unboxing, `var`, tuples, type conversion | `types-and-variables.md` | memory-management, classes-and-structs, collections-overview, generics: clause |
| Stack vs heap, GC generations, LOH, `IDisposable`, finalizers, allocation cost | `memory-management.md` | types-and-variables, classes-and-structs, span-and-memory, async: clause |
| Operator semantics and precedence, pattern matching expressions, range and index | `operators-and-expressions.md` | control-flow keeps the `switch` *statement* as control flow only |
| Statements vs expressions, C#'s drift toward expression forms, switch expressions, expression-bodied members | `operators-and-expressions.md` | control-flow, methods-and-parameters, properties-and-indexers: clause |
| Lambda syntax, delegate types, `Func`/`Action`, events, multicast, closures and capture, event-subscriber leaks and weak events | `delegates-and-events.md` | operators-and-expressions, linq, expression-trees: clause |
| Variance (covariance and contravariance) | `generics.md` | delegates-and-events, collections-overview, interfaces-and-inheritance: clause |
| Branching, loops, iteration as control flow | `control-flow.md` | streaming-and-pipelines owns `yield return` *mechanics* |
| String creation, comparison, culture, `StringBuilder`, interning | `strings-and-text.md` | span-and-memory keeps the allocation-free path; regular-expressions, json-serialization: clause |
| Format strings and culture-sensitive formatting | `_resources/dotnet-format-strings.md` (New) | strings-and-text, dates-times-and-numbers, console-and-environment: reasoning only |
| `DateTime`/`DateTimeOffset`/`DateOnly`/`TimeOnly`, time zones, `TimeProvider`, `decimal` vs `double`, rounding | `dates-times-and-numbers.md` (New) | types-and-variables, timers-and-scheduling, caching-patterns, unit-testing: clause |
| Exception hierarchy, `try`/`catch`/`finally`, custom exceptions, `ExceptionDispatchInfo`, `AggregateException` | `exceptions-and-errors.md` | control-flow, async-await-fundamentals, httpclient-and-networking: clause |
| Attributes, reflection, `Type`/`MemberInfo`, reflection cost | `attributes-and-reflection.md` | source-generators owns the compile-time alternative; json-serialization, expression-trees: clause |
| Nullable reference types, null-state analysis, nullability attributes | `nullable-reference-types.md` | types-and-variables keeps nullable *value* types only |
| Classes, structs, records, `readonly struct`, `ref struct` declaration rules, sealed/abstract/partial/static/nested | `classes-and-structs.md` | span-and-memory keeps `ref struct` *stack-safety*; source-generators keeps `partial` as the generator hook |
| Interfaces, inheritance, polymorphism, default interface methods, composition vs inheritance | `interfaces-and-inheritance.md` | classes-and-structs, generics, dependency-injection: clause |
| Properties, indexers, `init`, `required`, backing fields | `properties-and-indexers.md` | classes-and-structs: clause |
| GoF patterns as patterns (decorator, factory, strategy) | Programming Patterns category (out of scope) | dependency-injection keeps the DI *mechanics* of registering a decorator; interfaces-and-inheritance: clause |
| `Task`, `await` mechanics, continuations, `SynchronizationContext`, `ConfigureAwait`, cancellation tokens, async antipatterns | `async-await-fundamentals.md` | every async-touching guide: clause |
| `Parallel`, PLINQ, thread pool, concurrent collections, partitioning | `parallel-and-concurrent.md` | linq keeps sequential LINQ only; collections-overview: clause |
| `yield return`, `IAsyncEnumerable<T>`, `System.IO.Pipelines`, `Channel<T>`, backpressure | `streaming-and-pipelines.md` | async-await-fundamentals, parallel-and-concurrent, file-system: clause |
| `lock`, `Lock`, `Monitor`, `SemaphoreSlim`, `Mutex`, `ReaderWriterLockSlim`, `Interlocked`, deadlock avoidance | `synchronization-primitives.md` | parallel-and-concurrent, caching-patterns: clause |
| Collection types, their complexity, and selection | `collections-overview.md` | Data Structures & Algorithms category (out of scope) owns the data-structure *theory* and the Big-O reference |
| Generic types and methods, constraints, static abstract members | `generics.md` | collections-overview, dependency-injection: clause |
| `Span<T>`, `ReadOnlySpan<T>`, `Memory<T>`, `ArrayPool<T>`, `stackalloc`, inline arrays, ref-safety rules | `span-and-memory.md` | collections-overview, strings-and-text, unsafe-code-and-pointers, native-interop: clause |
| LINQ execution model, `IEnumerable` vs `IQueryable`, composition, LINQ performance | `linq.md` | entity-framework-core keeps provider translation; expression-trees keeps the tree |
| LINQ operator syntax and behavior catalogue | `_resources/linq-operator-reference.md` (New) | linq keeps the reasoning only |
| `DbContext`, entity configuration, relationships, change tracking, migrations, provider translation, concurrency tokens | `entity-framework-core.md` | Databases category (out of scope) owns relational modeling and indexing theory; linq, expression-trees: clause |
| Console streams, exit codes, arguments, environment variables, `Ctrl+C` handling | `console-and-environment.md` (rescoped) | logging, configuration-and-options: clause |
| DI container mechanics, lifetimes, registration, scopes and disposal, captive dependencies | `dependency-injection.md` | configuration-and-options, logging, httpclient-and-networking, caching-patterns: clause |
| `HttpClient` lifetime, `IHttpClientFactory`, `SocketsHttpHandler`, delegating handlers, HTTP/2 and HTTP/3 | `httpclient-and-networking.md` | caching-patterns, mqttnet: clause |
| Retry, circuit breaker, and resilience *as policy implementation* (Polly) | `httpclient-and-networking.md` | mqttnet keeps MQTT reconnection specifics; the Architecture category owns the patterns themselves |
| `IMemoryCache`, `IDistributedCache`, Redis, cache-aside/stampede/eviction in .NET, `HybridCache` | `caching-patterns.md` | Architecture owns caching *patterns* as architecture; ASP.NET Core owns response and output caching |
| Configuration providers, precedence, `IOptions`/`IOptionsSnapshot`/`IOptionsMonitor`, validation, user secrets | `configuration-and-options.md` | dependency-injection, logging, console-and-environment: clause |
| `ILogger`, log levels, structured logging, scopes, source-generated logging, provider selection | `logging.md` | Observability category (out of scope) owns tracing, metrics, and OpenTelemetry; exceptions-and-errors: clause |
| `System.Text.Json`, converters, `JsonSerializerContext`, polymorphism, the JSON DOM | `json-serialization.md` | configuration-and-options, httpclient-and-networking, mqttnet: clause |
| Regex syntax, `RegexOptions`, `[GeneratedRegex]`, backtracking and timeouts | `regular-expressions.md` | strings-and-text, source-generators: clause |
| `PeriodicTimer`, `System.Threading.Timer`, `System.Timers.Timer`, timer selection | `timers-and-scheduling.md` | async-await-fundamentals: clause |
| `IHostedService`/`BackgroundService` and the generic host | `dotnet/asp/aspnet-background-services.md` (out of scope) | timers-and-scheduling, mqttnet: clause |
| File and directory APIs, paths, streams, `BinaryWriter`/`BinaryReader`, async file I/O | `file-system.md` | console-and-environment, streaming-and-pipelines: clause |
| .NET crypto APIs: hashing, AES, RSA, signatures, KDFs, `RandomNumberGenerator` | `cryptography-basics.md` | the Security category and `_resources/cryptographic-algorithm-choices.md` own algorithm selection |
| Roslyn source generators, incremental generators, built-in generators, debugging generated code | `source-generators.md` | json-serialization, regular-expressions, logging keep their generator *usage* as a clause |
| Pointers, `fixed`, function pointers, `unsafe` rules | `unsafe-code-and-pointers.md` | span-and-memory owns the safe alternative; native-interop owns the boundary |
| `Expression<T>`, tree construction, visitors, compilation | `expression-trees.md` | linq, entity-framework-core: clause |
| P/Invoke, marshaling, COM, pinning, `LibraryImport` vs `DllImport` | `native-interop.md` | unsafe-code-and-pointers, dotnet-iot-libraries: clause |
| GPIO, I2C, SPI, PWM from .NET; `System.Device.Gpio`; `Iot.Device.Bindings` | `dotnet-iot-libraries.md` | dotnet-nanoframework keeps the constrained-target differences |
| nanoFramework programming model, its BCL subset, flashing and deployment | `dotnet-nanoframework.md` | dotnet-iot-libraries: clause |
| MQTTnet client and broker APIs, MQTT-specific messaging patterns in C# | `mqttnet-iot-communication.md` | — |
| MQTT the protocol: QoS levels, retained messages, last will, topic design | `iot/iot-protocols-communication.md` (out of scope) | mqttnet: clause |
| Azure IoT Hub | Azure category (out of scope) | mqttnet: moved out |
| Test frameworks, test doubles, async testing, test structure | `unit-testing-in-dotnet.md` (New) | dependency-injection, httpclient-and-networking, logging keep testability as a design consequence only |
| Test strategy, the test pyramid, contract testing | `architecture/testing-strategy-architecture.md` (out of scope) | unit-testing-in-dotnet: clause |
| BenchmarkDotNet, `dotnet-counters`, `dotnet-trace`, dumps, reading a GC trace | `benchmarking-and-diagnostics.md` (New) | memory-management, span-and-memory, and every `performance`-tagged guide: clause |
| Profiling methodology, load testing, capacity planning | `architecture/performance-engineering.md` (out of scope) | benchmarking-and-diagnostics: clause |
| EditorConfig, Roslyn analyzers, `dotnet format`, `Directory.Build.props`, CI enforcement | `code-formatting-standards.md` | assemblies-packages-and-targeting keeps `Directory.Packages.props` |

### What Phase 0 changed

Recorded here only because a later row needs to know it, not as a changelog.

- `programming-terminology.md` was deleted as a guide and now exists as `_resources/csharp-programming-glossary.md`.
- `linq.md` lost its twelve operator-catalogue sections to `_resources/linq-operator-reference.md`. The surviving guide is deliberately thin between `Deferred vs Immediate Execution` and `Common Patterns`; row 24 writes the `IEnumerable` vs `IQueryable` and composition material the map assigns it.
- `console-and-environment.md` lost `Formatting Output` to `_resources/dotnet-format-strings.md` and `Binary Serialization` to `file-system.md`, and was rescoped. Row 26 writes the redirection, exit-code, and `Ctrl+C` cancellation material the new scope needs.
- `memory-management.md` lost `Monitoring GC` to the benchmarking seed. `Finding Memory Leaks` stayed, since leak *patterns* are allocation reasoning rather than diagnostics.
- Four seeds exist with front matter and a scope comment only, and they render as near-empty pages until their rows run: rows 2, 9, 44, and 45.
- The `Foundations` directory name was kept for the renamed `Platform & Runtime` subcategory, so no file moved. The config is the source of truth for the subcategory; the directory name is now only a path.
- The three new resources carry rows 47-49 because a resource gets no Phase 1 row otherwise, and all three are newly authored text that item 1 has never run against.


---

## Domain gotchas

- **Check MSBuild and SDK behaviour against the installed SDK targets, not only the docs.** Row 2 found `learn.microsoft.com/dotnet/core/project-sdk/msbuild-props` stale on whether libraries get a `deps.json` (they do), and found `WarningsNotAsErrors` documented as a general mechanism that `NU1605` specifically ignores. The SDK's own `targets` directory under `dotnet/sdk/<version>/Sdks/Microsoft.NET.Sdk/` is authoritative for what a property actually sets, and `dotnet new` plus `dotnet build` in a temp directory settles behaviour questions in under a minute. Two review rounds asserted opposite things about `$(PublicKey)`; the targets file decided it.

- **Diagrams in this pass are ASCII pending a `.NET runtime` figure composite.** Item 5 has now produced three diagrams that would clear the figure bar (row 1's build-time/run-time compilation paths, row 2's plugin load-context topology, row 2's direct-dependency-wins versus cousin-dependencies graph shapes). Each is currently ASCII, tied to the paragraph it supports. A figure needs a composite resource to own it, and building that composite three figures in and re-ordering it on every later row is worse than building it once. Decide at the end of Core Libraries whether the accumulated set justifies a composite, and convert then; until then record new candidates here rather than creating one-off figures. Row 9 added two more: one instant fanning out to three zones' wall clocks, and the New York spring-forward/fall-back UTC-versus-wall-clock timeline (values verified on .NET 10). Row 19 added the multi-stage channel pipeline with bounded buffers pushing back upstream. Row 18 added the thread-pool picture (global queue, per-worker local queues, work stealing), a topology that clears the figure bar. Row 17 added one more: the `await` timeline (caller runs synchronously to the first incomplete await, gets a task back, continuation resumes later), a sequence between caller, method, and continuation that belongs in the composite if one is built. Row 5's `foreach` lowering and row 4's index/range boundary picture are ASCII too but are code-shaped and probably stay ASCII.

- **Liquid is not currently a hazard in scope, and that is fragile.** A scan of all 43 guides found no `{{` or `{%` outside a raw block, and none of them are wrapped in a raw block either. Any Razor, MSBuild, or mustache-style sample added during the pass will silently evaluate. Re-run the scan before closing, and wrap any guide that gains such a sample.

- **Microsoft Learn's `interface` keyword page misstates default-member accessibility.** It says interface members with a default implementation are `private` unless a modifier is given. Compiled on .NET 10, they are public (callable through the interface, `IsPublic` true). Trust the compiler over that sentence.

*(Otherwise empty at the start. Add source quirks, timeouts and their substitutes, unpublishable figures, vocabulary traps as they are found. Promote anything cross-domain into the standard instead.)*

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Dynamic PGO is on by default from .NET 8.** It was implemented but disabled by default in .NET 6 and 7. The tier-0 to tier-1 call-count threshold is 30. On-stack replacement is on by default for x64 and Arm64, which is why methods containing loops are quick-jitted on those architectures and compiled optimized from the start elsewhere.
- **Code Access Security does not exist in modern .NET.** The infrastructure is .NET Framework only; most of the API surface is obsolete from .NET 5 (`SYSLIB0003`), with calls either no-ops or throwing `PlatformNotSupportedException`. Any guide describing partial trust, permission demands, or stack walks as a .NET security mechanism is wrong.
- **`System.Linq.Expressions` works under Native AOT but always interprets.** `Expression.Compile()` does not throw; it falls back to the interpreter. Native AOT's actual bans are `System.Reflection.Emit`, dynamic loading (`Assembly.LoadFile`), C++/CLI, and built-in COM on Windows.
- **Trimming is only supported for self-contained apps.** `PublishTrimmed`/`PublishAot` are application-level publish operations; `IsTrimmable`/`IsAotCompatible` are library-level declarations that only turn on analyzers. A library is never itself trimmed.
- **Single-file does not extract managed assemblies.** Since .NET 5 they are loaded from the bundle in memory. Only native libraries extract, and only under `IncludeNativeLibrariesForSelfExtract`. Under single-file, `Assembly.Location` returns an empty string and `Assembly.GetFile` throws.
- **Framework-dependent roll-forward defaults to `Minor`.** It rolls forward across minor versions within a major, never across majors, and an exact-minor match wins over a rolled-forward higher minor.
- **The .NET SDK already treats `NU1605` (package downgrade) as an error**, via `WarningsAsErrors` in `Microsoft.NET.Sdk.CSharp.props`. `WarningsNotAsErrors` cannot un-promote it, because NuGet applies `NoWarn`, then `WarningsAsErrors`, then `WarningsNotAsErrors`. Only `NoWarn` suppresses it.
- **Every SDK-style library emits a `deps.json`.** `GenerateDependencyFile` defaults to true for `.NETCoreApp` and `.NETStandard` projects. `EnableDynamicLoading` does not create it; it turns on `CopyLocalLockFileAssemblies` and adds a `runtimeconfig.json` with `RollForward=LatestMinor`.
- **`$(PublicKey)` is not populated by the SDK.** `SignAssembly` and `AssemblyOriginatorKeyFile` do not set it, so an `InternalsVisibleTo` grant from a signed assembly needs explicit `Key` metadata unless the author defines `PublicKey` themselves.
- **"Value types live on the stack" is wrong and is repeated everywhere in this category.** A value type lives wherever its container lives: a local in a stack slot or register, a field of a class on the heap inside that object, a captured variable on the heap inside the closure. Row 3 owns the correction. Every later guide touching value semantics, boxing, `ref struct`, closures, or async state machines must not restate the myth.
- **Not every implicit numeric conversion is exact.** `int`→`float`, `long`→`float` and `long`→`double` are implicit and lossy above the destination's significand width. "Implicit" means cannot fail, not cannot lose digits.
- **NuGet resolves to the lowest applicable version, not the highest**, and a direct reference wins over transitive ones within the same subgraph. Any guide showing a `PackageReference` version should not imply the number is what gets installed.
- **C# 14 with .NET 10 is the current release; C# 15 is preview.** C# 14 added null-conditional assignment, extension members, the `field` keyword, user-defined compound assignment, `nameof` on unbound generics, implicit span conversions, and modifiers on untyped lambda parameters. C# 15 features on Microsoft Learn (closed hierarchies, union types) are preview and must not be taught as available.
- **Integer overflow context is lexical.** `checked`/`unchecked` apply only to code written inside them, not to called methods; the project default comes from `CheckForOverflowUnderflow`. Constant-expression overflow is a compile error, and `decimal` always throws.
- **Optional-parameter defaults are compiled into the caller**, like `public const` values. Verified with a two-assembly test: changing a library's default has no effect on callers until they recompile.
- **`in` on a non-`readonly` struct costs a defensive copy per member call.** Any guide recommending `in` for performance must pair it with `readonly struct` or `readonly` members.
- **String comparison defaults are inconsistent, and culture defaults are silent.** `==`, `Equals`, `Contains(string)`, `Replace`, `Split`, and the `char` overloads are ordinal; `IndexOf(string)`, `StartsWith(string)`, `EndsWith(string)`, `Compare`, and default sorting use the current culture. Interpolation, `ToString()`, and `Parse` use the current culture: under `de-DE`, `double.TryParse("1234.5")` returns `true` with 12345 (verified). Any sample that formats or parses machine-readable text should pass `CultureInfo.InvariantCulture`.
- **`"

".IndexOf("
")` returns 6, not -1, on .NET 10 / Windows ICU.** The widely repeated -1 result is version- and platform-specific; don't cite it.
- **Date/time facts verified in row 9.** `DateTime ==` ignores `Kind`; `Unspecified` converts as local in `ToUniversalTime()` and as UTC in `ToLocalTime()`; `DateTimeOffset ==` compares instants; `TimeProvider` is in-box from .NET 8; `Math.Round` defaults to `ToEven`; `Math.Round(2.135, 2)` is 2.13 on `double` and 2.14 on `decimal`. Later guides (timers, caching, logging, unit testing) should use `TimeProvider`/`FakeTimeProvider` for time-dependent samples rather than `DateTime.Now`.
- **C# has no released union or result type.** Unions are C# 15 preview. Any guide describing discriminated unions as coming "in C# 14" is wrong.
- **Formatter-based serialization constructors are obsolete (`SYSLIB0051`, .NET 8).** No sample in scope should add a `(SerializationInfo, StreamingContext)` constructor or `[Serializable]` for new types.
- **Exception hierarchy and unions.** `ObjectDisposedException` derives from `InvalidOperationException`; `HttpRequestException` derives directly from `Exception`; `when` filters run before inner `finally` blocks. C# 14 has no union types (C# 15 preview only), so no guide should describe them as shipped.
- **Attribute and reflection facts verified in row 11.** Declaring `[assembly: AssemblyVersion]` in an SDK-style project is error CS0579. Each `GetCustomAttribute` call constructs a new attribute instance. `[Conditional]` removes the call's argument evaluation too. `BindingFlags.NonPublic` alone matches nothing. Plugin loading stays with row 2 (`AssemblyLoadContext`), and source generators with row 37.
- **GC facts verified in row 12.** GC triggers are the allocation threshold, low memory, and `GC.Collect` (not "idle"). LOH is 85,000 bytes and up, collected with gen 2, and auto-compacted under a container or hard memory limit. `LowLatency` is workstation-only, and assigning `NoGCRegion` to `LatencyMode` throws (use `TryStartNoGCRegion`). DATAS has been on by default since .NET 9. Optimized code can end a local's GC lifetime before its scope ends, and unoptimized code can extend it. An unreferenced `System.Threading.Timer` can be collected in .NET, so it doesn't leak its callback; timers belong to row 34.
- **`await` rethrows only the first exception of a faulted task.** `Task.WhenAll` failures beyond the first are visible only through the combined task's `Exception`.
- **Most JIT diagnostic environment variables are release-available, but not all.** `DOTNET_JitDisasm`, `DOTNET_JitDisasmSummary`, and `DOTNET_JitStdOutFile` work on the shipping runtime from .NET 7. `DOTNET_JitStress` and the other `CONFIG_*` knobs require a checked runtime build.
- **Nullable reference type facts verified in row 13 (compiled on .NET 10).** For an unconstrained type parameter, `T?` (C# 9) is *not* `Nullable<T>`: with `T = int` it is `int`, and "null" is `default`. `T?` under `where T : class` dates from C# 8. The `var` pattern matches null, so `{ Prop: var x }` doesn't establish not-null; `{ } x` does. Array elements (`new string[n]`) are a blind spot with no warning. `Dictionary.TryGetValue` uses `[MaybeNullWhen(false)]`, not `NotNullWhen(true)`. `<WarningsAsErrors>nullable</WarningsAsErrors>` promotes every nullable warning. Row 13 owns NRT, so rows 16 (`required`, `field`), 22 (`notnull`, `T?`), 25 (EF Core infers required columns from NRT), and 32 (`RespectNullableAnnotations`, .NET 9, opt-in) treat nullability as a clause and must not contradict these.
- **Type-declaration facts verified in row 14 (compiled on .NET 10).** `HttpClient` is not sealed (`String` is). `List<T>.Enumerator` is a mutable public struct returned directly by `GetEnumerator()`, not a `readonly struct` reached through `IEnumerator<T>`. A struct's parameterless constructor (C# 10) runs for `new S()` but not for `default(S)` or array elements. A primary constructor parameter used only in initializers is not captured, and one used both to initialize a field and in a member body raises CS9124. A primary-constructor `readonly struct` (not `record struct`) gets no properties from its parameters. `using static Outer;` brings nested types into scope. Partial properties and indexers are C# 13; partial constructors and events are C# 14.
- **Property facts verified in row 16 (compiled on .NET 10).** C# 14's `field` keyword works in any accessor, with an initializer, in `field ??= ...` getters, and as a `ref` argument (`SetProperty(ref field, value)`); a same-named member triggers CS9258. `[SetsRequiredMembers]` is not verified by the compiler. `^` and `..` work on any type with `Count`/`Length` plus an `int` indexer (and `Slice(int, int)` for ranges), with no `Index`/`Range` indexer. System.Text.Json ignores public fields unless `IncludeFields` is set. Later guides with property-heavy samples (logging, configuration, JSON) should prefer `field` over a hand-declared backing field when a setter needs logic.
- **Async facts verified in row 17 (run on .NET 10).** An exception thrown before an async method's first `await` is stored in the returned task, not thrown at the call. The method runs on the caller's thread up to its first incomplete `await`. An unobserved faulted task raises `TaskScheduler.UnobservedTaskException` on GC and does not crash the process; an exception escaping `async void` with no context does crash it. `.Result`/`.Wait()` wrap in `AggregateException`, `GetAwaiter().GetResult()` rethrows the original. `Task.WaitAsync(TimeSpan)` (.NET 6) throws `TimeoutException`. `ConfigureAwaitOptions.SuppressThrowing` (.NET 8) throws `ArgumentOutOfRangeException` on `Task<T>`. CS4014 fires only inside an `async` caller. Swallowing `OperationCanceledException` leaves the task `RanToCompletion`. Later guides should use `Task.WaitAsync` or a linked `CancellationTokenSource` for timeouts, never a `Task.WhenAny` race against `Task.Delay`.
- **Parallel facts verified in row 18 (run on .NET 10, 20 logical CPUs).** `Enumerable.Sum` over `int` is checked and throws `OverflowException` (PLINQ wraps it in `AggregateException`). `ConcurrentDictionary.GetOrAdd` ran its factory 20 times for one contended key; store `Lazy<T>` for a run-once factory. `TaskCreationOptions.LongRunning` gets a non-pool thread. Minimum worker threads default to the logical CPU count. `Parallel.ForEachAsync` defaults to `ProcessorCount` concurrency even for I/O bodies. `Parallel.ForEach` failures arrive as `AggregateException`.
- **Streaming facts verified in row 19 (run on .NET 10).** .NET 10 ships async LINQ in the box (`System.Linq.AsyncEnumerable`, including `Chunk`, `Take`, `ToListAsync`); earlier versions need the `System.Linq.Async` package. `WithCancellation` reaches an iterator only through an `[EnumeratorCancellation]` parameter. An iterator's `finally` runs on early `break`. `ChannelWriter.Complete(ex)` rethrows `ex` in `ReadAllAsync` consumers. `Parallel.ForEachAsync` accepts `IAsyncEnumerable<T>`. `JsonSerializer.SerializeAsync` streams an `IAsyncEnumerable<T>`. A `PipeReader` loop that breaks on `IsCompleted` without handling the leftover buffer drops the final unterminated line. Rows 32 (JSON) and 35 (file system) should treat these as clauses, not re-teach them.
- **Synchronization facts verified in row 20 (run on .NET 10).** `await` inside `lock` is error CS1996. `Mutex` released from another thread throws `ApplicationException`; `ReaderWriterLockSlim` exited from another thread throws `SynchronizationLockException`; so neither can span an `await`. `Monitor` is reentrant, `SemaphoreSlim` is not, and releasing past `maxCount` throws `SemaphoreFullException`. A `Lock` converted to `object` falls back to `Monitor` with warning CS9216. Named `Semaphore` is Windows-only (Learn: "named semaphores are not supported" on Unix); named `Mutex` works cross-platform. `System.Threading.RateLimiting` is a NuGet package outside ASP.NET Core, not part of the base runtime. Later guides (caching, HttpClient, MQTT) needing an async lock use `SemaphoreSlim(1, 1)` and should not call it a rate limiter.
- **Collection facts verified in row 21 (run on .NET 10).** A range over an array (`arr[1..4]`) copies. `Dictionary` allows `Remove` and `Clear` during enumeration (adding still throws); `List<T>` throws on any change. `OrderedDictionary<TKey, TValue>` is .NET 9, `FrozenDictionary`/`FrozenSet` .NET 8, `PriorityQueue` .NET 6 (smallest priority first). A collection expression targeting `IReadOnlyList<T>` yields a compiler-synthesized read-only type. Later guides that keep a dictionary plus a list for ordered lookup, or hand-roll a priority queue, should use these types.
- **Generics facts verified in row 22 (compiled on .NET 10).** Contravariance runs from general to specific: `IConverter<Animal, string>` converts to `IConverter<Dog, object>`, never the reverse, and a lambda `(Dog d) => ...` can't target `Func<Animal, string>`. Variance doesn't apply to value-type arguments (`List<int>` is not `IEnumerable<object>`). Type inference never uses the return type (CS0411). An interface with static abstract members can be a variable type but not a type argument (CS8920). `INumber<T>` generic math works on `int`, `double`, `decimal`; `IParsable<T>` covers `DateOnly`. Rows that show variance or generic math (LINQ, delegates already done) must not reverse the direction.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding** — re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 1-46 (any) | Every `(C# N)` and `(.NET N+)` annotation in a heading is a dated claim: `Lock Type (C# 13)`, `Collection Expressions (C# 12)`, `Inline Arrays (C# 12)`, `Static Abstract Members (C# 11)`, `Function Pointers (C# 9+)`, `Records (C# 9.0+)`, `Async Streams (C# 8.0)`, `HybridCache (.NET 9)`, `Output Caching (.NET 7+)`, `Source-Generated Regex (.NET 7+)`, `PeriodicTimer (.NET 6+)`. Confirm the version and whether the feature has left preview. |
| 35 file-system | The `BinaryWriter`/`BinaryReader` block moved in from row 26 carries a `Binary vs JSON` comparison twice over — once as an HTML card pair, once as a markdown table. Item 2. Also confirm nothing in scope teaches `BinaryFormatter`, which is removed, not merely obsolete, in current .NET. |
| 24 linq | The catalogue moved to the resource labelled several BCL methods `(C# 10 / .NET 6)`. They are .NET 6 *library* additions, not C# 10 language features; the resource says `.NET 6`. Verify each against the API reference, and check `Take(Range)` and `Order()`/`OrderDescending()` specifically. |
| 47, 48, 49 resources | All three resources are newly authored and unverified. Row 49 in particular asserts specifier behaviour (`P` multiplying by 100, `R`/`u` appending a UTC marker without converting, `:` and `/` being culture-substituted) that must be read off the standard and custom format-string pages. |
| 23 span-and-memory | Check it against the row 3 cross-guide fact on value types and storage location. `span-and-memory` is the likeliest to restate the stack myth, since `ref struct` stack-safety is genuinely about the stack and the framing bleeds into plain structs. |
| 23 span-and-memory | Row 14 now owns the `ref struct` declaration rules (the can't-list, C# 11 `ref` fields, C# 13 interfaces and `allows ref struct`, locals in async methods that don't span an `await`). Trim `Ref Structs: Building Stack-Only Types` to composing over spans and stack-safety as a clause. Its line "Ref structs gained `IDisposable` support in C# 8" is suspect: C# 8 added pattern-based `using` (a `Dispose()` method, no interface); implementing an interface is C# 13. |
| 41, 42 IoT | `dotnet-iot-libraries.md` and `dotnet-nanoframework.md` both carry a `Supported Hardware` list. Support for both projects drifts continuously and neither list is worth refreshing; test 3 says drop the list and keep the reasoning. |
| 33 regular-expressions | Row 8 dropped its regex section, including an interpreted / `Compiled` / `[GeneratedRegex]` tier explanation. Confirm this guide covers the three tiers (plus `RegexOptions.NonBacktracking`) so nothing was lost. |
| 39 expression-trees | Row 1 states that `Expression.Compile()` falls back to the interpreter under Native AOT rather than failing. Check this guide does not claim expression trees are unusable under AOT, and that any performance claim about `Compile()` names the AOT case. |
| 45 benchmarking-and-diagnostics | Row 1 kept the compilation-specific JIT environment variables (`JitDisasmSummary`, `JitDisasm`, `JitStdOutFile`) and the note that tiering and PGO should be warmed past rather than disabled. This row owns `dotnet-counters`, `dotnet-trace`, dumps, and BenchmarkDotNet; do not re-teach the JIT knobs. |
| 23 span-and-memory, 37 source-generators, 32 json-serialization | Each treats AOT as a clause per the map. The clause must match row 1: the ban is on `Reflection.Emit` and dynamic loading, not on reflection generally, and trimming is implied by AOT rather than a separate opt-in. |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

- **Row 1, the size of a self-contained publish.** The guide says a self-contained publish bundles the base class library at "~60MB+". Microsoft documents self-contained output as large without publishing a figure, so the number is carried over from the guide's previous text and left approximate. It is used twice, in the Trimming opening and the comparison table.

## Progress

Row numbers are assigned once and never renumbered. Rows 47-49 are the resources Phase 0 created, which need item 1 like any other new text.

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Platform & Runtime | `dotnet/c-sharp/foundations/compilation-and-runtime.md` | Complete |
| 2 | Platform & Runtime | `dotnet/c-sharp/foundations/assemblies-packages-and-targeting.md` **(new)** | Complete |
| 3 | Language Fundamentals | `dotnet/c-sharp/fundamentals/types-and-variables.md` | Complete |
| 4 | Language Fundamentals | `dotnet/c-sharp/fundamentals/operators-and-expressions.md` | Complete |
| 5 | Language Fundamentals | `dotnet/c-sharp/fundamentals/control-flow.md` | Complete |
| 6 | Language Fundamentals | `dotnet/c-sharp/fundamentals/methods-and-parameters.md` | Complete |
| 7 | Language Fundamentals | `dotnet/c-sharp/fundamentals/delegates-and-events.md` | Complete |
| 8 | Language Fundamentals | `dotnet/c-sharp/fundamentals/strings-and-text.md` | Complete |
| 9 | Language Fundamentals | `dotnet/c-sharp/fundamentals/dates-times-and-numbers.md` **(new)** | Complete |
| 10 | Language Fundamentals | `dotnet/c-sharp/fundamentals/exceptions-and-errors.md` | Complete |
| 11 | Language Fundamentals | `dotnet/c-sharp/fundamentals/attributes-and-reflection.md` | Complete |
| 12 | Language Fundamentals | `dotnet/c-sharp/fundamentals/memory-management.md` | Complete |
| 13 | Language Fundamentals | `dotnet/c-sharp/fundamentals/nullable-reference-types.md` | Complete |
| 14 | Object-Oriented Programming | `dotnet/c-sharp/oop/classes-and-structs.md` | Complete |
| 15 | Object-Oriented Programming | `dotnet/c-sharp/oop/interfaces-and-inheritance.md` | Complete |
| 16 | Object-Oriented Programming | `dotnet/c-sharp/oop/properties-and-indexers.md` | Complete |
| 17 | Async & Concurrency | `dotnet/c-sharp/async/async-await-fundamentals.md` | Complete |
| 18 | Async & Concurrency | `dotnet/c-sharp/async/parallel-and-concurrent.md` | Complete |
| 19 | Async & Concurrency | `dotnet/c-sharp/async/streaming-and-pipelines.md` | Complete |
| 20 | Async & Concurrency | `dotnet/c-sharp/async/synchronization-primitives.md` | Complete |
| 21 | Collections & Data | `dotnet/c-sharp/collections/collections-overview.md` | Complete |
| 22 | Collections & Data | `dotnet/c-sharp/collections/generics.md` | Complete |
| 23 | Collections & Data | `dotnet/c-sharp/collections/span-and-memory.md` | Not started |
| 24 | Core Libraries | `dotnet/c-sharp/libraries/linq.md` | Not started |
| 25 | Core Libraries | `dotnet/c-sharp/libraries/entity-framework-core.md` | Not started |
| 26 | Core Libraries | `dotnet/c-sharp/libraries/console-and-environment.md` | Not started |
| 27 | Core Libraries | `dotnet/c-sharp/libraries/dependency-injection.md` | Not started |
| 28 | Core Libraries | `dotnet/c-sharp/libraries/httpclient-and-networking.md` | Not started |
| 29 | Core Libraries | `dotnet/c-sharp/libraries/caching-patterns.md` | Not started |
| 30 | Core Libraries | `dotnet/c-sharp/libraries/configuration-and-options.md` | Not started |
| 31 | Core Libraries | `dotnet/c-sharp/libraries/logging.md` | Not started |
| 32 | Core Libraries | `dotnet/c-sharp/libraries/json-serialization.md` | Not started |
| 33 | Core Libraries | `dotnet/c-sharp/libraries/regular-expressions.md` | Not started |
| 34 | Core Libraries | `dotnet/c-sharp/libraries/timers-and-scheduling.md` | Not started |
| 35 | Core Libraries | `dotnet/c-sharp/libraries/file-system.md` | Not started |
| 36 | Core Libraries | `dotnet/c-sharp/libraries/cryptography-basics.md` | Not started |
| 37 | Advanced Topics | `dotnet/c-sharp/advanced/source-generators.md` | Not started |
| 38 | Advanced Topics | `dotnet/c-sharp/advanced/unsafe-code-and-pointers.md` | Not started |
| 39 | Advanced Topics | `dotnet/c-sharp/advanced/expression-trees.md` | Not started |
| 40 | Advanced Topics | `dotnet/c-sharp/advanced/native-interop.md` | Not started |
| 41 | IoT & Embedded | `dotnet/iot/dotnet-iot-libraries.md` | Not started |
| 42 | IoT & Embedded | `dotnet/iot/dotnet-nanoframework.md` | Not started |
| 43 | IoT & Embedded | `dotnet/iot/mqttnet-iot-communication.md` | Not started |
| 44 | Tooling & Quality | `dotnet/c-sharp/tooling/unit-testing-in-dotnet.md` **(new)** | Not started |
| 45 | Tooling & Quality | `dotnet/c-sharp/tooling/benchmarking-and-diagnostics.md` **(new)** | Not started |
| 46 | Tooling & Quality | `dotnet/c-sharp/tooling/code-formatting-standards.md` | Not started |
| 47 | *(resource)* | `_resources/csharp-programming-glossary.md` **(new)** | Not started |
| 48 | *(resource)* | `_resources/linq-operator-reference.md` **(new)** | Not started |
| 49 | *(resource)* | `_resources/dotnet-format-strings.md` **(new)** | Not started |
