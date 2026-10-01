---
layout: post
title: "What Memory-Safety Guidance Asks of .NET Teams"
description: "Government memory-safety guidance lists C# as memory safe, then says in the same documents that native libraries and unsafe escape hatches qualify that safety. For a .NET team, the work is an inventory of where native code enters the process, and a plan to shrink it."
tags: [security, dotnet, csharp, memory-safety, supply-chain]
author: steven-stuart
sources:
  - title: "CISA and FBI: Product Security Bad Practices (October 2024, v2.0 January 2025)"
    url: "https://www.cisa.gov/resources-tools/resources/product-security-bad-practices"
  - title: "NSA: Software Memory Safety (Cybersecurity Information Sheet, November 2022)"
    url: "https://media.defense.gov/2022/Nov/10/2003112742/-1/-1/0/CSI_SOFTWARE_MEMORY_SAFETY.PDF"
  - title: "CISA, NSA, FBI, and international partners: The Case for Memory Safe Roadmaps (December 2023)"
    url: "https://www.cisa.gov/sites/default/files/2023-12/The-Case-for-Memory-Safe-Roadmaps-508c.pdf"
  - title: "White House ONCD: Back to the Building Blocks (February 2024)"
    url: "https://bidenwhitehouse.archives.gov/wp-content/uploads/2024/02/Final-ONCD-Technical-Report.pdf"
  - title: "NSA and CISA: Memory Safe Languages: Reducing Vulnerabilities in Modern Software Development (June 2025)"
    url: "https://www.cisa.gov/resources-tools/resources/memory-safe-languages-reducing-vulnerabilities-modern-software-development"
  - title: "Microsoft Learn: Native interoperability best practices"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/native-interop/best-practices"
  - title: "dotnet/designs: Annotating members as unsafe (caller-unsafe design)"
    url: "https://github.com/dotnet/designs/blob/main/accepted/2025/memory-safety/caller-unsafe.md"
  - title: "Richard Lander: Improving C# Memory Safety (.NET Blog, May 2026)"
    url: "https://devblogs.microsoft.com/dotnet/improving-csharp-memory-safety/"
  - title: "NuGet: Native files in .NET packages"
    url: "https://learn.microsoft.com/en-us/nuget/create-packages/native-files-in-net-packages"
  - title: "Chrome Releases: Stable Channel Update for Desktop (September 11, 2023)"
    url: "https://chromereleases.googleblog.com/2023/09/stable-channel-update-for-desktop_11.html"
  - title: "mono/SkiaSharp issue #2608: SkiaSharp vendors libwebp vulnerable to CVE-2023-4863"
    url: "https://github.com/mono/SkiaSharp/issues/2608"
  - title: "GitHub Advisory Database: CVE-2023-4863, libwebp out-of-bounds write in BuildHuffmanTable"
    url: "https://github.com/advisories/GHSA-j7hp-h8jx-5ppr"
  - title: "What's new in .NET libraries for .NET 9 (zlib-ng)"
    url: "https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9/libraries"
  - title: "SixLabors ImageSharp"
    url: "https://github.com/SixLabors/ImageSharp"
---

C# is memory safe. Your P/Invoke calls aren't.

If you run a .NET team, you've probably watched the memory-safety guidance go by and assumed it was written for someone else. In October 2024, CISA and the FBI published "Product Security Bad Practices," voluntary guidance aimed at software manufacturers whose products serve critical infrastructure. It says that for existing products written in memory-unsafe languages, not having a published memory safety roadmap by January 1, 2026 "is dangerous and significantly elevates risk to national security." That date has passed. The documents behind it put C# on every list of memory-safe languages they publish, so it's easy to conclude that the whole subject belongs to the C and C++ shops.

The same documents don't let managed code off that easily. Each one that names C# as safe also says that a safe language's guarantees stop at the native libraries it calls, and two of them add the language's own escape hatches. The guidance asks little of a .NET team's language choice. What it does ask for is an inventory of where memory-unsafe code runs inside a managed process, and a plan to shrink it. .NET makes that inventory harder than it looks, because much of its unsafe surface carries no marker in the code.

## The Guidance Lists C#, Then Qualifies It

The NSA's 2022 information sheet "Software Memory Safety" names C# as its first example of a memory-safe language. The next paragraph opens by saying that "even with a memory safe language, memory management is not entirely memory safe." It describes two ways unsafety gets back in. Languages expose functions "recognized as non-memory safe" for tasks that need them, and they "can also use libraries written in non-memory safe languages." The sheet then gives the reason those mechanisms are tolerable. They "help to localize where memory problems could exist, allowing for extra scrutiny on those sections of code."

The December 2023 joint guide "The Case for Memory Safe Roadmaps," from CISA, the NSA, the FBI, and partner agencies in four other countries, lists C# in its appendix of memory-safe languages. It gives a section to existing memory-unsafe libraries. "For the foreseeable future, most developers will need to work in a hybrid model of safe and unsafe programming languages," it says, and "the memory safety guarantees offered by MSLs are going to be qualified when data flows across these boundaries." When it calls a memory-unsafe component, the guide says, the calling application "needs to be explicitly aware of" that component's defined memory bounds and must limit any input it passes across.

The White House report "Back to the Building Blocks" (February 2024) argues for memory-safe languages, with memory-safe hardware and formal methods as complements, and points to the roadmap guide for the details. The NSA and CISA's June 2025 guide "Memory Safe Languages: Reducing Vulnerabilities in Modern Software Development" lists C# again and names the remaining problem directly. "Challenges remain around dependency management," it says, "such as when critical external libraries were not developed using MSLs." It also names the high-risk areas to prioritize: "network-facing services, file parsers, codecs, and cryptographic operations."

### Only the Dependency Plan Asks Anything New of .NET

The roadmap guide asks for six elements. Three of them concern moving to a safe language: phases for the migration, a date after which new code is written only in a memory-safe language, and developer training in that language. A .NET team already meets those. The last two, regular public updates and a commitment to tag every published CVE with its weakness type, apply to any vendor that publishes a roadmap, whatever its language. The fourth element is the one that reaches into a .NET codebase. It asks for an "external dependency plan" covering libraries written in C and C++, and says "a memory safe roadmap will not be complete without including OSS."

The Bad Practices document applies its roadmap deadline to products "written in memory-unsafe languages," and it doesn't say whether a C# product that ships a native image decoder counts. A team could argue either way. Arguing the point takes more effort than finding the answer it depends on, which is how much native code the product runs and what input reaches it.

## Where the Unsafe Surface Hides in a .NET Application

The NSA's sheet treats localization as the thing that makes escape hatches acceptable. .NET localizes less than it appears to. A .NET application picks up memory-unsafe code in three places, and only one of them has a keyword.

### Your Own Code: The Keyword Marks Only Pointers

The `unsafe` keyword in C# enables pointer syntax, and it requires the project to set `AllowUnsafeBlocks`. A reviewer who searches for the keyword finds the pointer code. The reviewer doesn't find the other APIs that bypass the same checks, because they compile without it. `Unsafe.Add` skips bounds checks on reference arithmetic, `Unsafe.As` reinterprets one type as another, and `MemoryMarshal.GetReference` returns a reference to a span's first element without checking that the span has one, which is where that arithmetic usually starts. `CollectionsMarshal.AsSpan` hands out a span over a `List<T>`'s backing array that the list can abandon on the next add. They need the same review as pointer code.

P/Invoke has the same gap. A `[DllImport]` declaration needs neither the keyword nor the project setting, yet a declaration whose types don't match the native signature corrupts memory as surely as a bad pointer. Microsoft's native interoperability best practices warn about the usual mismatches, such as a C `long` declared as a C# `long`, which is 8 bytes in C# but 4 bytes in C on Windows. The newer `[LibraryImport]` source generator does require `AllowUnsafeBlocks`. So a project can set it without touching a pointer, and a project that never sets it can still call `Unsafe.Add` and `[DllImport]` freely. The setting tells you little either way.

Microsoft's own design work moves that line. Its accepted design for annotating members as unsafe treats "all P/Invoke methods" as unsafe, "because they may compromise memory safety if the callee function does not match the P/Invoke method specification," and it names most of the `Unsafe` class and `Marshal` as candidates too. The model turns `unsafe` into a contract that propagates to callers. Richard Lander's May 2026 announcement on the .NET Blog puts it in C# 16, as an opt-in preview with .NET 11 and a production release with .NET 12, and makes it a compile error to declare a `LibraryImport` method without marking it `safe` or `unsafe`, so someone has to vouch for each native call. When a team turns it on, the compiler will find the unsafe code. Until then, a search has to.

### Your Packages: Native Code Arrives by Restore

A NuGet package can carry native binaries in its `runtimes/{rid}/native/` folders, and NuGet's documentation on native files in .NET packages describes how the SDK copies them to the output directory on build and publish. Nothing in your source mentions them, and the package that carries them often isn't the one you referenced.

CVE-2023-4863 shows what that costs. It was a heap buffer overflow in libwebp, the WebP image library. Google patched it in Chrome in September 2023 with a note that "an exploit for CVE-2023-4863 exists in the wild," and it reached .NET applications that never wrote a line of C. SkiaSharp, the .NET binding to Google's Skia graphics library, vendored a vulnerable copy of libwebp inside its native binary. The issue on SkiaSharp's repository says so plainly: "SkiaSharp vendors (via mono/skia) a version of libwebp that is vulnerable to CVE-2023-4863." The GitHub advisory lists SkiaSharp versions from 2.0.0 up to 2.88.6 as affected, along with the Magick.NET packages before 13.3.0, which bundle ImageMagick. A .NET service that decoded user-uploaded images with an affected SkiaSharp version could hand a crafted WebP file straight to the vulnerable C code, while every line the team wrote was memory safe.

Restoring a console project that references SkiaSharp 2.88.3 and Microsoft.Data.SqlClient shows where the binaries come from:

```text
Microsoft.Data.SqlClient.SNI.runtime/7.1.0: Microsoft.Data.SqlClient.SNI.dll
SkiaSharp.NativeAssets.macOS/2.88.3: libSkiaSharp.dylib
SkiaSharp.NativeAssets.Win32/2.88.3: libSkiaSharp.dll
```

Neither package the project referenced ships a native file itself. SkiaSharp brings its binaries in through `SkiaSharp.NativeAssets.*` packages, and SqlClient brings a native network interface library on Windows through a runtime package. A review of the project's `PackageReference` list would find neither.

### The Runtime: Native Code You Patch but Don't Own

The .NET runtime ships native code of its own. Microsoft's notes on what's new in the .NET 9 libraries, for example, say `System.IO.Compression` now uses zlib-ng, and the runtime links it statically. A team can't audit or replace that code, and doesn't need to, because Microsoft owns it and ships its fixes. The team's part is how quickly runtime security updates reach production, which belongs in the roadmap as a patch window, not an audit item.

## The Audit Is the Roadmap

For a .NET team, the "external dependency plan" and the "extra scrutiny" the NSA asked for come down to four steps. None of them needs more than git and the .NET SDK.

### Step 1: Find the Unsafe Code You Wrote

Search for the keyword and for the APIs that bypass the same checks without it:

```bash
git grep -n -E '\bunsafe\b|\[(DllImport|LibraryImport)|\b(Unsafe|MemoryMarshal|CollectionsMarshal|Marshal|NativeMemory)\.|SkipLocalsInit|\bGCHandle\b' -- '*.cs'
```

Every hit should have a reason that holds up in review: interop, native memory, function pointers, or a hot path a profiler measured. A hit with none of those can usually be replaced with `Span<T>` or a safe BCL method. A hit that stays should sit behind a narrow wrapper, so the unsafe lines live in one reviewed class and don't spread into callers.

### Step 2: List the Native Binaries You Ship

After a restore, `obj/project.assets.json` holds the whole resolved package graph, transitive packages included, with every native asset marked. This file-based C# app, run with `dotnet run native-assets.cs -- obj/project.assets.json` on .NET 10, lists each package that ships a native binary:

```csharp
// Lists every package in the restore graph that ships native binaries.
using System.Text.Json;

using var doc = JsonDocument.Parse(File.ReadAllText(args[0]));
var found = new SortedDictionary<string, SortedSet<string>>();

foreach (var target in doc.RootElement.GetProperty("targets").EnumerateObject())
foreach (var package in target.Value.EnumerateObject())
{
    var files = new List<string>();
    if (package.Value.TryGetProperty("native", out var native))
        files.AddRange(native.EnumerateObject().Select(f => f.Name));
    if (package.Value.TryGetProperty("runtimeTargets", out var rt))
        files.AddRange(rt.EnumerateObject()
            .Where(f => f.Value.GetProperty("assetType").GetString() == "native")
            .Select(f => f.Name));

    foreach (var file in files.Where(f => !f.EndsWith("/_._")))
    {
        if (!found.TryGetValue(package.Name, out var set))
            found[package.Name] = set = new SortedSet<string>();
        set.Add(Path.GetFileName(file));
    }
}

foreach (var (package, files) in found)
    Console.WriteLine($"{package}: {string.Join(", ", files)}");
```

The list misses one case. A managed package can P/Invoke into a library the operating system already provides, such as `libc` or a Windows DLL, and ship no binary at all. Step 1 run against that package's source, where it's available, finds those. Neither step sees code loaded at run time by reflection or plugins, so a team that loads plugins has to inventory them separately.

### Step 3: Rank Each Native Component by What Reaches It

A native library that only ever sees constants your code supplies carries little risk. One that parses bytes from the network or from an uploaded file is what the 2025 guide means by "file parsers, codecs," and the Bad Practices document by "network-facing code." The roadmap guide's own prioritization advice singles out code that "performs operations on user-generated content, which is a notorious vector for abuse." For each entry from step 2, and each interop call from step 1, write down whether untrusted input can reach it. Image, video, and document decoders, compression, and anything that speaks a network protocol go at the top.

### Step 4: Shrink the Surface From the Top

The ranking decides what to shrink first, and each native component has four ways out:

- **Replace it with a managed library** where one exists, which is the roadmap guide's first suggestion for existing unsafe components. ImageSharp, for example, describes itself as "fully managed." A managed library can still use `Unsafe` internally for speed, so run step 1 against its source too, but a bug in it tends to end in an exception rather than a heap overflow.
- **Move it out of process.** A decoder running in a separate, low-privilege worker process can crash or be corrupted without corrupting the service's memory.
- **Narrow what reaches it.** Check sizes, formats, and dimensions in managed code before the bytes cross the boundary. The roadmap guide calls this wrapping, and asks that the wrapper "ensure all inputs cannot exceed memory bounds" in the code behind it.
- **Keep it and track it.** Some native code has no managed replacement. It goes in the software bill of materials, and the team watches its advisories. The Bad Practices document asks for an SBOM anyway.

The result of those four steps is the roadmap. For most .NET products it's short: a list of native components, the input each one sees, and a decision for each. That short document is still a better answer to the guidance than pointing at C# on a list.

## What to Check This Week

Four checks show how much native surface your service carries, and each one produces a line of the roadmap:

- Run the `git grep` from step 1 and count the hits without a reason next to them
- Run the native-asset script against your largest service and read the list, looking for anything you didn't know you shipped
- For each native library on that list, find out whether uploaded files or network input can reach it
- Find how many days a .NET runtime security update takes to reach production, and write that number down
