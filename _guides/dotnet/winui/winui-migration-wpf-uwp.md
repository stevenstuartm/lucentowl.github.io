---
title: "Migration from WPF and UWP"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Migrating existing WPF and UWP applications to WinUI 3, covering namespace changes, API differences, feature gaps, and strategies for incremental modernization."
tags: [winui, winui-3, migration, wpf, uwp, modernization, desktop, practical]
---

## The Migration Landscape

WinUI 3 represents Microsoft's current investment in native Windows UI development, consolidating the best of WPF's flexibility with UWP's modern design language and access to Windows App SDK capabilities. Understanding why to migrate and when to hold off shapes how you approach the work.

WPF applications benefit from migrating when they need access to modern Windows features such as the Windows App SDK notification system, the newer file picker APIs tied to the user's identity, or Fluent Design components that WPF cannot replicate without third-party libraries. WPF has no path forward from Microsoft; it receives maintenance updates but no new features. Teams building long-lived applications that will need to evolve alongside Windows should treat WinUI 3 as the destination.

UWP applications have a stronger reason to migrate now. Microsoft has effectively ended UWP's active development, and many UWP-specific APIs are deprecated or frozen. WinUI 3 was explicitly designed as the UWP successor, and the structural similarities between the two frameworks make migration more straightforward than WPF-to-WinUI 3 work.

When to stay is an equally valid question. WPF applications that are stable, feature-complete, and maintained by a small team may not justify the migration cost. The benefits of WinUI 3 appear most clearly in applications that need ongoing Windows feature integration, touch and stylus support, or the modern Fluent design system. A WPF application that works well and has no active roadmap is not necessarily a migration candidate.


## UWP to WinUI 3

The structural distance between UWP and WinUI 3 is smaller than it appears, but the namespace changes touch nearly every file in a project. The core shift is from the `Windows.UI.*` namespace to `Microsoft.UI.*`. The XAML namespace moves from `Windows.UI.Xaml` to `Microsoft.UI.Xaml`, and the controls namespace shifts accordingly. A straightforward find-and-replace across your project handles most of these changes, though edge cases around Windows Runtime types require manual review.

The multi-instance model changes meaningfully in WinUI 3. UWP enforced a single-instance model by default through its app activation contract. WinUI 3 applications run as standard Win32 processes and support multiple instances natively. Applications that relied on UWP's single-instance enforcement need to reimplement that behavior using the [AppInstance API](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.windows.applifecycle.appinstance){:target="_blank" rel="noopener noreferrer"} from the Windows App SDK.

Dialog placement requires explicit `XamlRoot` in WinUI 3. In UWP, dialogs attached to the implicit visual tree root automatically; in WinUI 3, you set the `XamlRoot` property on the dialog to the `XamlRoot` of the window or element it belongs to before calling `ShowAsync`. Missing this step results in a runtime exception rather than a visible dialog.

File and folder pickers present a more significant change. UWP pickers worked through the Windows Runtime broker process and had no need for a window handle. WinUI 3 pickers are Win32-hosted and require an `HWND` to associate with a parent window. You retrieve the window handle through the `WindowNative.GetWindowHandle` interop method, then pass it to `InitializeWithWindow`. This pattern appears throughout WinUI 3 wherever Win32 window association is required.

The threading dispatcher changes from `CoreDispatcher` to `DispatcherQueue`. Most UWP code that marshals work back to the UI thread using `CoreDispatcher.RunAsync` translates directly to `DispatcherQueue.TryEnqueue`. The behavioral model is similar; the API surface is different. The `DispatcherQueue` is also available from background threads via `DispatcherQueue.GetForCurrentThread`, and it supports the standard timer and delayed invocation patterns that `CoreDispatcher` previously handled.


## WPF to WinUI 3

The WPF-to-WinUI 3 distance is larger because WPF and WinUI 3 have different architectural roots despite sharing XAML as a markup language. Several WPF patterns have no direct equivalent and require rethinking.

`MultiBinding` does not exist in WinUI 3. WPF's `MultiBinding` allowed binding a single property to multiple source values through a converter. The WinUI 3 equivalent is to handle the aggregation in the ViewModel: expose a computed property that combines the source values, and raise `PropertyChanged` from that property whenever any dependency changes. This approach is more explicit and generally produces cleaner code, though the migration effort for complex bindings can be significant.

`DataTrigger` has no direct replacement. WPF's data triggers allowed XAML to apply style changes in response to data conditions, enabling highly declarative visual behavior. WinUI 3 uses `VisualStateManager` for state-driven visual changes. The migration pattern is to define named visual states in the control template, then trigger state transitions from code or through `VisualStateManager` bindings using the `x:Bind` with compiled bindings. This requires restructuring XAML that previously used triggers into state groups, which is a meaningful authoring investment for complex controls.

Resource URI schemes change between the two frameworks. WPF used the `pack://application:,,,/` scheme for referencing embedded resources. WinUI 3 uses `ms-appx:///` for application package resources. This affects image sources, resource dictionary merges, and any code that constructs resource URIs programmatically. The migration is mechanical but touches many files.

The threading model in WinUI 3 is stricter than WPF's. WPF allowed some cross-thread access patterns that technically violated its threading rules but worked in practice because the dispatcher was forgiving. WinUI 3 enforces thread affinity more aggressively. Background work that touches UI elements must marshal to the UI thread through `DispatcherQueue`, and code that assumes leniency from WPF will produce exceptions in WinUI 3.

`RoutedCommand` and the associated `CommandBinding` infrastructure from WPF has no equivalent in WinUI 3. WPF's command routing allowed commands to bubble through the visual tree and be handled at any level. WinUI 3 offers `XamlUICommand` for commands that need keyboard shortcut integration and accessibility metadata, and the standard `ICommand` interface works for ViewModel binding. Applications that relied heavily on `RoutedCommand` for input gesture handling need to restructure command handling into ViewModel commands or the `KeyboardAccelerator` system.

The following table summarizes the primary API differences for quick reference during migration.


| WPF / UWP                          | WinUI 3 Equivalent                                |
|------------------------------------|---------------------------------------------------|
| `Windows.UI.Xaml` (UWP)            | `Microsoft.UI.Xaml`                               |
| `CoreDispatcher.RunAsync`          | `DispatcherQueue.TryEnqueue`                      |
| `DataTrigger`                      | `VisualStateManager` with named states            |
| `MultiBinding`                     | Computed properties in ViewModel                  |
| `RoutedCommand` / `CommandBinding` | `XamlUICommand` or `ICommand` on ViewModel        |
| `pack://application:,,,/`          | `ms-appx:///`                                     |
| `FileOpenPicker` (UWP, no HWND)    | `FileOpenPicker` with `InitializeWithWindow`      |
| Dialog (UWP, no XamlRoot)          | `ContentDialog.XamlRoot` must be set              |
| `Application.Current.Dispatcher`   | `DispatcherQueue.GetForCurrentThread()`           |


## Feature Gaps

WinUI 3 does not yet replicate the full surface area of either WPF or UWP. Some gaps are planned for future releases; others reflect architectural differences that make direct equivalence unlikely.

Ink APIs have partial coverage. UWP's inking APIs were deeply integrated with the Windows Ink workspace, and WinUI 3 supports the core `InkCanvas` and `InkToolbar` controls, but some of the more specialized ink analysis and handwriting recognition APIs that existed in UWP require workaround through Windows Runtime interop or alternate APIs in the Windows App SDK.

Map controls are not available in WinUI 3. UWP's `MapControl` has no direct WinUI 3 equivalent. Applications that need mapping capabilities use [WinUI Map Control](https://learn.microsoft.com/en-us/windows/apps/winui/winui3/){:target="_blank" rel="noopener noreferrer"} third-party libraries or embed web-based maps through `WebView2`. The `WebView2` approach is well-supported and gives access to the full capabilities of modern mapping platforms.

Media playback APIs have evolved. WPF's `MediaElement` and UWP's media pipeline both behave differently from WinUI 3's `MediaPlayerElement`, which is backed by the Windows Media Player infrastructure. Applications with complex media requirements, such as custom rendering pipelines or tight integration with media session APIs, may find that the WinUI 3 media controls require additional work to replicate their previous behavior.

The practical approach to feature gaps is to identify them before committing to a migration timeline. A spike that exercises the specific APIs your application needs surfaces gaps early, before they become schedule risks.


## Migration Strategies

Two broad strategies exist for migrating to WinUI 3, and the right choice depends on the application's size, team capacity, and tolerance for a period of dual-maintenance.

A big-bang rewrite creates a new WinUI 3 project and ports all code at once. This approach is appropriate for smaller applications, those with minimal business logic entangled in the UI layer, and teams that can dedicate focused time to the migration without needing to ship features concurrently. The risk is that the application is not functional until the migration is complete, which creates pressure to cut corners on testing.

Incremental migration through XAML Islands allows a WPF or WinForms application to host WinUI 3 controls within its existing window. The host application continues to function while individual screens or controls are migrated one at a time. This is the strangler fig pattern applied to UI frameworks: the old application wraps the new controls, and over time the new controls consume more of the application until the host shell is the only WPF remnant. XAML Islands require the host application to target .NET 6 or later and Windows 10 version 1903 or later.

Shared business logic belongs in a separate class library regardless of which migration strategy you choose. ViewModels, services, repositories, and domain logic extracted into a .NET Standard 2.0 or .NET 6+ class library can be referenced from both the existing WPF project and the new WinUI 3 project. This separation means business logic is tested and stable before the UI migration begins, and it persists through the migration without duplication.


## Sharing Code Between WPF and WinUI 3

The cleanest migration architecture places all non-UI code in a shared library and keeps only platform-specific UI concerns in the respective projects. This is not primarily a migration optimization; it is good architecture that the migration makes more urgent.

ViewModels work well in shared libraries when they depend only on abstractions. An `IDialogService` interface, for example, can be implemented differently in WPF and WinUI 3 while the ViewModel calls the same interface. Services that use .NET APIs without platform-specific dependencies migrate to a shared library without modification. Services that use WPF-specific types like `BitmapImage` from `System.Windows.Media` need thin adapters or replacement with platform-neutral types.

The dependency injection setup differs between platforms, but the service registrations for shared services are identical. A factory method or extension method in the shared library that registers all shared services lets both the WPF host and the WinUI 3 project reuse the same configuration code.


## Common Migration Pitfalls

Implicit style differences between WPF and WinUI 3 cause visual regressions that are not obvious from the code. WPF applications often carry years of implicit styles in merged resource dictionaries that override default control appearances. WinUI 3 controls have their own default styles based on the WinUI design system, so control appearances change even when the XAML markup is identical. A visual review pass after migration is necessary, not optional.

Binding behavior changes in subtle ways. WPF bindings silently swallow many errors; WinUI 3 bindings using `x:Bind` are compiled and fail at build time when source paths are wrong. Code-heavy ViewModels that WPF silently tolerated may surface errors in WinUI 3. The compiled binding model is a feature, not a regression, but it requires fixing binding errors that WPF masked.

Event handler signatures differ in some cases between WPF and WinUI 3. Controls that appear identical may use `RoutedEventArgs` subtypes that have moved or been renamed. Code that casts event arguments to WPF-specific types needs updating regardless of the migration path.

NuGet package compatibility deserves early investigation. Packages that target `net46` or older .NET Framework targets are not compatible with WinUI 3 projects, which target .NET 6 or later. Packages with no .NET 6 build may have compatible successors, but some have been abandoned. The [.NET Upgrade Assistant](https://dotnet.microsoft.com/en-us/platform/upgrade-assistant){:target="_blank" rel="noopener noreferrer"} can scan a project and identify package compatibility issues before migration begins.


## XAML Islands as a Bridge

XAML Islands provide the technical foundation for incremental WinUI 3 adoption in existing WPF and WinForms applications. The host application continues running its existing framework while WinUI 3 controls are embedded in specific regions through the `WindowsXamlHost` control from the [Windows Community Toolkit](https://github.com/CommunityToolkit/WindowsCommunityToolkit){:target="_blank" rel="noopener noreferrer"}.

The practical workflow with XAML Islands is to identify screens or components with the highest modernization value, such as a settings panel that would benefit from fluent design, or a data entry form that needs ink support, and migrate those first. Users see incremental improvements without waiting for a complete rewrite, and the team builds familiarity with WinUI 3 patterns before taking on the full application.

Communication between the WPF host and the hosted WinUI 3 content happens through the `WindowsXamlHost.ChildChanged` event and the shared ViewModel layer. The WinUI 3 control data-binds to a ViewModel that lives in the shared library, and the WPF host also binds to the same ViewModel. Changes in either surface propagate through the shared model, and neither side needs direct knowledge of the other's UI framework.

XAML Islands carry a performance cost because they run WinUI 3's composition infrastructure inside a WPF window. For most applications this is negligible, but applications with tight rendering budgets should measure before committing to this approach for performance-critical screens.

The Islands bridge is a migration tool, not a long-term architecture. The goal is to complete the migration and retire the WPF host, not to maintain a permanent dual-framework application. Setting a target date for completing the migration and tracking progress against it prevents the "temporary" Islands from becoming permanent.
