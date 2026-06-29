---
title: "Windows Community Toolkit"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Extending WinUI 3 applications with the Windows Community Toolkit including additional controls, XAML behaviors, animation helpers, and utility extensions."
tags: [winui, winui-3, community-toolkit, controls, animations, behaviors, desktop, practical]
---

## Table of Contents

- [What the Toolkit Is](#what-the-toolkit-is)
- [Package Structure and Installation](#package-structure-and-installation)
- [Additional Controls](#additional-controls)
- [Layout Controls](#layout-controls)
- [XAML Behaviors](#xaml-behaviors)
- [Animation Helpers](#animation-helpers)
- [Lottie Animations](#lottie-animations)
- [Helpers and Extensions](#helpers-and-extensions)
- [Relationship to the MVVM Toolkit](#relationship-to-the-mvvm-toolkit)
- [Deciding Which Packages to Adopt](#deciding-which-packages-to-adopt)

---

## What the Toolkit Is

WinUI 3 ships with a solid set of controls, but real applications frequently reach for patterns and components that do not exist in the base library. Settings pages need organized card layouts. Complex UIs need layout panels that wrap and dock. Animations need to trigger declaratively without code-behind ceremony. The [Windows Community Toolkit](https://github.com/CommunityToolkit/Windows){:target="_blank" rel="noopener noreferrer"} fills these gaps with a collection of controls, behaviors, animations, and utilities that extend WinUI 3 without replacing it.

The toolkit is a community project maintained under the .NET Foundation with strong Microsoft involvement. Its controls follow the same design language as WinUI 3, meaning they respect your application's theme, respond to accent color changes, and compose naturally with other WinUI controls. Nothing in the toolkit requires you to restructure your project or adopt a particular architecture; you install only what you need and ignore the rest.

The [community toolkit documentation](https://learn.microsoft.com/en-us/windows/communitytoolkit/){:target="_blank" rel="noopener noreferrer"} covers the full API surface, and the [toolkit sample app](https://apps.microsoft.com/detail/9nblggh4tlcq){:target="_blank" rel="noopener noreferrer"} available from the Microsoft Store demonstrates every component interactively, which makes it much easier to evaluate controls before adopting them.

---

## Package Structure and Installation

The toolkit ships as a set of independent NuGet packages under the `CommunityToolkit.WinUI.*` namespace. The modular structure means you do not pull in animations code if you only want the settings controls, and you do not take on layout utilities if you only need behaviors.

The main packages covering common needs include:

- `CommunityToolkit.WinUI.Controls.SettingsControls` for the settings card and expander
- `CommunityToolkit.WinUI.Controls.Segmented` for the segmented control
- `CommunityToolkit.WinUI.Controls.HeaderedContentControl` for labeled content containers
- `CommunityToolkit.WinUI.Controls.Layout` for wrap panel, dock panel, and uniform grid
- `CommunityToolkit.WinUI.Animations` for the animation builder and composition helpers
- `CommunityToolkit.WinUI.Behaviors` for XAML interaction behaviors
- `CommunityToolkit.WinUI.Extensions` for dispatcher queue, visual tree, string, and color helpers

To add a package, install it via NuGet:

```xml
<PackageReference Include="CommunityToolkit.WinUI.Controls.SettingsControls" Version="8.*" />
```

After installing controls packages, add the toolkit XML namespace to your XAML files:

```xml
xmlns:ctk="using:CommunityToolkit.WinUI.Controls"
```

The namespace alias `ctk` is conventional but arbitrary. If your project uses multiple toolkit namespaces, you can use distinct aliases like `ctkAnimations` or `ctkBehaviors` to distinguish them at the use site.

---

## Additional Controls

### Settings Controls

The `SettingsCard` and `SettingsExpander` controls address one of the most common patterns in Windows desktop applications: a settings page where options are presented in labeled cards that follow the Fluent Design style used by Windows itself and apps like Windows Settings.

`SettingsCard` is a single-line item with a header, optional description, optional icon, and a content area on the right side for controls like toggles, dropdowns, or buttons:

```xml
<ctk:SettingsCard
    Header="Dark Mode"
    Description="Use dark theme across the application"
    HeaderIcon="{ui:FontIcon Glyph=&#xE793;}">
    <ToggleSwitch IsOn="{x:Bind ViewModel.IsDarkModeEnabled, Mode=TwoWay}" />
</ctk:SettingsCard>
```

`SettingsExpander` wraps a header card that can collapse and expand to reveal a list of nested `SettingsCard` items. This pattern works well for grouping related settings that share a parent concept without cluttering the page when users do not need them:

```xml
<ctk:SettingsExpander
    Header="Notifications"
    Description="Configure how the application notifies you"
    HeaderIcon="{ui:FontIcon Glyph=&#xEA8F;}">
    <ctk:SettingsExpander.Items>
        <ctk:SettingsCard Header="Show toast notifications">
            <ToggleSwitch IsOn="{x:Bind ViewModel.ToastsEnabled, Mode=TwoWay}" />
        </ctk:SettingsCard>
        <ctk:SettingsCard Header="Play notification sounds">
            <ToggleSwitch IsOn="{x:Bind ViewModel.SoundsEnabled, Mode=TwoWay}" />
        </ctk:SettingsCard>
    </ctk:SettingsExpander.Items>
</ctk:SettingsExpander>
```

These controls save significant time over building equivalent layouts from `Grid` and `Border` by hand, and they stay visually consistent with Windows 11 system applications.

### Segmented Control

`Segmented` provides a horizontal set of mutually exclusive options that behaves similarly to a `RadioButtons` group but renders as a connected pill-style button bar. It suits view mode switching, filter selection, and any scenario where the user picks one option from a small set and the current selection needs to be visually prominent:

```xml
<ctk:Segmented SelectedIndex="0">
    <ctk:SegmentedItem Content="Grid" />
    <ctk:SegmentedItem Content="List" />
    <ctk:SegmentedItem Content="Details" />
</ctk:Segmented>
```

### HeaderedContentControl

`HeaderedContentControl` adds a header label above or beside arbitrary content. This sounds simple, but it appears constantly in form layouts where inputs need consistent labeling without rewriting the same `StackPanel` with a `TextBlock` heading every time:

```xml
<ctk:HeaderedContentControl Header="Display Name">
    <TextBox Text="{x:Bind ViewModel.DisplayName, Mode=TwoWay}" />
</ctk:HeaderedContentControl>
```

---

## Layout Controls

The `CommunityToolkit.WinUI.Controls.Layout` package provides three layout panels that WinUI 3 does not include natively.

`WrapPanel` arranges children horizontally and wraps to a new line when the available width is exhausted. This is the natural choice for tag displays, icon grids, or any collection of variable-width items that need to reflow when the window resizes:

```xml
<ctk:WrapPanel Orientation="Horizontal" HorizontalSpacing="8" VerticalSpacing="8">
    <Button Content="Tag One" />
    <Button Content="Another Tag" />
    <Button Content="Third" />
</ctk:WrapPanel>
```

`DockPanel` lets children declare which edge of the panel they fill using an attached property, with one child filling the remaining space. This replicates the layout idiom familiar from WPF and Windows Forms without needing nested `Grid` definitions:

```xml
<ctk:DockPanel>
    <Button ctk:DockPanel.Dock="Left" Content="Sidebar" Width="200" />
    <Button ctk:DockPanel.Dock="Bottom" Content="Status Bar" Height="32" />
    <ContentPresenter /> <!-- fills remaining space -->
</ctk:DockPanel>
```

`UniformGrid` distributes children into a grid where every cell has the same width and height. It is useful for dashboards, tile layouts, and any scenario where equal sizing matters more than explicit row and column definitions.

---

## XAML Behaviors

XAML behaviors, provided through the [Microsoft.Xaml.Behaviors.WinUI.Managed](https://www.nuget.org/packages/Microsoft.Xaml.Behaviors.WinUI.Managed){:target="_blank" rel="noopener noreferrer"} package, allow you to attach interactive logic to XAML elements declaratively. Instead of wiring up event handlers in code-behind, you attach a behavior to a control in XAML and configure it there.

After installing the package, you reference it with two namespaces in XAML:

```xml
xmlns:i="using:Microsoft.Xaml.Interactivity"
xmlns:ia="using:Microsoft.Xaml.Interactions.Core"
```

The most common pattern is `EventTriggerBehavior` combined with `InvokeCommandAction`. This fires a ViewModel command in response to any control event without code-behind:

```xml
<TextBox>
    <i:Interaction.Behaviors>
        <i:BehaviorCollection>
            <ia:EventTriggerBehavior EventName="LostFocus">
                <ia:InvokeCommandAction Command="{x:Bind ViewModel.ValidateInputCommand}" />
            </ia:EventTriggerBehavior>
        </i:BehaviorCollection>
    </i:Interaction.Behaviors>
</TextBox>
```

`DataTriggerBehavior` watches a binding value and fires actions when it matches a condition. You can use this to invoke a command or call a method when a ViewModel property reaches a specific state:

```xml
<i:Interaction.Behaviors>
    <i:BehaviorCollection>
        <ia:DataTriggerBehavior Binding="{x:Bind ViewModel.IsComplete, Mode=OneWay}" Value="True">
            <ia:InvokeCommandAction Command="{x:Bind ViewModel.NavigateNextCommand}" />
        </ia:DataTriggerBehavior>
    </i:BehaviorCollection>
</i:Interaction.Behaviors>
```

You can also write custom behaviors by creating a class that inherits from `Behavior<T>`. The `OnAttached` method runs when the behavior is connected to its associated control, and `OnDetaching` runs when it is removed. Custom behaviors are a clean mechanism for encapsulating reusable interaction logic, such as auto-scrolling a list when new items arrive or focusing a control when a popup opens.

Behaviors work well with MVVM because they allow the View to respond to events and property changes without code-behind methods, keeping UI logic either in the ViewModel or in the behavior class itself where it is testable and reusable.

---

## Animation Helpers

The `CommunityToolkit.WinUI.Animations` package provides a fluent API called `AnimationBuilder` for constructing composition animations without directly manipulating the Windows Composition API. Composition animations are more performant than storyboard animations because they run on the compositor thread rather than the UI thread, but the raw API has significant ceremony. `AnimationBuilder` reduces that ceremony considerably.

A simple entrance animation that fades a control in while translating it upward looks like this:

```csharp
await AnimationBuilder.Create()
    .Opacity(to: 1, from: 0, duration: TimeSpan.FromMilliseconds(300))
    .Translation(axis: Axis.Y, to: 0, from: 24, duration: TimeSpan.FromMilliseconds(300))
    .StartAsync(MyControl);
```

The `StartAsync` method applies the animation to the target element and returns a task that completes when the animation finishes. You can use `Start` for fire-and-forget scenarios or `StartAsync` when subsequent operations depend on the animation completing.

`AnimationBuilder` also supports implicit animations, which trigger automatically when an element's properties change rather than being started explicitly. Attaching an implicit animation means that whenever the element's opacity or offset changes for any reason, including data binding updates, the change happens through the configured animation rather than instantly:

```csharp
AnimationBuilder.Create()
    .Opacity(duration: TimeSpan.FromMilliseconds(200))
    .Translation(duration: TimeSpan.FromMilliseconds(200))
    .AttachImplicit(MyControl);
```

For more advanced scenarios, the toolkit exposes typed wrappers around the underlying Windows Composition APIs, including helpers for `ExpressionAnimation` and `KeyFrameAnimation` that reduce boilerplate while preserving the full flexibility of the composition layer.

---

## Lottie Animations

[Lottie-Windows](https://learn.microsoft.com/en-us/windows/communitytoolkit/animations/lottie){:target="_blank" rel="noopener noreferrer"} integrates After Effects animations exported in the [Lottie JSON format](https://airbnb.io/lottie/){:target="_blank" rel="noopener noreferrer"} into WinUI 3 applications. Designers export animations from After Effects using the [Bodymovin plugin](https://aescripts.com/bodymovin/){:target="_blank" rel="noopener noreferrer"} and developers play them using `AnimatedVisualPlayer` and `LottieVisualSource`.

Install the package and reference the Lottie namespace:

```xml
xmlns:lottie="using:CommunityToolkit.WinUI.Lottie"
```

Then play a bundled animation file:

```xml
<AnimatedVisualPlayer x:Name="Player" AutoPlay="True">
    <lottie:LottieVisualSource UriSource="ms-appx:///Assets/Animations/loading.json" />
</AnimatedVisualPlayer>
```

For the best performance, Microsoft provides the [LottieGen tool](https://learn.microsoft.com/en-us/windows/communitytoolkit/animations/lottie-scenarios/getting_started_codegen){:target="_blank" rel="noopener noreferrer"} that converts Lottie JSON files into C# or C++ code at build time. The generated code runs entirely in the composition layer without any JSON parsing at runtime, eliminating startup latency for complex animations. LottieGen-generated classes implement `IAnimatedVisualSource2`, which `AnimatedVisualPlayer` accepts directly.

WinUI 3's `AnimatedIcon` control integrates Lottie animations into interactive controls like buttons and navigation items. An `AnimatedIcon` plays different segments of a Lottie animation based on the control's visual state, so a button can transition smoothly between its normal, hover, pressed, and disabled states with a single coordinated animation rather than separate assets.

Lottie is well-suited for onboarding flows, empty state illustrations, loading indicators, and any scenario where flat animation is preferable to video. The animations scale to any resolution without quality loss, respect the user's animation preference settings, and compose naturally with other WinUI controls.

---

## Helpers and Extensions

The `CommunityToolkit.WinUI.Extensions` package provides utility methods that surface frequently needed functionality without requiring you to write them from scratch.

`DispatcherQueueExtensions` adds `EnqueueAsync` to `DispatcherQueue`, making it straightforward to marshal work back to the UI thread from a background operation:

```csharp
await DispatcherQueue.EnqueueAsync(() =>
{
    StatusText = "Download complete";
    IsLoading = false;
});
```

Without this helper, the equivalent code requires creating a `TaskCompletionSource` and handling the completion callback manually, which is error-prone to write correctly.

Visual tree helpers let you traverse the element tree to find ancestors and descendants by type, which is occasionally necessary when working with control templates or third-party controls where the exact visual structure is not known at compile time:

```csharp
var scrollViewer = MyListView.FindDescendant<ScrollViewer>();
var parentPage = MyControl.FindAscendant<Page>();
```

String extensions add null-safe operations and convenience methods like `IsNullOrEmpty()` called as an instance method rather than a static call. Color helpers provide conversions between WinUI's `Color` struct and `System.Drawing.Color`, hex strings, and HSV/HSL representations, which is useful for color picker implementations and theme management.

---

## Relationship to the MVVM Toolkit

The Windows Community Toolkit and `CommunityToolkit.Mvvm` are separate packages with different purposes. The MVVM Toolkit focuses entirely on ViewModel infrastructure: source generators for observable properties and commands, a messenger for decoupled communication, and base classes like `ObservableObject`. It has no dependency on WinUI and can be used in any .NET application including console apps, ASP.NET, and MAUI.

The Windows Community Toolkit covers UI-layer concerns: controls, animations, behaviors, and UI thread utilities. It has a hard dependency on WinUI 3. The two toolkits are designed to work together and share the `CommunityToolkit` namespace prefix, but installing one does not require the other.

A typical WinUI 3 application might use `CommunityToolkit.Mvvm` for ViewModel patterns, `CommunityToolkit.WinUI.Controls.SettingsControls` for its settings page, and `CommunityToolkit.WinUI.Animations` for entrance animations, treating them as three independent dependencies that happen to share an origin and work well together.

---

## Deciding Which Packages to Adopt

The modular structure makes selective adoption straightforward. A few questions help narrow down which packages are worth adding to a project.

If your application has a settings page that needs to look consistent with Windows 11's own settings style, `CommunityToolkit.WinUI.Controls.SettingsControls` is worth installing regardless of your other choices. The controls are well-tested, actively maintained, and save a meaningful amount of layout work.

If you have designers producing After Effects animations and want them to appear in the UI without video files or GIF artifacts, Lottie-Windows handles that requirement. The LottieGen code generation path is worth taking from the start rather than treating it as an optimization to add later.

If your XAML files are accumulating event handlers in code-behind for things like responding to focus changes, scroll position triggers, or property transitions, XAML behaviors may let you move that logic back into the ViewModel or into a reusable behavior class. The tradeoff is additional XAML verbosity at the use site.

For the animation builder, the decision comes down to whether you need composition-layer animations. If your motion requirements are simple transitions that storyboard animations handle well, adding the animations package may not justify the dependency. If you need performant, interruptible animations that respond to scroll position or touch input through expression animations, the composition API wrappers in the package save substantial time.

The layout controls fill specific gaps. If your application does not have wrapping item grids or dock-style layouts, skipping those packages is reasonable. If it does, reaching for `WrapPanel` or `DockPanel` is faster than implementing equivalent behavior with `ItemsRepeater` layouts or nested grids.

Start by installing the packages whose controls or features you know you need, then add others if you find yourself writing functionality the toolkit already provides. The [toolkit sample app](https://apps.microsoft.com/detail/9nblggh4tlcq){:target="_blank" rel="noopener noreferrer"} is the fastest way to browse what exists before deciding what to adopt.
