---
title: "Performance Optimization"
layout: guide
category: "WinUI 3"
subcategory: "Quality & Testing"
description: "Optimizing WinUI 3 application performance through UI virtualization, deferred loading, compiled bindings, resource dictionary management, and profiling tools."
tags: [winui, winui-3, performance, virtualization, profiling, optimization, desktop, advanced]
---

## Table of Contents

- [UI Virtualization in ListView and GridView](#ui-virtualization-in-listview-and-gridview)
- [Compiled Bindings with x:Bind](#compiled-bindings-with-xbind)
- [Deferred Element Creation with x:Load and x:DeferLoadStrategy](#deferred-element-creation-with-xload-and-xdeferloadstrategy)
- [ResourceDictionary Lookup Depth](#resourcedictionary-lookup-depth)
- [ItemsRepeater with Custom Layouts](#itemsrepeater-with-custom-layouts)
- [Async Data Loading Patterns](#async-data-loading-patterns)
- [Image Optimization](#image-optimization)
- [Profiling with Windows Performance Analyzer and Visual Studio](#profiling-with-windows-performance-analyzer-and-visual-studio)
- [Common Performance Pitfalls](#common-performance-pitfalls)

---

## UI Virtualization in ListView and GridView

Both `ListView` and `GridView` virtualize their item containers by default. Virtualization means the control only creates the visual elements for items currently visible in the viewport, plus a small buffer above and below. As the user scrolls, containers scroll out of view and are recycled for incoming items rather than destroyed and recreated. A list with 10,000 items might only maintain 30 to 40 live containers in memory at any given time.

This behavior comes from the `ItemsVirtualizingStackPanel` that serves as the default items panel for both controls. You generally do not need to configure it manually; it is active as long as you do not replace it with a non-virtualizing panel.

Container recycling is the mechanism that makes scrolling smooth. When an item scrolls out of view, its container is placed into a reuse queue. When a new item scrolls in, the binding system updates the recycled container's data context to the new item and the bindings refresh. This makes the per-scroll cost proportional to the visible viewport size rather than the total item count.

Several patterns break virtualization and should be avoided:

- Wrapping a `ListView` inside a `ScrollViewer`. The outer `ScrollViewer` takes ownership of scrolling, and the `ListView` can no longer virtualize because it must render all items to report its total height.
- Setting the `ListView` height to `Auto` inside a `StackPanel`. The `StackPanel` grants its children unlimited height, so the `ListView` measures all items at once and renders them all.
- Replacing the items panel with `WrapPanel` or `StackPanel` via `ItemsPanel`. These panels do not implement virtualization.

The correct pattern when you need a `ListView` inside a scrollable region is to give the `ListView` a fixed height or place it in a `Grid` row with `*` sizing so the grid constrains its height and the `ListView` handles its own scrolling internally.

---

## Compiled Bindings with x:Bind

The classic `{Binding}` markup extension resolves property paths at runtime using reflection. Each property access traverses the path string, calls into the reflection API, and extracts the value. This overhead is small for a handful of bindings but accumulates noticeably when a `DataTemplate` with many bindings is instantiated hundreds of times inside a list.

`{x:Bind}` generates strongly-typed C# code at compile time. The generated code calls properties directly, bypassing reflection entirely. The performance difference is most visible in collection scenarios where many item containers are created or recycled in rapid succession.

```xml
<!-- {Binding}: resolved at runtime via reflection -->
<TextBlock Text="{Binding ProductName}" />

<!-- {x:Bind}: resolved at compile time as a direct property call -->
<TextBlock Text="{x:Bind ProductName}" />
```

Inside a `DataTemplate`, you must declare the item type with `x:DataType` for `{x:Bind}` to generate the correct code:

```xml
<DataTemplate x:DataType="local:Product">
    <Grid ColumnDefinitions="*,Auto" Padding="8">
        <TextBlock Text="{x:Bind Name}" />
        <TextBlock Grid.Column="1" Text="{x:Bind Price}" />
    </Grid>
</DataTemplate>
```

One important default to remember: `{x:Bind}` defaults to `OneTime` mode, not `OneWay`. If a property changes after the initial binding evaluation and you expect the UI to update, you must add `Mode=OneWay` explicitly. Forgetting this causes the control to show stale data with no error or warning.

`{x:Bind}` also supports binding to methods and functions directly in XAML, which lets you avoid creating converter classes for simple transformations:

```xml
<!-- Bind directly to a method on the page or view model -->
<TextBlock Text="{x:Bind FormatPrice(ViewModel.Price), Mode=OneWay}" />
```

```csharp
private string FormatPrice(decimal price) => $"{price:C2}";
```

This function binding capability works well for light formatting logic but should not be used for expensive computations, since the function will be called every time the binding evaluates.

---

## Deferred Element Creation with x:Load and x:DeferLoadStrategy

Complex pages often contain UI regions that are not visible when the page first loads, such as expanded sections, error panels, or secondary content that appears after a user action. Creating all of those elements at page construction time adds to startup cost even though most users may never trigger them.

`x:Load` lets you control when an element and its subtree are created and attached to the visual tree. Setting `x:Load="False"` on an element prevents it from being realized until you set it to `True` from code.

```xml
<!-- Not created until needed -->
<StackPanel x:Name="ErrorPanel" x:Load="False">
    <TextBlock Text="An error occurred." Style="{ThemeResource BodyStrongTextBlockStyle}" />
    <TextBlock x:Name="ErrorDetail" />
</StackPanel>
```

```csharp
// Trigger creation and attachment when an error occurs
ErrorPanel.Visibility = Visibility.Visible; // This alone won't work if x:Load is false
// Instead, bind x:Load to a property or use FindName after setting x:Load programmatically
```

The cleaner pattern is to bind `x:Load` to a view model property:

```xml
<StackPanel x:Name="ErrorPanel" x:Load="{x:Bind ViewModel.HasError, Mode=OneWay}">
    <TextBlock Text="{x:Bind ViewModel.ErrorMessage, Mode=OneWay}" />
</StackPanel>
```

When `HasError` transitions from `false` to `true`, the element subtree is created and inserted into the visual tree. When it transitions back to `false`, the subtree is destroyed and memory is released. This is more aggressive than `Visibility.Collapsed`, which hides the element but keeps it in memory and still participates in layout measurement.

`x:DeferLoadStrategy="Lazy"` is an older alternative that defers creation until the element is first accessed via `FindName`. It keeps the element placeholder in the tree but does not realize the full subtree. `x:Load` is the preferred approach for most cases since it was designed to supersede the earlier strategy and gives more explicit control.

Use deferred loading for secondary panels, flyout contents, settings sections, and any UI branch that a significant portion of users will never see during a typical session.

---

## ResourceDictionary Lookup Depth

When WinUI 3 resolves a `{StaticResource}` or `{ThemeResource}` key, it walks a lookup chain starting from the current element's local resources, then the parent's resources, then the page resources, then the app resources, and finally the system theme dictionaries. Each step in the chain that must be searched adds to the resolution cost.

This lookup happens once per resource reference at page or control construction time for `{StaticResource}`, making the cost a startup concern rather than an ongoing one. For `{ThemeResource}`, the lookup repeats when the theme changes, so deeply nested theme resources carry a slightly higher switching cost.

The practical guidance is to keep frequently used resources as close to the point of use as possible when you have many resource dictionaries. Splitting resources into separate `ResourceDictionary` files and merging them with `MergedDictionaries` is good for organization, but very deep merge chains can slow initial dictionary loading. Flat or shallow merge structures load faster than deep chains.

Avoid defining the same key in multiple dictionaries at different levels. Shadowing keys across levels makes behavior hard to predict and forces the lookup to walk farther before finding the right definition. Defining style overrides at the application level rather than at the page level also reduces the chance of duplicate keys.

For resources used in hot paths like item templates that repeat hundreds of times, prefer `{StaticResource}` over `{ThemeResource}` when theme-awareness is not needed. `{StaticResource}` is resolved once; `{ThemeResource}` registers for theme change notifications on every control instance.

---

## ItemsRepeater with Custom Layouts

`ItemsRepeater` is a lower-level alternative to `ListView` and `GridView` that provides virtualization without the overhead of selection, headers, footers, and interactive container behaviors. It is the right choice when you need highly customized item arrangements or when you want full control over layout without fighting the opinionated structure of the standard list controls.

`ItemsRepeater` virtualizes by default through its `Layout` property. The built-in `StackLayout` and `UniformGridLayout` both support virtualization. Custom layout implementations can also participate in virtualization by implementing `VirtualizingLayout` instead of the simpler `NonVirtualizingLayout`.

```xml
<ScrollViewer>
    <ItemsRepeater ItemsSource="{x:Bind ViewModel.Items, Mode=OneWay}">
        <ItemsRepeater.Layout>
            <UniformGridLayout MinItemWidth="200" MinItemHeight="150"
                               ItemsStretch="Fill" />
        </ItemsRepeater.Layout>
        <ItemsRepeater.ItemTemplate>
            <DataTemplate x:DataType="local:TileItem">
                <Border CornerRadius="8" Background="{ThemeResource CardBackgroundFillColorDefaultBrush}">
                    <TextBlock Text="{x:Bind Title}" Margin="12" />
                </Border>
            </DataTemplate>
        </ItemsRepeater.ItemTemplate>
    </ItemsRepeater>
</ScrollViewer>
```

Note that `ItemsRepeater` does not include its own scroll surface. You must wrap it in a `ScrollViewer` and avoid placing that `ScrollViewer` inside another scrollable container for the same reasons described in the virtualization section above.

Because `ItemsRepeater` does not manage selection, you add interaction handling yourself through pointer events or by tracking selection state in the view model. This is more work than using `ListView`, but it gives you a lighter control that renders exactly what you need without the layout and event plumbing you may not need.

---

## Async Data Loading Patterns

Blocking the UI thread while loading data produces a frozen interface. WinUI 3 runs all UI operations on the main thread, so any synchronous work that takes more than a few milliseconds delays rendering, input processing, and animations.

The right approach is to return from page navigation handlers immediately and load data asynchronously, updating the UI once the data arrives. The `Loaded` event or an override of `OnNavigatedTo` are common entry points:

```csharp
protected override async void OnNavigatedTo(NavigationEventArgs e)
{
    base.OnNavigatedTo(e);
    ViewModel.IsLoading = true;
    try
    {
        await ViewModel.LoadDataAsync();
    }
    finally
    {
        ViewModel.IsLoading = false;
    }
}
```

Show a loading indicator bound to `IsLoading` so the user sees feedback during the wait. `ProgressRing` with `IsActive="{x:Bind ViewModel.IsLoading, Mode=OneWay}"` is the standard WinUI 3 pattern for this.

When loading large datasets, consider loading a small initial batch immediately and loading additional pages on demand as the user scrolls. `ISupportIncrementalLoading` is the interface that `ListView` and `GridView` recognize for triggering automatic incremental loads as the user approaches the end of the list:

```csharp
public class IncrementalProductCollection : ObservableCollection<Product>,
    ISupportIncrementalLoading
{
    private int _pageIndex = 0;
    public bool HasMoreItems { get; private set; } = true;

    public IAsyncOperation<LoadMoreItemsResult> LoadMoreItemsAsync(uint count)
    {
        return AsyncInfo.Run(async token =>
        {
            var items = await FetchPageAsync(_pageIndex++, (int)count);
            foreach (var item in items)
                Add(item);
            if (items.Count < count)
                HasMoreItems = false;
            return new LoadMoreItemsResult { Count = (uint)items.Count };
        });
    }
}
```

Avoid running expensive computations on the UI thread after data arrives. If you need to sort or filter a large collection, do that work on a background thread and then marshal only the final result back to the UI thread via `DispatcherQueue.TryEnqueue`.

---

## Image Optimization

Images are among the most common sources of unnecessary memory consumption in WinUI 3 applications, and the problem is easy to overlook. Displaying an image at 48x48 pixels when the source file is 1200x900 causes WinUI 3 to decode the full 1200x900 bitmap into memory, then scale it down during rendering. That decoded bitmap consumes roughly 4 MB of memory for a thumbnail that could have been decoded at 48x48 for about 9 KB.

`DecodePixelWidth` and `DecodePixelHeight` on `BitmapImage` instruct the image subsystem to decode the image at the specified dimensions, dramatically reducing memory usage when displaying thumbnails or small previews:

```xml
<Image Width="48" Height="48">
    <Image.Source>
        <BitmapImage UriSource="{x:Bind ThumbnailUrl}"
                     DecodePixelWidth="48"
                     DecodePixelHeight="48"
                     DecodePixelType="Logical" />
    </Image.Source>
</Image>
```

`DecodePixelType="Logical"` specifies that the dimensions are in logical pixels, which accounts for display scaling automatically. Use `Physical` if you want to specify exact physical pixels, though `Logical` is the safer default for apps that need to run correctly on high-DPI displays.

In `DataTemplate` scenarios where the display dimensions are fixed, always set decode dimensions to match the display size. In virtualized lists, every item container that displays a full-resolution thumbnail holds an unnecessarily large decoded bitmap in memory, and with hundreds of containers cycling through the reuse queue the cumulative impact is significant.

For images loaded from the network, caching matters. The `BitmapImage` class does not cache by default across control recycling. If your list contains remote images and containers are recycled frequently, the same image URL may be fetched and decoded multiple times. Introducing a simple in-memory cache keyed by URL, or using an image loading library that handles caching, eliminates redundant network requests and decode operations.

---

## Profiling with Windows Performance Analyzer and Visual Studio

Profiling should drive optimization decisions. Guessing at bottlenecks without measurement leads to optimizing the wrong things while actual problems remain.

[Windows Performance Analyzer](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-analyzer){:target="_blank" rel="noopener noreferrer"} (WPA) is part of the Windows Performance Toolkit and provides deep insight into CPU usage, GPU activity, memory allocations, and disk I/O across the entire system. To profile a WinUI 3 application with WPA, you record a trace with the [Windows Performance Recorder](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-recorder){:target="_blank" rel="noopener noreferrer"} (WPR) while exercising the performance scenario, then open the trace file in WPA for analysis. The CPU Usage (Sampled) graph shows where processor time is spent, while the GPU Hardware Queue graph reveals rendering bottlenecks.

Visual Studio's built-in [Performance Profiler](https://learn.microsoft.com/en-us/visualstudio/profiling/profiling-feature-tour){:target="_blank" rel="noopener noreferrer"} is more accessible for everyday profiling during development. The CPU Usage tool shows a flame graph of call stacks, making it straightforward to identify which methods consume the most time. The .NET Object Allocation Tracking tool records heap allocations with their call stacks, which helps find code paths that allocate frequently in hot loops or event handlers.

For diagnosing UI rendering issues specifically, the XAML frame rate counter provides a lightweight first signal. You can enable it in debug builds by setting `DebugSettings.EnableFrameRateCounter = true` in your `App.xaml.cs`. The overlay shows the current frame rate and helps confirm whether a reported "slow" experience corresponds to a rendering bottleneck or to a data loading delay.

When investigating list scrolling performance, look for:

- Synchronous work on the UI thread during item container preparation (the `ContainerContentChanging` event)
- Converters that perform expensive computations on every evaluation
- Images loading synchronously on the UI thread instead of asynchronously
- Layout passes that force measure and arrange on every frame

Profiling frame time during a scroll scenario gives you concrete numbers. A smooth scroll at 60 fps requires each frame to complete within roughly 16 ms. If a frame consistently takes 30 ms or more, the profiler's call tree will point to the method consuming that time.

---

## Common Performance Pitfalls

**Nesting ScrollViewers**: Placing a `ListView` or `GridView` inside a `ScrollViewer` disables virtualization. The outer scroll container measures all items at once, defeating the purpose of having a virtualizing panel. Use a single scroll surface and let the list control manage it.

**Using ObservableCollection for batch updates**: `ObservableCollection<T>` raises a `CollectionChanged` event for every individual `Add` or `Remove` operation. Adding 500 items in a loop fires 500 events, triggering 500 layout passes. For bulk updates, clear the collection and re-add in a single operation, or use a `List<T>` as the backing store and replace the entire collection reference at once.

**Synchronous image decoding**: Loading a `BitmapImage` from a stream on the UI thread blocks rendering during decode. Use `SetSourceAsync` instead of `SetSource` to decode asynchronously.

**Subscribing to events without unsubscribing**: Attaching to `PropertyChanged` or `CollectionChanged` without unsubscribing when the subscribing object is disposed creates memory leaks. The publisher holds a reference to the subscriber, preventing garbage collection. Use weak event patterns or ensure `Dispose` methods clean up subscriptions explicitly.

**Deep visual trees in item templates**: Each additional layer of nesting in a `DataTemplate` adds layout overhead that multiplies across hundreds of item containers. Prefer shallow templates with `Grid` layouts over deeply nested `StackPanel` hierarchies.

**Creating brushes and transforms in code on every frame**: Allocating new `SolidColorBrush` or `TranslateTransform` objects inside event handlers that fire repeatedly creates GC pressure. Cache these objects as fields or static resources and mutate their properties rather than replacing them.

**Unthrottled search or filter bindings**: Binding a filter expression to a `TextBox` with `UpdateSourceTrigger=PropertyChanged` and refiltering a large collection on every keystroke can produce noticeable lag. Introduce a small debounce delay, such as 200 ms, so the filter operation runs only when the user pauses typing rather than on every character.

These pitfalls share a common thread: they impose costs that scale with collection size, frame count, or user interaction frequency. Catching them during development with the profiler is far cheaper than diagnosing them in a shipped application.
