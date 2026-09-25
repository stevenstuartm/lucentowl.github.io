---
title: "Performance Optimization"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Finding and fixing WinUI 3 performance problems: how a frame spends its time, measuring with the XAML Frame Analysis plugin and other profilers, startup cost, ReadyToRun and Native AOT, element count, layout structure, overdraw, resource placement, UI-thread work, and memory growth."
tags: [performance, profiling, startup-performance, x-load, native-aot, windows-performance-analyzer, advanced]
---

## Where a WinUI App Spends Its Time

WinUI is a retained-mode framework. The app describes a tree of elements, and WinUI lays it out and renders it on the UI thread in batches called **frames**. A frame should finish within one refresh interval of the display, about 16.7 ms at 60 Hz. When one runs long, the screen stops updating, and the UI thread can't handle input either, because layout, rendering, input, and the app's own event handlers all take turns on that one thread.

That single fact explains most WinUI performance problems. A frame is slow because the thread is doing too much of one of four things:

- **Creating elements**, when XAML loads a page or a template is applied. Element count drives this cost.
- **Running layout**, the measure and arrange passes over the tree. The depth and repetition of the tree drive this cost.
- **Rendering**, which grows with the number of pixels drawn, including pixels drawn more than once.
- **Running app code** in event handlers, converters, and property-changed callbacks.

A separate render thread applies some changes, including many animations that don't affect layout, without waiting for the UI thread. That's why an animation of opacity or a transform can stay smooth while the UI thread is busy, and why an animation that changes `Width` can't.

---

## Measure Before Changing Anything

Microsoft's workflow starts with a baseline. Pick the scenarios users repeat, such as launch, navigation between pages, and scrolling the main list, and measure a **Release** build on hardware like your users'. Record cold startup (first launch after a reboot) and warm startup separately, and time startup to when the app becomes usefully interactive, not to when its window first appears. After each change, rerun the same scenarios under the same conditions, and watch memory and CPU alongside time, since a fix in one can cost in another.

| Tool | Answers |
| --- | --- |
| Visual Studio Performance Profiler | Which methods use the CPU (CPU Usage) and which code paths allocate (.NET Object Allocation Tracking) |
| Windows Performance Recorder and Analyzer (WPR/WPA) | What the whole system did during a trace, including every WinUI frame and layout pass |
| PerfView | .NET-specific CPU, allocation, and garbage-collection analysis |
| Visual Studio Live Visual Tree | How many elements each part of the tree holds |
| `Application.DebugSettings` | On-screen frame-rate and per-frame CPU counters (`EnableFrameRateCounter`) and an overdraw heat map (`IsOverdrawHeatMapEnabled`) |

### Finding Slow Frames with WPA

WinUI logs an ETW (Event Tracing for Windows) event at the start and end of every frame, and WPA can turn those into durations. Record a trace in WPR with the **CPU usage** and **XAML activity** profiles selected, then open it in WPA from the Windows ADK 10.1.26100.1 or later, which includes the **XAML Frame Analysis** table. It's off by default. Close WPA, add `perf_xaml.dll` to the list of DLLs in `perfcore.ini` in the Windows Performance Toolkit folder, and restart WPA.

The table has two views. **Interesting Xaml Frames** shows the frames most likely to hurt responsiveness: regions that start with WinUI initialization, a frame navigation, or a flyout opening, and end with the next frame, because those change the element tree the most. **All Xaml Info** shows every frame and layout pass. Sort by duration, find the longest frames, and drill into the CPU samples inside them to see which code ran.

Set `DebugSettings` properties from `OnLaunched` while investigating, and don't ship them. The frame-rate counter appears even without a debugger attached.

---

## Startup

Startup runs through a fixed sequence, and each stage can be made cheaper:

1. The process starts, and generated code calls `Main`.
2. The `App` constructor calls `InitializeComponent`, which parses `App.xaml` and creates its resources.
3. `OnLaunched` creates the main window, sets its content, and calls `Activate`.
4. The first page's constructor parses its XAML and creates its elements.
5. The layout pass runs. Applying control templates is usually most of this stage.
6. The first frame renders and appears.

### Show a Light Window, Then Load

The first goal is getting something interactive on screen. Keep the `App` constructor and `OnLaunched` to what the first frame needs: create the window, give it lightweight content, activate it, and start the rest asynchronously. If data takes a while, show a loading page, or show the parts of the UI that don't need the data and fill in the rest as it arrives. A loading indicator is feedback, not a finished startup, so measure to the point the user can act.

.NET loads an assembly the first time code that uses it runs. Startup code that references a feature's types, even on a branch that rarely runs, can pull that feature's assemblies into cold startup. Move the rarely taken branch into a separate method, so the startup method itself no longer references those types.

### Fewer Elements at Startup

Microsoft's rough benchmark is about **1 ms per element** created during startup, so element count is the main lever. Two common techniques don't reduce it. `Visibility="Collapsed"` skips an element when rendering but still creates it and its children in memory, and `Opacity="0"` doesn't prevent creation either. `x:Load="False"` does reduce it: the element isn't created until something loads it, at a cost of about 600 bytes for the placeholder.

```xml
<!-- Created only when the error first appears -->
<StackPanel x:Name="ErrorPanel" x:Load="{x:Bind ViewModel.HasError, Mode=OneWay}">
    <TextBlock Text="{x:Bind ViewModel.ErrorMessage, Mode=OneWay}" />
</StackPanel>
```

Setting the bound value to `true` creates the subtree, and setting it back to `false` unloads it. `FindName("ErrorPanel")` also loads an element, but only under a `Page` or `UserControl` root. In WinUI 3 it doesn't work when the XAML root is a `Window`, so markup in `MainWindow.xaml` uses the `x:Bind` form. Unloading discards the element's state, so anything it showed has to come from bindings or be reapplied in its `Loaded` handler, and the object stays in memory until the app's own references to it are released. Microsoft recommends `x:Load` over the older `x:DeferLoadStrategy` in Windows App SDK apps. Use it for UI that many sessions never show: secondary tabs, alternate views, error panels, and settings sections. For a handful of elements the placeholder can cost more than it saves, so measure.

### Ahead-of-Time Compilation

A .NET app normally compiles its code to machine code as it runs, which adds to cold startup. WinUI's project templates set `PublishReadyToRun` for Release publishing, which precompiles most of the code while keeping the JIT for the rest. It isn't free. ReadyToRun assemblies grow to two or three times their size, and an app with little code of its own gains little, since the .NET runtime libraries are already precompiled. **Native AOT**, supported since Windows App SDK 1.6 as an opt-in (`PublishAot`), compiles the whole app ahead of time and removes the JIT. Microsoft measured a 50% reduction in start time and a roughly 8x smaller package on its Contoso Camera sample, when the app uses the shared Windows App SDK runtime package rather than bundling it, and says results vary by app.

Native AOT builds on trimming, which removes code the app doesn't appear to use. Code reached only through reflection looks unused, so the trimmer removes it unless it's annotated or rewritten, and every dependency, including NuGet packages and serializers, has to be trim- and AOT-compatible too. WinUI adds two requirements of its own. Classes that implement WinRT interfaces need to be `partial`, so CsWinRT (the C# projection of the Windows Runtime) can generate their interop code at build time, and types used as `{Binding}` sources need to be `partial` too, marked with `[WinRT.GeneratedBindableCustomProperty]`. The trim and AOT analyzer warnings at build time are the list of what to fix, and the published build, not the debug run, is the one to test.

---

## Element Count and Layout Structure

Panels are structural, not pixel-producing. Every nested `StackPanel` or `Grid` adds measure and arrange work without drawing anything, so the biggest layout gains come from flattening the tree. A trivial saving, one panel on a page, doesn't show up in measurements. The saving that matters is in **repeated** structure: a `DataTemplate` instantiated for every item in a list multiplies every panel it contains.

| Instead of | Use | Why |
| --- | --- | --- |
| An outer `StackPanel` of horizontal `StackPanel`s, one per form row | One `Grid` (or `RelativePanel`) with rows | One panel instead of several for the same pixels |
| A `Border` wrapped around a `Grid`, `StackPanel`, `RelativePanel`, or `ContentPresenter` | Its own `BorderBrush`, `BorderThickness`, `CornerRadius`, and `Padding` | One element instead of two |
| A `Rectangle` behind a panel to color it | The panel's `Background` | One element instead of two |
| Nested panels to overlap elements | A single-cell `Grid`, with no row or column definitions | WinUI optimizes overlap in a single-cell `Grid` |
| `LayoutUpdated` to react to a size change | `SizeChanged` | `LayoutUpdated` fires on every element whenever any element's layout changes |
| Many copies of the same vector shape | An `Image` of it | An image decodes once, while each vector element is built separately |

Choosing between `Grid`, `StackPanel`, and `RelativePanel` for their own sake isn't a performance decision. Microsoft says every panel performs similarly for similar UI. Choose by layout behavior, then reduce how many of them there are.

Lists deserve the same attention to their templates, but list-specific tuning belongs to the controls themselves. A `ListView` or `GridView` virtualizes only when its height is constrained, so one inside a vertical `StackPanel` or an `Auto` grid row creates every item. `x:Phase` staggers the parts of an item template across frames, but only with `{x:Bind}` inside `ListView` and `GridView`. Compiled `{x:Bind}` bindings avoid the reflection cost of `{Binding}` in templates that repeat. Images decode at their displayed size automatically except in a few cases, such as setting the source before the `BitmapImage` joins the tree or using `Stretch="None"`.

---

## Overdraw

**Overdraw** is drawing the same pixel more than once. A panel colored blue behind an item template that is also blue fills those pixels twice, and a semi-transparent rectangle blended over a background fills its area once for each layer. `DebugSettings.IsOverdrawHeatMapEnabled` tints the window by how many times each pixel is drawn, which often reveals elements nobody knew were there.

- **Delete what can't be seen.** An element that's fully transparent or hidden behind others, and that doesn't contribute to layout, only costs.
- **Paint each area once.** When a list already has a background, its item templates don't need the same one. A panel that must still receive pointer input without painting gets `Background="Transparent"`.
- **Prefer one shape to layers.** A single opaque gray rectangle beats white at 50% opacity over black, which fills 150% of the pixels for the same result.
- **Cache static composites.** `CacheMode="BitmapCache"` renders a group of overlapping, non-animated shapes to a bitmap once and reuses it every frame. Don't use it on anything that animates, since the cache then regenerates every frame.

Fewer elements and less overdraw can pull in opposite directions, such as two rectangles versus one blended layer, so the heat map and the frame times settle it.

---

## Resources and Startup Cost

`ResourceDictionary` creates a resource only when something asks for it, but four patterns defeat that:

- **`x:Name` on a resource** creates it immediately, because the generated code needs a field to hold it. Reference resources with `x:Key`.
- **A `ResourceDictionary` inside a `UserControl`** is copied for every instance of the control. Move it to the page or app when the control is used often.
- **`App.xaml` is parsed at startup.** A resource used by only one page, other than the first page, belongs in that page's resources. And merging a large dictionary into the first page to use one resource from it parses the whole file.
- **Identical brushes declared inline** are separate objects, since WinUI can't tell that two inline brushes (or `"Orange"` and `"#FFFFA500"`) are the same. Define a shared brush once as a resource.

Windows App SDK compiles XAML to a binary form at build time, which removes text parsing at run time. Keep the normal build steps that produce it.

---

## Keeping the UI Thread Free

Every millisecond an event handler holds the UI thread is a millisecond with no layout, rendering, or input. In a profile, the usual culprit is synchronous work inside an `async` handler: the code before the first genuinely asynchronous `await` runs on the UI thread, as does any CPU-bound work the handler does itself, so parsing, sorting, and image processing belong on a background thread with only the result handed back.

Code that runs as part of binding and layout sits on the same thread. A value converter or a dependency property's change callback runs on the thread that owns the element, and inside a list template it runs for every item that's realized, so a converter doing I/O or heavy computation pays that cost per item as the list scrolls. Precompute the value on the model instead. App code can also force extra layout passes: calling `UpdateLayout` repeatedly, or changing sizes from inside `SizeChanged` until layout never settles, shows up in WPA as long `UpdateLayout` rows, and `DebugSettings.LayoutCycleTracingLevel` reports layout cycles while debugging.

---

## Memory Over Time

Some costs don't show in a single measurement but grow the longer the app runs.

- **The navigation back stack has no size limit.** Each entry holds its navigation parameter, so a user navigating in a loop grows it indefinitely, and a parameter that references a large object or an open file keeps that alive too. Pass small values such as ids, and trim `Frame.BackStack` when it grows.
- **Page caching trades memory for speed.** A cached page (`NavigationCacheMode`) skips being rebuilt on return, and every cached page stays in the process's working set, the memory it holds resident.
- **Event subscriptions keep subscribers alive.** A page that subscribes to an event on a long-lived object, such as an app-wide service or a view model shared across pages, stays in memory as long as that object does, unless it unsubscribes when it unloads. Comparing two snapshots in Visual Studio's Memory Usage tool, before and after a navigation that should release a page, shows what survived.
