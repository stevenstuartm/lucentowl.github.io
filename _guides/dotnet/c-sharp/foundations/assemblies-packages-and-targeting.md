---
title: "Assemblies, Packages, and Target Frameworks"
layout: guide
category: ".NET & C#"
subcategory: "Platform & Runtime"
description: "How .NET code is packaged, versioned, and resolved: target frameworks and multi-targeting, assemblies versus NuGet packages, package asset flow and pruning, the four version numbers, NuGet resolution and central package management, strong naming, and assembly load contexts."
tags: [assemblies, nuget, target-frameworks, versioning, assemblyloadcontext, strong-naming, practical]
---

A build turns source into an assembly, a package wraps assemblies for distribution, and at startup the runtime picks exactly one assembly per name and loads it. Three systems, each with its own rules, and most of the confusing errors in .NET happen where they disagree. A package restores fine but the type is missing at runtime. A library compiles against one version of a dependency and runs against another. Two objects that are obviously the same type refuse to cast.

This guide covers the vocabulary and the resolution rules behind those situations: what you compile against, what you ship, and what actually loads.

## Target Frameworks

A **target framework moniker** (TFM) declares the set of APIs your code compiles against. It is a compile-time contract, not a statement about which runtime will execute the result.

```xml
<PropertyGroup>
  <TargetFramework>net10.0</TargetFramework>
</PropertyGroup>
```

| Target framework | TFM | Notes |
|---|---|---|
| .NET 10 | `net10.0` | Current release |
| .NET 9 | `net9.0` | |
| .NET 8 | `net8.0` | |
| .NET Standard 2.0 | `netstandard2.0` | The bridge to .NET Framework |
| .NET Standard 2.1 | `netstandard2.1` | Mono, Xamarin, and Unity, but not .NET Framework |
| .NET Framework 4.8.1 | `net481` | Windows-only, in maintenance |

The `net` prefix is shared between two very different things, which is a genuine trap when reading someone else's project file. `net48` is .NET Framework 4.8; `net8.0` is .NET 8. The dot in the version is the whole signal, and there is no `net8` without one.

### OS-Specific TFMs

The base TFM gives you the APIs that work everywhere. To reach APIs that only one operating system has, append the platform:

```xml
<TargetFramework>net10.0-windows</TargetFramework>
```

An OS-specific TFM inherits everything in its base TFM and adds the platform bindings on top, so `net10.0-windows` is a superset of `net10.0`. The available platforms are `android`, `browser`, `ios`, `maccatalyst`, `macos`, `tizen`, `tvos`, and `windows`.

You can pin a platform API version as well, as in `net10.0-ios18.7`. That number selects which reference assemblies you compile against. It does **not** set the minimum OS your app runs on. Those are separate settings and conflating them is a common mistake:

```xml
<PropertyGroup>
  <!-- Compile against iOS 18.7 APIs... -->
  <TargetFramework>net10.0-ios18.7</TargetFramework>
  <!-- ...but still run on iOS 15.0 devices. -->
  <SupportedOSPlatformVersion>15.0</SupportedOSPlatformVersion>
</PropertyGroup>
```

Setting `SupportedOSPlatformVersion` lower than the TFM's platform version is a promise you have to keep in code. The platform compatibility analyzer holds you to it, warning on any call to an API newer than your stated minimum unless you guard it with `OperatingSystem.IsIOSVersionAtLeast(18, 7)` or similar. Omit the property and it defaults to the TFM's platform version, which means no guards are required and no warnings appear.

### .NET Standard

.NET Standard is a specification rather than an implementation: a set of APIs that every conforming .NET runtime promises to provide. A library targeting `netstandard2.0` runs on .NET Framework 4.6.1+, .NET Core 2.0+, Mono, Unity, and Xamarin from one build.

Since .NET 5 unified the runtimes, .NET Standard is mostly of interest to a library that must support **both** modern .NET and .NET Framework. If you do not need .NET Framework, target `net10.0` and take the much larger API surface.

The cost of targeting `netstandard2.0` out of habit is less about missing APIs than about the work of reaching them. `Span<T>` and `Memory<T>` arrive through the `System.Memory` package; `IAsyncEnumerable<T>` and `IAsyncDisposable` through `Microsoft.Bcl.AsyncInterfaces`; nullable reference type annotations need an explicit `LangVersion` because the SDK defaults `netstandard2.0` to an older one. Each works, and each is a package reference and a version to maintain that a `net10.0` target does not need. Default interface methods are the one thing you genuinely cannot have, since they require runtime support that predates the target.

`netstandard2.1` sits awkwardly between the two. .NET Framework never implemented it and never will, so it does not serve the .NET Framework audience at all; what it does serve is Mono, Xamarin, and Unity, which is a narrow enough case that Microsoft's own guidance is to skip it and target modern .NET directly.

### Multi-Targeting

A library can build for several TFMs at once with the plural property. Each target compiles separately, producing one assembly per TFM inside a single package.

```xml
<PropertyGroup>
  <TargetFrameworks>netstandard2.0;net8.0;net10.0</TargetFrameworks>
</PropertyGroup>

<ItemGroup Condition="'$(TargetFramework)' == 'netstandard2.0'">
  <PackageReference Include="System.Text.Json" Version="8.0.5" />
</ItemGroup>
```

The SDK defines a preprocessor symbol per target, so code can differ where the platforms differ. Replace dots and hyphens with underscores and uppercase it: `netstandard2.0` becomes `NETSTANDARD2_0`, `net10.0` becomes `NET10_0`. The `_OR_GREATER` variants are usually what you want, since they do not need editing every time you add a target:

```csharp
#if NET8_0_OR_GREATER
    // TimeProvider exists here.
    var now = timeProvider.GetUtcNow();
#else
    var now = DateTimeOffset.UtcNow;
#endif
```

Multi-targeting is not free. Every target is a separate compilation, a separate set of package resolutions, and a separate matrix cell your tests should cover. Add a target when you have users on it, not in case you might.

## Assemblies and Packages Are Not the Same Thing

These two are constantly used interchangeably and they answer different questions.

| | Assembly | NuGet package |
|---|---|---|
| **What it is** | A `.dll` or `.exe` holding IL and metadata | A `.nupkg` archive, which is a zip with a manifest |
| **Unit of** | Identity, loading, type resolution, visibility | Distribution and version negotiation |
| **Named by** | Simple name plus version, culture, public key | Package ID |
| **Chosen by** | The runtime, at load | NuGet, at restore |

One package usually contains several assemblies, laid out by target framework:

```
Contoso.Data.3.1.0.nupkg
  lib/netstandard2.0/Contoso.Data.dll
  lib/net8.0/Contoso.Data.dll
  lib/net10.0/Contoso.Data.dll
```

Restore picks the folder whose TFM best matches your project and references only that one. This is why a package "supporting .NET Standard 2.0" and a package "supporting .NET 10" can be the same package, and why adding a TFM to your project can silently change which compiled code you get.

The package ID and the assembly name are also independent. `Microsoft.Extensions.DependencyInjection.Abstractions` ships `Microsoft.Extensions.DependencyInjection.Abstractions.dll`, but nothing requires that, and plenty of packages ship assemblies under other names or ship several at once.

### Three Kinds of Reference

```xml
<ItemGroup>
  <PackageReference Include="Serilog" Version="4.2.0" />
  <ProjectReference Include="../Contoso.Core/Contoso.Core.csproj" />
  <Reference Include="Legacy.Interop">
    <HintPath>lib/Legacy.Interop.dll</HintPath>
  </Reference>
</ItemGroup>
```

`PackageReference` goes through restore and brings transitive dependencies with it. `ProjectReference` builds another project in the same solution and flows its package references onward too. A raw `Reference` points at a file on disk, brings nothing with it, and is a maintenance liability outside COM interop and vendor SDKs that ship no package.

### Controlling What a Reference Brings

A package is not one thing. Its folders carry different kinds of asset, and three metadata attributes decide which of them you consume and which flow onward to anyone who consumes you.

| Asset value | What it covers |
|---|---|
| `compile` | Contents of `lib`, controlling whether you can compile against the assemblies |
| `runtime` | Contents of `lib` and `runtimes`, controlling whether they are copied to the build output |
| `build` | `.props` and `.targets` in the `build` folder |
| `buildTransitive` | `.props` and `.targets` in `buildTransitive`, which flow on to consuming projects |
| `buildMultitargeting` | `.props` and `.targets` in `buildMultitargeting`, for cross-framework targeting |
| `analyzers` | The .NET analyzers in the package |
| `contentFiles`, `native` | The `contentfiles` and `native` folders |
| `all`, `none` | Everything, or nothing. Must appear alone |

Three attributes gate those assets at two different hops:

```
   package assets                 your project                  your consumers
  (lib, runtimes, build,
   buildTransitive,
   analyzers, ...)
        │                              │                              │
        │  IncludeAssets (all)         │  PrivateAssets               │
        │  ExcludeAssets (none)        │  (contentfiles;              │
        ├─────── gate 1 ──────────────►│   analyzers;build) ──gate 2─►│
        │                              │                              │
   "what do I consume?"         "what flows onward when
                                 someone references me?"
```

| Attribute | Meaning | Default |
|---|---|---|
| `IncludeAssets` | What this project consumes | `all` |
| `ExcludeAssets` | What this project does not consume | `none` |
| `PrivateAssets` | Consumed here, but does not flow to consumers | `contentfiles;analyzers;build` |

Read the `PrivateAssets` default carefully, because it is the one people are surprised by. Content files, analyzers, and `build` targets stop at your project. Everything else, including `compile`, `runtime`, and `buildTransitive`, flows onward by default. `buildTransitive` exists precisely so a package author can ship targets that reach consumers of consumers, and it is deliberately absent from that default list.

The `compile` and `runtime` split is the package-level echo of the whole compile-versus-run theme. Excluding `compile` while keeping `runtime` gives you a package whose assemblies ship with your app but that you cannot write code against, which is how you carry a runtime-only implementation behind an abstraction.

```xml
<!-- Build-time tooling: used here, invisible to consumers of this library. -->
<PackageReference Include="Microsoft.SourceLink.GitHub" Version="8.0.0" PrivateAssets="all" />
<PackageReference Include="StyleCop.Analyzers" Version="1.2.0-beta.556" PrivateAssets="all" />
```

`PrivateAssets="all"` stops the dependency appearing in your published package's manifest. Forgetting it on a build-time-only package is how a library ends up forcing an analyzer onto everyone who installs it.

### Package Pruning

Several .NET libraries ship both in the runtime and as standalone packages, so that projects on older targets can use them. `System.Text.Json` is the usual example. A project targeting .NET 10 that picks up `System.Text.Json` transitively gets a package it does not need, because the assembly is already in the shared framework and build conflict resolution would discard the package's copy anyway.

`PrunePackageReference` removes those packages from the graph at restore. It arrived in NuGet 6.13 / .NET SDK 9.0.200 as opt-in via `RestoreEnablePackagePruning`, and in the .NET 10 SDK it is **on by default** for every framework of a project targeting .NET 10 or later. The SDK supplies the list of prunable packages from the shared frameworks your project references; you do not write it.

A transitive match is simply dropped, whether it arrived through a package or through a project. Direct references are treated differently, and only from the .NET 10 SDK onward; the first iteration of pruning touched transitive packages only. A direct `PackageReference` that matches is not removed from your project file but has `PrivateAssets="all"` and `IncludeAssets="none"` applied implicitly, and you get `NU1510` telling you the reference can go, but only once the package is removable from **every** framework the project targets. In a multi-targeted project still carrying a `netstandard2.0` target, the package is genuinely needed there, so no warning appears. A `ProjectReference` is never pruned, and raises `NU1511` instead. Both warnings require the project to target .NET 10.

`RestoreEnablePackagePruning` is set per target framework rather than per project, so you can enable or disable it for one TFM of a multi-targeted build.

The practical consequence is that a restore on .NET 10 can legitimately produce a smaller graph than the same project produced a release earlier, and a regenerated lock file can show a larger diff than the change you made.

### What Ships Next to the App

Restore writes the resolved graph to `obj/project.assets.json`, which is a build artifact and belongs in `.gitignore`. Two other files are published beside the executable and do matter at runtime, in this order.

`YourApp.runtimeconfig.json` comes first, because it decides which framework the host loads at all: the target framework name and version, the roll-forward policy, and any runtime configuration properties the app sets. Nothing can be resolved until the host has picked a framework.

`YourApp.deps.json` comes second. It lists every assembly the app expects along with its version and location, and the host parses it to build the runtime's probing paths from the framework that was just selected.

Without it, the host falls back to assuming the application directory holds everything and populates the probing paths from the directory contents. A simple app whose dependencies all sit beside it often survives that, satellite assemblies in culture subfolders included. What does not survive is anything `deps.json` was encoding beyond "these files exist": selection of the right `runtimes/<rid>` asset for the current platform, any asset located outside the application directory, and version-specific resolution when two files share a simple name. `AssemblyDependencyResolver` reads a component's own `deps.json` too, which is what makes the plugin pattern later in this guide work.

## The Four Version Numbers

A single library carries four versions that mean different things and are changed at different rates. Confusing them is behind a whole family of "but I upgraded it" bugs.

| Version | MSBuild property | Who reads it | Effect |
|---|---|---|---|
| **Package version** | `Version` / `PackageVersion` | NuGet, at restore | Which package is downloaded. Supports SemVer prerelease suffixes |
| **Assembly version** | `AssemblyVersion` | The runtime, at load | Part of assembly identity. Drives version comparison when loading |
| **File version** | `FileVersion` | Windows Explorer | None on behavior. `Major.Minor.Build.Revision` only |
| **Informational version** | `InformationalVersion` | Humans and diagnostics | None on behavior. Free-form string |

```xml
<PropertyGroup>
  <Version>3.1.0-preview.2</Version>       <!-- package: 3.1.0-preview.2 -->
  <AssemblyVersion>3.0.0.0</AssemblyVersion>
  <FileVersion>3.1.0.4821</FileVersion>    <!-- build number in the revision -->
</PropertyGroup>
```

Setting `Version` alone is enough for most projects, since the SDK derives the others from it. Two conventions repay being set deliberately:

**Move the assembly version on major releases only.** `3.0.0` and `3.1.7` both carry `AssemblyVersion` 3.0.0.0, and `4.0.0` moves to 4.0.0.0. A rarely-changing assembly version means far fewer binding redirects for any consumer still on .NET Framework, and it costs nothing on modern .NET.

**Never freeze the assembly version outright.** It appears in assembly-qualified type names and exception text, so a version that never moves makes diagnostics actively misleading, and it makes side-by-side installation in the Global Assembly Cache impossible for .NET Framework consumers.

For the informational version, let [Source Link](https://github.com/dotnet/sourcelink){:target="_blank" rel="noopener noreferrer"} generate it. It produces values like `3.1.0-preview.2+204ff0a`, appending the commit the assembly was built from, which turns a stack trace into something you can check out.

## How NuGet Picks a Version

Restore flattens the whole dependency graph, resolves every conflict up front, and writes the answer to the assets file. NuGet documents four rules that produce that answer: **lowest applicable version**, **floating versions**, **direct-dependency-wins**, and **cousin dependencies**. They interact, and two of them turn on the *shape* of the graph rather than on the numbers.

Fix that shape in your head before reading the rules. A **subgraph** is everything reachable from one node: your application is the root of the whole graph, and each direct dependency is the root of a subgraph inside it. The last two rules differ only in whether the two competing versions sit in the same subgraph or in different ones.

```
  DIRECT DEPENDENCY WINS              COUSIN DEPENDENCIES
  (same subgraph, one of them         (different subgraphs, neither
   referenced directly by the app)     referenced directly by the app)

        App                                   App
         ├──────────────┐                      ├────────────┐
         │              │                      │            │
      Package A      Package B              Package A    Package C
         │            >= 2.0.0                 │            │
         ▼                                     ▼            ▼
      Package B                             Package B    Package B
       >= 1.0.0                              >= 1.0.0     >= 2.0.0

   App's direct reference wins.         No direct reference, so the
   Result: B 2.0.0, and 1.0.0 is        lowest version satisfying BOTH
   ignored along with that branch.      constraints wins. Result: B 2.0.0.
```

Both examples land on 2.0.0, and that coincidence is instructive. The same answer arrives by two different routes, and the routes behave differently once you change the numbers. On the left, lowering the app's direct reference to 1.0.0 downgrades B and breaks Package A. On the right, no such override exists, and a constraint that cannot be satisfied fails restore instead.

### Lowest Applicable Version

`Version="3.1.0"` does not mean "exactly 3.1.0". It means "3.1.0 or higher", and NuGet takes the **lowest** version on the feed that satisfies every constraint. Asking for `3.1.0` when the feed has 3.1.0, 3.4.2, and 4.0.0 gets you 3.1.0.

This surprises people who expect package managers to prefer newness. It is a deliberate choice for reproducibility: a restore today and a restore in six months produce the same graph, unless something else in the graph forces a higher version.

Ask for a version that does not exist on the feed and the lowest applicable rule still applies, so a request for `2.1.0` resolves to `2.2.0` if that is the next one up. A request pinned to an exact version that is absent fails outright.

### Version Ranges

The bare version string is shorthand. The full notation is interval notation, and library authors should know it because it is how you express a compatibility window.

| Notation | Meaning |
|---|---|
| `3.1.0` | 3.1.0 or higher. The common case |
| `[3.1.0]` | Exactly 3.1.0, and nothing else |
| `[3.1.0,4.0.0)` | 3.1.0 up to but excluding 4.0.0 |
| `(3.1.0,)` | Higher than 3.1.0 |
| `(,4.0.0]` | 4.0.0 or lower |

Square brackets include the endpoint, parentheses exclude it. `[3.1.0,4.0.0)` is the range a library expressing "any 3.x" wants.

Exact pins (`[3.1.0]`) in a **library** are hostile to your consumers. An exact pin cannot be reconciled with any other constraint, so a consumer whose graph needs 3.2.0 through some other path hits a restore failure and has to resolve it by adding a direct top-level reference, overriding your pin entirely. Pin exactly in an application, where you own the whole graph. Express ranges in a library.

Prerelease versions follow one rule: NuGet considers prereleases for a package only if something in the graph explicitly asks for one. A range of `[1.0.0,2.0.0)` will not pick up `1.2.0-beta.1` even though it falls numerically inside. To include prereleases, say so with `[1.0.0,2.0.0-0)`.

### Floating Versions

A `*` takes the highest match instead of the lowest.

| Pattern | Resolves to |
|---|---|
| `*` | The highest stable version |
| `4.*` | The highest stable 4.x |
| `4.2.*` | The highest stable 4.2.x |
| `*-*` | The highest version including prereleases |

Floating can only be specified at the project level, never inside a package's own dependencies. It keeps you current without editing project files, at the cost of restores that are no longer reproducible.

Two settings make it safe in CI, and you need both. `RestorePackagesWithLockFile` generates `packages.lock.json` recording the resolved closure, and you commit that file for applications (not for libraries, whose lock file has no say over what their consumers resolve). On its own, though, a lock file does not force anything: restore happily re-resolves and rewrites it when inputs change. `RestoreLockedMode`, or `dotnet restore --locked-mode`, is what makes restore either reproduce the lock file exactly or fail.

```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  <RestoreLockedMode Condition="'$(ContinuousIntegrationBuild)' == 'true'">true</RestoreLockedMode>
</PropertyGroup>
```

Locked mode on developer machines is a nuisance, since every deliberate package change becomes a two-step. Locked mode in CI is the whole reason to bother. A build that silently resolved something different from what was reviewed is a build you cannot reason about.

### Direct Dependency Wins

When two versions of a package appear in the same subgraph and one of them is a direct reference, the direct one is used. This is the override mechanism: adding a top-level `PackageReference` lets you force a version regardless of what your dependencies asked for.

It cuts both ways. Referencing an older version than a dependency needs **downgrades** it, which is how you break something that was working. NuGet classifies that as warning `NU1605`, but the .NET SDK already opts into treating it as an error through `WarningsAsErrors`, so in an SDK-style project a downgrade fails the build rather than passing quietly.

The fix is the one the error text names: add a direct reference to the higher version. Suppressing it is available and rarely right, because the thing it is telling you about shows up later as a `MissingMethodException`:

```xml
<!-- Scoped to one package, which is at least defensible. -->
<ItemGroup>
  <PackageReference Include="Contoso.Legacy" Version="1.0.0" NoWarn="NU1605" />
</ItemGroup>

<!-- Project-wide, and a bad idea. -->
<PropertyGroup>
  <NoWarn>$(NoWarn);NU1605</NoWarn>
</PropertyGroup>
```

Reach for `NoWarn` rather than `WarningsNotAsErrors` here. NuGet applies these properties in the order `NoWarn`, then `WarningsAsErrors`, then `WarningsNotAsErrors`, so the SDK's own `WarningsAsErrors` entry outranks any attempt to un-promote `NU1605` that way.

### Cousin Dependencies

When the competing versions sit in **different** subgraphs with no direct reference at the top, NuGet takes the lowest version that satisfies all of the constraints at once. Package A needing `>=1.0.0` and Package B needing `>=2.0.0` resolves to 2.0.0, since that satisfies both.

Some conflicts have no solution. If A pins `[1.0.0]` and B needs `>=2.0.0`, no single version works and restore fails. The fix is the one NuGet's own guidance gives: add a direct reference at the top level. That moves the decision into the direct-dependency-wins rule, where you get to make it deliberately instead of having restore give up.

Putting the rules together gives the model that matters: **a package's version is decided by the whole graph, not by the line you wrote.** The version in your project file is a floor and a vote, not a decision.

## Central Package Management

In a repository with thirty projects, the same package is referenced thirty times and drifts. Central package management moves versions to one file.

Create `Directory.Packages.props` at the repository root:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Serilog" Version="4.2.0" />
    <PackageVersion Include="Polly" Version="8.5.0" />
  </ItemGroup>
</Project>
```

Project files then reference packages with no version at all:

```xml
<ItemGroup>
  <PackageReference Include="Serilog" />
</ItemGroup>
```

MSBuild imports only the **nearest** `Directory.Packages.props` walking up from the project. A file in a subdirectory shadows the root one entirely rather than adding to it, so a nested file has to import its parent explicitly:

```xml
<Project>
  <Import Project="$([MSBuild]::GetPathOfFileAbove(Directory.Packages.props, $(MSBuildThisFileDirectory)..))" />
  <ItemGroup>
    <PackageVersion Update="Serilog" Version="4.1.0" />
  </ItemGroup>
</Project>
```

Three features layer on top:

**`VersionOverride`** lets one project deviate, which is how you stage an upgrade across a large repository one project at a time:

```xml
<PackageReference Include="Serilog" VersionOverride="4.3.0" />
```

**`GlobalPackageReference`** applies a package to every project in the repository, which fits analyzers, build tooling, and versioning packages:

```xml
<GlobalPackageReference Include="Nerdbank.GitVersioning" Version="3.6.146" />
```

These come pre-configured as development-only dependencies, so they carry `PrivateAssets="All"` and never flow to your consumers.

**Transitive pinning** promotes a transitive dependency to a top-level one so you can set its version without a `PackageReference`:

```xml
<PropertyGroup>
  <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
</PropertyGroup>
```

This is the direct answer to "a package four levels down has a CVE and its parent has not shipped a fix." Pinning only moves versions up; attempting a downgrade raises `NU1109`.

Transitive pinning behaves differently for libraries than for applications. When you pack a project with pinned transitive dependencies, NuGet promotes them to explicit dependencies in the resulting `.nuspec`, so your published package now declares dependencies you never wrote down. Use it freely in applications, and check the packed manifest before using it in a library.

### Where Central Management Costs You

Centralising versions trades per-project autonomy for repository-wide consistency, and that trade is not free in every repository.

The migration is all-or-nothing per project and mechanical but wide: every `PackageReference` in the repository loses its `Version` attribute in the same change. A repository where teams deliberately run different versions of the same package will find the central file becomes a coordination point they now have to negotiate through, and `VersionOverride` is the escape hatch that turns back into exactly the drift the central file was meant to prevent. Some repositories disable it outright with `CentralPackageVersionOverrideEnabled` set to `false`, which makes the consistency real at the cost of making staged upgrades harder.

Central package management also interacts badly with multiple package sources. NuGet raises `NU1507` when more than one source is configured, because a centrally declared version with several feeds to draw from is a dependency confusion risk. The fix is [package source mapping](https://learn.microsoft.com/nuget/consume-packages/package-source-mapping){:target="_blank" rel="noopener noreferrer"} or a single source, and either one earns its keep independently of central package management.

Opt a single project back out when you need to:

```xml
<PropertyGroup>
  <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>
</PropertyGroup>
```

## Assembly Identity and Strong Naming

An assembly's identity has four parts, and all four participate in matching:

```
Contoso.Data, Version=3.0.0.0, Culture=neutral, PublicKeyToken=32ab4ba45e0a69a1
```

`PublicKeyToken=null` means the assembly is not strong-named. **Strong naming** signs the assembly with a key pair, which makes the identity unforgeable by accident and, on .NET Framework, unlocks GAC installation, side-by-side loading, and strict version binding.

That last one is the source of strong naming's reputation. On .NET Framework, a reference to a strong-named assembly must match the loaded version **exactly**. Ship a library built against `Newtonsoft.Json, Version=11.0.0.0` into an app that loads 13.0.0.0 and the load fails, until someone adds a **binding redirect** to the app's config telling the runtime to substitute one for the other:

```xml
<dependentAssembly>
  <assemblyIdentity name="Newtonsoft.Json" publicKeyToken="30ad4fe6b2a6aeed" culture="neutral" />
  <bindingRedirect oldVersion="0.0.0.0-13.0.0.0" newVersion="13.0.0.0" />
</dependentAssembly>
```

Modern .NET has none of this. There is no GAC, the loader accepts an equal or higher version rather than demanding an exact one, and the signature is not treated as a security boundary. Strong naming is also viral on .NET Framework, where a strong-named assembly can only reference other strong-named assemblies.

That leaves a narrow rule for library authors: strong name if your targets include .NET Framework or .NET Standard, because consumers on .NET Framework may be unable to reference you otherwise, and skip it if you target modern .NET only. `CS8002` is the warning to expect in the first case, not the second. It fires on the assembly doing the referencing when that assembly is signed and something it references is not, so it appears in *your* build if you sign and depend on an unsigned package, and in your *consumers'* builds if they sign and you did not. Suppressing it is fine for libraries targeting modern .NET only.

Never ship both a signed and an unsigned package of the same library. As far as the runtime is concerned those are different assemblies holding different types, and an application that ends up with both gets type conflicts that read like nonsense.

Changing or removing a strong naming key changes the assembly's identity, which breaks every already-compiled consumer. Treat the key as permanent and check the key pair into source control so others can rebuild your library.

For proving who published code, use [Authenticode](https://learn.microsoft.com/windows-hardware/drivers/install/authenticode){:target="_blank" rel="noopener noreferrer"} or NuGet package signing. Strong naming is an identity mechanism, not an integrity one.

### InternalsVisibleTo

Assembly boundaries are also visibility boundaries: `internal` means "visible within this assembly." `InternalsVisibleTo` punches a hole in that, usually so a test project can reach internals.

The SDK exposes it as an MSBuild item, so it does not need an `AssemblyInfo.cs`:

```xml
<ItemGroup>
  <InternalsVisibleTo Include="Contoso.Data.Tests" />
</ItemGroup>
```

If the granting assembly is strong-named, the friend assembly must be strong-named too, and the grant has to name the friend's key. Supply it as `Key` metadata, using the full public key rather than the short `PublicKeyToken`:

```xml
<InternalsVisibleTo Include="Contoso.Data.Tests" Key="00240000048000009400000006020000..." />
```

Two things about this are easy to get wrong. It is a **compile-time** visibility grant, not a security control: anyone can call those members with reflection whether or not you granted access. And a test suite that reaches deep into internals is coupled to your implementation rather than your contract, so it will object to every refactoring. Use it to reach a seam that genuinely should not be public, not as a way to avoid designing one.

## How the Runtime Finds an Assembly

Restore decided which package to download. Something separate decides which assembly gets loaded into the running process, and that is `AssemblyLoadContext`.

Every .NET application has one implicitly. `AssemblyLoadContext.Default` is populated by the runtime at startup and locates dependencies by default probing, which for a normal application means reading `deps.json` and looking beside the executable. Most applications never think about it.

Two rules govern any load context:

**One version per simple name.** A single context holds at most one assembly per simple name. `Contoso.Data` version 2 and `Contoso.Data` version 3 cannot coexist in one context.

**Equal or higher wins.** When a reference to `Contoso.Data, Version=2.0.0.0` is resolved against a context that already loaded version 3.0.0.0, the load succeeds and returns version 3. Resolution succeeds when the loaded version is equal to or higher than the requested one. This is why .NET Core needs no binding redirects: the relaxed rule that .NET Framework required configuration to get is simply the default.

### Multiple Contexts

The one-version rule becomes a problem in exactly one architecture: plugins. Two independently compiled plugins that each need a different major version of the same library cannot both be satisfied by the default context.

Creating a separate `AssemblyLoadContext` per plugin gives each its own name-to-assembly dictionary:

```
                    AssemblyLoadContext.Default
                    ├── Host.exe
                    ├── Contoso.Plugins.Abstractions.dll   (shared contract)
                    └── runtime assemblies
                              │
                 shared by ───┴─── reference, not copy
                     │                        │
        ┌────────────┴───────────┐  ┌─────────┴──────────────┐
        │  ALC "analytics"       │  │  ALC "reporting"       │
        │  Analytics.dll         │  │  Reporting.dll         │
        │  Contoso.Data v2.0.0   │  │  Contoso.Data v3.0.0   │
        └────────────────────────┘  └────────────────────────┘
```

Two things in that picture carry the whole design.

The isolation is by **name resolution only**. There is no binary or security boundary between contexts; they are isolated because they do not find each other's assemblies by name. Plugin code is not sandboxed by being in its own context.

The contract assembly is **shared, not copied**. `AssemblyDependencyResolver` reads a plugin's own `deps.json` to find its private dependencies, and the custom context's `Load` override returns `null` for anything that should come from the host, which defers to the default context:

```csharp
sealed class PluginLoadContext : AssemblyLoadContext
{
    private readonly AssemblyDependencyResolver _resolver;

    public PluginLoadContext(string pluginPath, string name)
        : base(name, isCollectible: true)
        => _resolver = new AssemblyDependencyResolver(pluginPath);

    protected override Assembly? Load(AssemblyName assemblyName)
    {
        // Returning null defers to Default, which is how the host and the
        // plugin end up sharing one copy of the contract assembly.
        if (assemblyName.Name == "Contoso.Plugins.Abstractions")
            return null;

        string? path = _resolver.ResolveAssemblyToPath(assemblyName);
        return path is null ? null : LoadFromAssemblyPath(path);
    }
}
```

Get that sharing wrong and you meet the error this design exists to avoid. If the plugin loads its own copy of the contract assembly, its `IPlugin` and the host's `IPlugin` are different types, because two types are the same type only when they come from the same `Assembly` instance. The cast fails with a message that appears to contradict itself:

```
Object of type 'IPlugin' cannot be converted to type 'IPlugin'.
```

When you see that, compare `obj.GetType().Assembly` on both sides and the context each came from, via `AssemblyLoadContext.GetLoadContext(assembly)`.

The fix is always the same: one copy of the shared contract, loaded into the default context, referenced by everyone else. The `Load` override above is not sufficient on its own, because it can only choose between assemblies that exist on disk. Two project settings on the plugin decide what ends up there, and they pull in opposite directions:

```xml
<PropertyGroup>
  <!-- Copy the plugin's OWN dependencies next to it. -->
  <EnableDynamicLoading>true</EnableDynamicLoading>
</PropertyGroup>

<ItemGroup>
  <!-- ...but NOT the shared contract, which must come from the host. -->
  <ProjectReference Include="../Contoso.Plugins.Abstractions/Contoso.Plugins.Abstractions.csproj">
    <Private>false</Private>
    <ExcludeAssets>runtime</ExcludeAssets>
  </ProjectReference>
</ItemGroup>
```

`EnableDynamicLoading` turns on `CopyLocalLockFileAssemblies`, so the plugin's package dependencies are copied into its output folder instead of being left in the NuGet cache. A library built without it emits only its own assembly, and `AssemblyDependencyResolver` then resolves the plugin's dependencies to paths that hold nothing. It also generates a `runtimeconfig.json` for the plugin and sets its roll-forward policy to `LatestMinor`.

A common misreading is that `EnableDynamicLoading` is what produces the `deps.json`. It is not: every SDK-style library gets one, because the SDK defaults `GenerateDependencyFile` to true for `.NETCoreApp` and `.NETStandard` projects. The plugin's `deps.json` lists its dependencies either way. What was missing without the property was the files it points at.

`Private=false` and `ExcludeAssets=runtime` do the opposite job, keeping the contract assembly out of the plugin's folder so the resolver cannot find a second copy. A `PackageReference` to a contract package uses `ExcludeAssets="runtime"` alone for the same purpose.

The runtime assemblies themselves are shared this way by requirement rather than by convention, and so are framework assemblies for ASP.NET Core, WPF, and WinForms. They can only be loaded into the default context.

### Unloading

Passing `isCollectible: true` makes a context unloadable, which is what allows a plugin to be replaced without restarting the process. Calling `Unload()` starts the process rather than completing it: the context is collected only once every object from its assemblies is unreachable, which includes stray event handler references, static fields in the host holding plugin instances, and running threads. A single missed reference keeps every assembly in the context alive, and the leak looks like an ordinary memory leak rather than a failed unload.

Collectibility also constrains what you can load. Assemblies written in C++/CLI are not supported in a collectible context, and any ReadyToRun code in the assemblies is ignored, so everything in the context is JIT compiled. Make a context collectible because you need to reload it, not by default.

### Writing Load-Context Code

Five rules apply to any `Load` override or resolution event handler:

- **Be repeatable.** The same request must always return the same assembly instance. The context's cache key is the simple name, and inconsistency corrupts it.
- **Return `null`, do not throw.** Returning `null` means "not mine" and lets resolution continue. Throwing ends the search and propagates to the caller. Save exceptions for genuinely broken input.
- **Avoid recursion.** Call the load functions that take an explicit path or byte array, not APIs that re-enter resolution.
- **Load into the correct context.** Where a dependency goes is an application decision, and these handlers are where you make it. Call the load-by-path functions on the instance you want the code in. Returning `null` and letting the default context handle it is often the right answer, and it is how sharing gets implemented.
- **Expect concurrent loads.** The runtime handles races by atomically adding to the cache and discarding the loser's instance. Don't add your own locking on top of that.

The default context is more restricted than a custom one: it supports the resolution *events* but not overriding the virtual methods.

## Versioning a Library You Publish

Everything above converges on one obligation for a library author: your version number is a promise about binary compatibility.

Use [SemVer 2.0.0](https://semver.org/){:target="_blank" rel="noopener noreferrer"} for the package version, since it is the number your users see and quote.

Deciding whether a change is breaking is harder than it looks, because .NET separates source compatibility from binary compatibility and a change can break one without the other. Adding a parameter with a default value recompiles cleanly but is binary-breaking, because the method's signature changed and the method the old call site referenced no longer exists; a consumer who does not rebuild gets a `MissingMethodException`. Changing an *existing* parameter's default value is the opposite case and the one where baked-in values matter: call sites compiled the old default into their own IL, so the change is binary-compatible and silently alters behaviour for anyone who does rebuild. Adding a member to an interface breaks every existing implementer, and the default-implementation escape hatch is unavailable to any consumer on .NET Framework or `netstandard2.0`, which is exactly the audience most likely to be pinned to your old version. Changing a `struct` to a `class` breaks in both directions at once: consumers who do not rebuild break binarily, and consumers who do rebuild can still break on `where T : struct` constraints, `default(T)` becoming null, `Nullable<T>` usage that the struct constraint permitted, and any code that read the value into a local and mutated it, which used to affect a detached copy and now aliases the original.

A useful habit is to ask what happens to a consumer who takes your new assembly without recompiling, since that is what the runtime's equal-or-higher version rule will silently do to them.

Prerelease suffixes are opt-in for consumers, so use them freely. `4.0.0-rc.1` will not be picked up by anyone who has not asked for prereleases, which makes it the right way to ship something you want tested but not adopted.

## Key Takeaways

- **A TFM is a compile-time API contract**, not a statement about which runtime executes the code. `net48` is .NET Framework; `net8.0` is .NET 8
- **An OS-specific TFM's platform version selects reference assemblies, not the minimum supported OS.** `SupportedOSPlatformVersion` sets the latter
- **Target `netstandard2.0` only to support .NET Framework.** The APIs you miss are mostly reachable through extra packages; default interface methods are the one thing you cannot get
- **Assemblies and packages are different units.** A package is chosen by NuGet at restore; an assembly is chosen by the runtime at load
- **NuGet resolves to the lowest applicable version**, not the highest, and the result is decided by the whole graph rather than by one reference
- **A direct reference overrides transitive ones**, including downgrading them. The .NET SDK already treats the resulting `NU1605` as an error, and adding a direct reference to the higher version is the fix
- **Central package management puts versions in one file**, with `VersionOverride` for staged upgrades and transitive pinning for dependencies you cannot reference directly
- **Strong naming matters only where .NET Framework is involved.** Modern .NET has no GAC, no strict binding, no binding redirects, and no security meaning attached to the signature
- **A load context holds one assembly per simple name** and accepts an equal or higher version, which is why modern .NET needs no binding redirects
- **Type identity comes from the `Assembly` instance**, so the same type loaded into two contexts is two types. Keep one copy of a shared contract in the default context by excluding it from the plugin's output with `Private=false`
- **A lock file alone does not make restore reproducible.** `RestoreLockedMode` is what makes it fail rather than re-resolve
