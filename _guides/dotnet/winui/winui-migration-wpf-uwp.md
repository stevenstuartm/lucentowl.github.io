---
title: "Migration from WPF and UWP"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Deciding whether and how to move a WPF or UWP app to WinUI 3: the options besides migrating, the feature gaps on each side, what changes from UWP and from WPF, and incremental paths through shared libraries, XAML Islands, and UWP on modern .NET."
tags: [practical, migration, wpf, uwp, xaml-islands, native-aot]
---

## Table of Contents

- [Decide First: Migrate, Modernize in Place, or Stay](#decide-first-migrate-modernize-in-place-or-stay)
- [Check the Gaps Before Committing](#check-the-gaps-before-committing)
- [UWP to WinUI 3](#uwp-to-winui-3)
- [WPF to WinUI 3](#wpf-to-winui-3)
- [Moving Gradually](#moving-gradually)
- [Tools and Pitfalls](#tools-and-pitfalls)


## Decide First: Migrate, Modernize in Place, or Stay

A migration to WinUI 3 is a rewrite of the UI layer, and the first question is whether the app needs one.

**A WPF app can stay on WPF.** WPF still ships with each .NET release and still gets features. .NET 9 added a Fluent (Windows 11) theme with light and dark modes and the system accent color, so looking current doesn't by itself require leaving. A stable WPF app may be best left where it is, especially a line-of-business app built on WCF, COM, or heavy third-party control suites, where Microsoft suggests upgrading the .NET version in place first.

**A WPF app can also gain Windows App SDK features without changing UI framework.** App notifications, windowing APIs, background tasks, and on-device AI are reachable from an existing WPF project that references the Windows App SDK. The case for a full move gets stronger when the app needs WinUI's controls and Fluent design throughout, not just a few platform features.

**A UWP app has more reason to move, but it has a first step short of migrating.** UWP is in maintenance, and Microsoft points new development at WinUI 3. But UWP apps can now run on modern .NET, compiled ahead of time to native code with Native AOT in place of the older .NET Native, and that is the default C# UWP project type in Visual Studio 2026. The UI framework and app model stay the same, and a later move to WinUI 3 then changes one thing at a time.

**Moving has costs beyond the rewrite.** Microsoft states that WinUI 3 apps start more slowly, use more memory, and install larger than equivalent UWP apps, and the XAML Designer's Design tab doesn't support WinUI 3 projects. UWP apps also lose their AppContainer sandbox when they become desktop apps, which Win32 App Isolation can restore. Weigh those against what the app gains.

```
Which path?
├── WPF app
│   ├── Stable, heavy WCF/COM/third-party controls ──► upgrade .NET, stay on WPF
│   ├── Needs a few Windows platform features ──────► WPF + Windows App SDK
│   └── Needs WinUI controls and Fluent throughout ─► migrate, often screen by screen
└── UWP app
    ├── Blocked by a gap in the table below ────────► UWP on modern .NET, wait
    └── No blocking gap ───────────────────────────► UWP on modern .NET, then WinUI 3
```


## Check the Gaps Before Committing

WinUI 3 covers most of what UWP offered, but not all of it. Microsoft's migration table, as of Windows App SDK 2.0, lists these among the notable cases:

| UWP feature | In WinUI 3 |
|---|---|
| `MapControl` | Available since 1.5, backed by Azure Maps and needing an Azure Maps key |
| `MediaElement`, `MediaPlayerElement` | `MediaPlayerElement`, since 1.2 |
| Background tasks | `BackgroundTaskBuilder`, since 1.7 |
| `WebAuthenticationBroker` | `Microsoft.Security.Authentication.OAuth`, since 1.7 |
| `CameraCaptureUI` | Available since 1.7 |
| `WebView` | `WebView2`, which needs the WebView2 Runtime |
| `PrintManager` | Windows 11 only |
| `InkCanvas` | Experimental channel only, the preview releases not meant for production. Referencing it in a stable build fails with an unknown-type error |
| `InkToolbar` | Not available on any channel. Build a custom toolbar |
| `CaptureElement` | Not available. Use `MediaPlayerElement` with a frame source for camera preview |
| `DisplayRequest` | Not available. Use Win32 `SetThreadExecutionState` |
| `DataGrid` | No first-party control, and the Community Toolkit's is UWP-only |
| `CoreWindow` and related APIs | Not supported. Use `AppWindow` and window-handle APIs |
| Xbox, HoloLens, single-app kiosk | Not supported |

WPF apps have their own list. Most WPF controls have direct counterparts, but these don't:

| WPF | In WinUI 3 |
|---|---|
| `DataGrid` | No first-party control. Community projects such as WinUI.TableView fill the gap |
| `Ribbon` | `CommandBar` and `CommandBarFlyout`, or an experimental Ribbon in Community Toolkit Labs |
| `StatusBar` | `InfoBar`, or a footer area in the layout |
| `FlowDocumentReader`, `FlowDocumentScrollViewer` | `RichTextBlock`, for read-only rich text |
| `AdornerLayer` | No equivalent. Overlay a `Canvas` or `Grid` in the layout |
| `.resx` resources | `.resw` files read through `ResourceLoader` |

Microsoft's own advice is to check the list against the app before setting a date. A short spike that exercises the specific APIs the app depends on turns an unknown gap into a known one while it's still cheap.


## UWP to WinUI 3

UWP and WinUI 3 share most of their XAML and control set, so a UWP migration is mostly mechanical. The changes cluster in four places.

### Namespaces

`Windows.UI.Xaml` becomes `Microsoft.UI.Xaml`, and a few neighbors move with it: `Windows.UI.Colors` and `ColorHelper` become `Microsoft.UI.Colors` and `Microsoft.UI.ColorHelper`, and `FontWeights` and the rich-edit text types move to `Microsoft.UI.Text`. A search and replace covers most of it, but not blindly. `Windows.UI.Color` itself stays put, as do `FontWeight`, `FontStyle`, and `TextDecorations` in `Windows.UI.Text`, and operating system types such as `Windows.System.VirtualKey` and `Windows.Storage` keep their names. A blanket replace of `Windows.UI` breaks all of those.

### The App Model

UWP's app model doesn't come along:

- **Activation.** UWP's per-kind overrides such as `OnFileActivated` and `OnActivated` are gone. `OnLaunched` runs for every activation, and the app reads the real reason with `AppInstance.GetCurrent().GetActivatedEventArgs()`.
- **Instancing.** UWP apps were single-instance by default, and WinUI 3 apps are multi-instance. An app that relied on one instance has to redirect second launches itself.
- **Suspension.** There is no `Suspending` or `Resuming`. A desktop app isn't suspended, so state saving moves to the shutdown paths.
- **The current view.** `CoreWindow`, `ApplicationView`, and the `GetForCurrentView` methods don't work in a desktop app. `Window.Current` is deprecated and always returns null, so the app keeps its own reference to its window, typically a static property on `App`. `DisplayInformation.GetForCurrentView()` throws, and the scale factor comes from `XamlRoot.RasterizationScale`, with `XamlRoot.Changed` for DPI changes.
- **The sandbox.** A UWP app ran in an AppContainer. A WinUI 3 app runs with full trust unless it opts into Win32 App Isolation.

### Windows and Dialogs

UWP UI found its window implicitly, and WinUI UI has to be told:

- `ContentDialog` and `Popup` need their `XamlRoot` set, usually to `this.Content.XamlRoot` from the page.
- `MessageDialog` and the `Windows.Storage.Pickers` pickers need the window handle through `InitializeWithWindow.Initialize`, and sharing needs it through the `IDataTransferManagerInterop` COM interface. Prefer `ContentDialog`, and the Windows App SDK's own pickers, which take a `WindowId`, the SDK's identifier for a top-level window.
- `Window` isn't a control, so it has no `Resources`, `DataContext`, or visual states. A single-page UWP app ported onto `MainWindow` puts its content in a `UserControl` or `Page` inside the window, and its resources on the root layout element.

### Threading, and Crashes UWP Prevented

`CoreDispatcher.RunAsync` becomes `DispatcherQueue.TryEnqueue`, taken from the window or any element as `window.DispatcherQueue`, and `DispatcherTimer` keeps its name in `Microsoft.UI.Xaml`.

The thread itself behaves differently. UWP's UI thread was an Application STA, which blocked reentrancy: while the UI thread waited on a cross-apartment call, other calls couldn't re-enter it. The Windows App SDK uses a standard STA without that guard. Code that relied on it, often without knowing, can now re-enter a XAML control mid-operation. The resulting crashes frequently surface as stowed exceptions (code `0xc000027b`), where the crash stack has already unwound and the real error has to be dug out of the dump.

Two UWP habits also crash WinUI 3 outright. A virtualized list whose data source uses `null` as a placeholder for items not yet loaded crashes, where UWP tolerated it, so use a non-null placeholder object. And `<Image Source="" />` fails fast at startup, so leave `Source` unset until there's a value.


## WPF to WinUI 3

WPF and WinUI share XAML syntax but not a lineage, and more of a WPF app has to be rethought rather than renamed.

### XAML Features That Don't Carry Over

| WPF | WinUI 3 |
|---|---|
| `Style.Triggers`, `DataTrigger` | `VisualStateManager` states, switched by a `StateTrigger` or `AdaptiveTrigger`, or `DataTriggerBehavior` from the XAML Behaviors NuGet package |
| `MultiBinding` with a converter | An `{x:Bind}` function binding such as `{x:Bind local:Format.FullName(First, Last), Mode=OneWay}`, which re-evaluates when any argument changes, or a computed view model property |
| `RoutedCommand`, `CommandBinding` | `ICommand` on the view model, with `KeyboardAccelerator` for shortcuts, or `XamlUICommand` for one command on several surfaces |
| `{DynamicResource}` | `{ThemeResource}`, which updates only on theme changes |
| `{x:Static}` | `{x:Bind}` to a static property, such as `{x:Bind local:AppInfo.Version}` |
| `{x:Type}` | No equivalent. Expose the type from code instead |
| `pack://application:,,,/` | `ms-appx:///` |
| `TypeConverter` on a custom type | A static `CreateFromString` method |
| `Window.DataContext`, `Window.Resources` | As in UWP, set them on the window's root element |

WinUI also has no custom inheriting properties. `DataContext` and text properties such as `FontSize` still flow down the tree, but a WPF dependency property registered with `FrameworkPropertyMetadataOptions.Inherits` has no WinUI counterpart, so code that sets such a value high in the tree and reads it in descendants needs another route, such as a shared view model or a resource.

### Binding and Threads

A WPF binding to a scalar property quietly marshals a `PropertyChanged` raised on a worker thread over to the UI thread, and `BindingOperations.EnableCollectionSynchronization` lets a collection change off the UI thread. WinUI 3 has neither. View models that raise change notifications from background work have to dispatch them to the UI thread first, and code that "worked" in WPF can start throwing.

Compiled `{x:Bind}` bindings fail at build time when a path is wrong, which surfaces mistakes that WPF's runtime bindings swallowed. But `{x:Bind}` defaults to `OneTime`, not `OneWay`, so a direct translation of WPF bindings compiles cleanly and then never updates. Set `Mode=OneWay` wherever the value changes. `{Binding}` still fails silently at run time, as in WPF.

### It Will Look Different

WinUI's controls use Fluent default styles, and a WPF app's years of implicit styles and control templates don't transfer. Even identical markup renders differently, so plan a visual review of every screen rather than assuming a port that compiles looks right.


## Moving Gradually

Few real apps can stop shipping while their UI is rewritten, so most migrations run in stages.

### Share Non-UI Code First

Whatever the route, start by moving view models, services, and domain logic into class libraries that target plain .NET, not WPF or UWP. A view model that depends only on abstractions such as an `IDialogService` runs unchanged under both UIs, with a WPF implementation and a WinUI implementation of each service. Service registration can live in the shared library too, so both apps configure dependency injection from the same code. This work pays off even if the migration stalls, and it shrinks what the UI rewrite has to touch.

### Host WinUI Inside the Existing App

XAML Islands let a WPF, WinForms, or Win32 app host WinUI 3 content in part of a window, so screens can move over one at a time while the app keeps shipping. This is the strangler fig pattern applied to a UI: new screens grow inside the old shell until the shell is all that's left of it. WinUI 3 islands arrived in Windows App SDK 1.4 through `Microsoft.UI.Xaml.Hosting.DesktopWindowXamlSource`. The host sets up WinUI on its UI thread before creating an island: a dispatcher queue, a WinUI `Application`, and a call to `WindowsXamlManager.InitializeForCurrentThread`. The namespace matters, because the legacy UWP islands API has a class with the same name in `Windows.UI.Xaml.Hosting`, and Microsoft warns against mixing setup instructions from the two.

Both sides of an island can bind to the same view models from the shared library, which is how a WPF screen and a WinUI screen stay in sync without knowing about each other.

{% include figure.html id="winui-island-migration" %}

Treat islands as a bridge with an end date. An app that keeps two UI frameworks indefinitely pays for both.

Older guidance points at the Windows Community Toolkit's `WindowsXamlHost` control. That hosts UWP XAML, not WinUI 3, so it doesn't help a WPF app move to WinUI.

A UWP app can't host WinUI 3 islands, so it can't go screen by screen this way. It can go the other direction: with UWP on modern .NET, a new WinUI 3 app can host not-yet-ported UWP XAML screens as UWP XAML Islands, then replace them one at a time.

### Upgrade UWP's .NET First

For a UWP app, moving to UWP on modern .NET is a smaller first stage than moving to WinUI. It brings SDK-style projects, current C#, faster builds, and Hot Reload with the same UI framework. The cost is Native AOT compatibility: reflection and dynamic code need attributes or source generators, a .NET Native `rd.xml` file is replaced by those annotations, and every dependency has to be AOT-compatible. Doing that work now leaves the codebase ready for the UI move.

### Or Rewrite at Once

A small app with little logic tangled into its UI, or one whose team can pause feature work, can move in one step to a new WinUI project. The risk is a long stretch where the new app isn't shippable, which pushes teams to cut testing at the end.


## Tools and Pitfalls

- **The .NET Upgrade Assistant is deprecated.** Microsoft now points at GitHub Copilot's modernization agent for .NET upgrades, but that agent doesn't document UWP-to-WinUI as a supported path. For that move Microsoft publishes an API substitution table, a starter prompt, and a WinUI plugin for GitHub Copilot with a UWP migration skill.
- **Check NuGet dependencies early.** A package built only for .NET Framework may install into a modern .NET project with a compatibility warning but isn't guaranteed to work, and UI packages built for WPF or UWP won't work at all. Find their replacements, or the lack of one, before the schedule depends on them.
- **Event signatures move.** Handlers that cast event arguments to WPF or UWP types need updating even where a control looks the same. A WPF `MouseButtonEventArgs` handler becomes a `PointerRoutedEventArgs` handler, and `KeyEventArgs` becomes `KeyRoutedEventArgs`.
