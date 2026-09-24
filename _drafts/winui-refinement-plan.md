# WinUI 3 Study Guides Refinement Plan

Tracks the review-and-refine pass over all guides in `_guides/dotnet/winui/`. Guides are consumed sequentially, in the order they appear in `assets/data/study_guides_config.json` (the "WinUI 3" category). That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope. The config ordering handles that.

**The process rules live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md); the checklist and cross-domain gotchas live in [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

## Sources

- Primary: Windows App SDK and WinUI docs on learn.microsoft.com (`/windows/apps/`, `/windows/windows-app-sdk/api/winrt/`), the Windows App SDK release notes (current and archive), the `microsoft/microsoft-ui-xaml` and `microsoft/WindowsAppSDK` GitHub repos (issues and discussions for status of gaps), Windows AI docs (`/windows/ai/`), CommunityToolkit docs (`/dotnet/communitytoolkit/`), the CsWin32 repo.
- Off-limits or unreliable: blog posts, Stack Overflow answers, and UWP-only docs (`/uwp/api/`, `/windows/uwp/`) as the sole source for a WinUI 3 claim. A UWP page describes a different app model; confirm the WinUI 3 / desktop behavior separately.

## Domain notes

**Item 7 (hierarchy and scope clarity)** in this domain means three containments that decide what an API can do:

- **Process and package identity.** Packaged (MSIX), packaged with external location, and unpackaged apps get different API surfaces (app notifications setup, background tasks, `ApplicationData.Current`, `Package.Current`). A claim about an API often only holds for one of these.
- **Window.** XAML `Window` → its `AppWindow` → its HWND, each window with its own `XamlRoot` and visual tree. Dialogs, flyouts, and pickers must be told which window they belong to.
- **Thread.** Every XAML object belongs to the UI thread of its window. Code that runs elsewhere (network callbacks, timers, activation redirection) must dispatch back.

Resource lookup follows the element tree up to `Application.Resources`, then the framework theme dictionaries.

**Item 9 (tag audit)** measured across the 33 guides before the pass: `winui` 33, `winui-3` 33, `desktop` 31, `practical` 22, `xaml` 15, `controls` 7, `mvvm` 5, `data-binding` 5, `ui-framework` 4, `fundamentals` 4, `advanced` 4, `dotnet` 3. So for this category: drop `winui`, `winui-3`, and `desktop` (they restate the category), and treat `xaml`, `controls`, `ui-framework`, and `dotnet` as filler to replace with the specific controls and APIs each guide covers.

## Topic ownership map

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| Window / AppWindow / HWND layering | window-management | One-clause definition |
| Packaged vs unpackaged, package identity, manifest | packaging-and-deployment | Clause; state which mode a claim applies to |
| Dependency property system, attached properties | xaml-fundamentals | Used without re-teaching |
| `{Binding}` vs `{x:Bind}`, modes, `x:DataType`, INPC, ObservableCollection | data-binding | Clause |
| MVVM Toolkit generators, commands, messenger, XAML behaviors | mvvm-toolkit | Clause |
| Validation (`ObservableValidator`), incremental loading, batch collection updates, offline sync, connectivity | advanced-data-patterns | Clause |
| View-to-ViewModel wiring, page construction, navigation service | dependency-injection | Clause |
| UI thread affinity, DispatcherQueue, cross-thread collections | threading-and-dispatching | Clause |
| Virtualization, ItemsRepeater, selection, DataTemplateSelector, grouping | collection-controls | Clause |
| Image decode sizing, composition visuals and effects | media-and-graphics | Clause |
| ResourceDictionary, lookup, merged dictionaries, Static vs ThemeResource, ThemeDictionaries | resource-management | Clause |
| Styles, lightweight styling, retemplating built-in controls, RequestedTheme | styling-and-theming | Clause |
| Template parts, `OnApplyTemplate`, Generic.xaml, custom panels | custom-controls | Clause |
| VisualStateManager basics (groups, states, setters, AdaptiveTrigger) | layout-system | Used without re-teaching |
| Storyboards, transitions, connected and composition animations, easing, AnimationBuilder, Lottie | animations-and-motion | Clause |
| System backdrops, title bar, window icon | window-management | Clause |
| Keyboard accelerators, focus, TabIndex, XYFocus, focus visuals | input-handling | Clause |
| Activation kinds, instancing, protocol/file activation, activation-driven navigation | app-lifecycle | Clause |
| Tray icon | notifications | Clause |
| Code signing | packaging-and-deployment | Clause |
| File pickers and `InitializeWithWindow` | file-and-data-access | Clause |
| XAML Islands | win32-interop | Clause |
| Custom automation peers, `OnCreateAutomationPeer` | accessibility | Clause |
| "Which message surface" decision | dialogs-flyouts-commands | text-and-status covers InfoBar and Tooltip only |
| `XamlUICommand` / `StandardUICommand` (one command on several surfaces) | dialogs-flyouts-commands | Clause |
| DI container mechanics, lifetimes, scopes, service locator | `_guides/dotnet/c-sharp/libraries/dependency-injection.md` | Clause |
| async/await, `ConfigureAwait`, SynchronizationContext mechanics | `_guides/dotnet/c-sharp/async/async-await-fundamentals.md` | Clause |
| HttpClient lifetime, resilience | `_guides/dotnet/c-sharp/libraries/httpclient-and-networking.md` | Omit |
| gRPC client, SignalR client | `_guides/dotnet/asp/aspnet-grpc.md`, `aspnet-signalr-realtime.md` | Omit |
| P/Invoke, LibraryImport, SafeHandle, COM RCWs | `_guides/dotnet/c-sharp/advanced/native-interop.md` | Clause |
| EF Core mechanics | `_guides/dotnet/c-sharp/libraries/entity-framework-core.md` | Clause |
| IMemoryCache | `_guides/dotnet/c-sharp/libraries/caching-patterns.md` | Clause |
| Unit-test frameworks, doubles, mocking | `_guides/dotnet/c-sharp/tooling/unit-testing-in-dotnet.md` | Clause |
| OAuth flows, PKCE | `_guides/security/identity-access-management.md` | Clause |
| Prompt engineering, fine-tuning | `_guides/ai/prompt-engineering.md`, `_guides/ai/llm-fine-tuning.md` | Clause |

## Domain gotchas

- **UWP docs look authoritative for WinUI 3 and often aren't.** Many `/uwp/api/` pages describe APIs that exist in the `Windows.*` namespace but fail in a desktop app (anything tied to `CoreWindow`, `GetForCurrentView`, or the UWP broker). Confirm desktop support on the Windows App SDK page or the "desktop apps" notes before trusting it.
- **API reference defaults can contradict themselves.** Several WinUI 3 API pages carry UWP-era prose defaults that disagree with the `MUXPropertyDefaultValue` attribute in the C# signature (`ProgressRing.IsActive`, `RatingControl.Value`). Read the attribute as well as the prose. When they disagree, say so or tell the reader to set the value explicitly, and don't assert either one.
- **WebFetch summaries of API pages can misreport types.** One summary gave `RichEditBox.Document` as `Windows.UI.Text.ITextDocument`; the signature is `Microsoft.UI.Text.RichEditTextDocument`. For a type or default that matters, ask the fetch to quote the signature.

- **Sibling API pages can disagree on version history.** `FlyoutBase.IsConstrainedToRootBounds` says "always true for Windows App SDK apps", but `FlyoutBase.ShouldConstrainToRootBounds` says that held only before 1.4. When a property has a `Should…`/`Is…` or setter/getter pair, read both pages and the release notes before asserting a limit.

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Windows App SDK versions.** 2.0 shipped 2026-04-29 and moved to semantic versioning (NuGet version = SDK version; package family tracks the major version). Current stable is 2.5.1 (2026-09-16); stable releases are roughly monthly. 1.8 is in maintenance, 1.7 and older are out of support. The SDK is backward compatible to Windows 10 1809 but supported only on in-support Windows releases. Source: learn.microsoft.com/windows/apps/windows-app-sdk/release-channels. Guides should not pin a 1.x version as "current".
- **2.x additions that guides must not describe as missing.** `TitleBar` control with automatic drag regions and `TitleBar.IsDragRegion` (2.1); `SystemBackdropElement` (2.0); `Microsoft.Windows.Storage.Pickers` enhancements (2.0: `FileTypeChoices`, `SettingsIdentifier`, `PickMultipleFoldersAsync`; `FileSavePicker` no longer creates the file); `Microsoft.Windows.Storage.ApplicationData.GetForUnpackaged()` (2.2); `IXamlCondition` (2.0); `XamlOptionalChanges` opt-in optimizations (2.3); WebView2 drag support (2.0); Phi Silica is a Limited Access Feature and LoRA adapters are stable (2.1); `LanguageModel.GenerateStructuredJsonResponseAsync` (2.3); `AICapabilities.CopilotPlusPCCapable` (2.1). Source: release-notes/windows-app-sdk-2-0.
- **`DISABLE_XAML_GENERATED_MAIN` (2.3 breaking change).** Defining it now renames the generated entry point to `XamlGeneratedProgram.XamlGeneratedMain()` instead of removing it, so a custom `Main` can call the default. Source: 2.3.1 release notes.
- **WPF is not frozen.** WPF in .NET 9 added a Fluent (Windows 11) theme with light/dark modes (`ThemeMode`) and system accent color support. Don't write that WPF gets no visual updates. Source: learn.microsoft.com/dotnet/desktop/wpf/whats-new/net90.
- **Project template (current).** Visual Studio 2026 "WinUI Blank App (Packaged)", or `dotnet new winui` from `Microsoft.WindowsAppSDK.WinUI.CSharp.Templates`. Generated project: `net10.0-windows10.0.26100.0`, `TargetPlatformMinVersion` 10.0.17763.0, `Platforms` x86;x64;ARM64, runtime identifier defaulted to the build machine's architecture, and `PublishReadyToRun`/`PublishTrimmed` true for non-Debug **publish** only. No separate unpackaged template. Sources: get-started/start-here; template package contents.
- **WinUI figures.** The composite is `_resources/winui-diagrams.md` (category "WinUI 3"). Figure ids use the `winui-` prefix; add each new figure to that composite's `figures:` and each embedding guide to its `related_guides`.
- **XAML facts WPF habits get wrong.** WinUI has no `{x:Type}`, `{x:Static}`, `{DynamicResource}`, or style triggers; string conversion for custom types uses `CreateFromString`, not `TypeConverter`. Dependency property precedence has five levels (animated, local, templated, style setter, default) with no property-inheritance level. `TextBlock`'s content property is `Inlines`. Source: learn.microsoft.com/windows/apps/develop/platform/xaml/ (xaml-overview, dependency-properties-overview).
- **Layout facts that recur.** A `Button`'s default style sets `HorizontalAlignment` Left and `VerticalAlignment` Center, so it doesn't fill a cell. A `ListView` in a vertical `StackPanel` or an `Auto` row gets unlimited height: no scroll bar and no virtualization. `AdaptiveTrigger` measures only the window; per-pane layouts use a `UserControl` with `SizeChanged` + `GoToState`. Sizes are effective pixels, so fixed sizes are not a DPI problem. Source: learn.microsoft.com/windows/apps/develop/ui/ (layouts-with-xaml, alignment-margin-padding), optimize-gridview-and-listview.
- **Text object model namespace.** In WinUI 3, `RichEditBox.Document` is a `RichEditTextDocument`, and `TextGetOptions`, `TextSetOptions`, `FormatEffect`, `ITextSelection`, and related types live in `Microsoft.UI.Text`, not UWP's `Windows.UI.Text`. Source: learn.microsoft.com/windows/apps/develop/ui/controls/rich-edit-box.
- **Built-in controls guides must not describe as missing or toolkit-only.** `SelectorBar` (single selection, no `ItemsSource`), `ToggleSplitButton`, `NumberBox`, `RadioButtons`, `RatingControl`, `ColorPicker`, and `RichEditBox.PlaceholderText` all ship in WinUI 3. `CalendarView.SelectionMode` is only None/Single/Multiple, with no range mode. Source: learn.microsoft.com/windows/apps/develop/ui/controls/.
- **Community Toolkit controls namespace.** Toolkit 8.x controls (SettingsCard, Segmented, and others) use `xmlns:...="using:CommunityToolkit.WinUI.Controls"`, one NuGet package per control family (e.g. `CommunityToolkit.WinUI.Controls.SettingsControls`). The `{ui:FontIcon}` markup extension is `using:CommunityToolkit.WinUI` and needs declaring separately. Source: learn.microsoft.com/dotnet/communitytoolkit/windows/.
- **Collections and virtualization.** ListView uses `ItemsStackPanel`, GridView `ItemsWrapGrid`; `TreeView` does not virtualize. `x:Phase` works only in ListView/GridView with `x:Bind`. The Community Toolkit 8.x has no WinUI 3 `DataGrid`. The MVVM Toolkit has no `EventToCommandBehavior` (event-to-command lives in XAML Behaviors). `TreeView.CanDragItems`/`CanReorderItems` default to `true`. The figure `winui-virtualization-recycling` exists for reuse. Sources: learn.microsoft.com/windows/apps/develop/ui/controls/listview-and-gridview, /tree-view, /itemsview; /develop/performance/optimize-gridview-and-listview.
- **Tooltip and InfoBar behavior.** A tooltip appears centered above the pointer (not the control) and isn't constrained to the window; Microsoft's guidance says not to use tooltips for errors, warnings, or status. `InfoBar.IsOpen` defaults to `false`. `InfoBadge` has no screen reader support of its own outside `NavigationView`. Sources: learn.microsoft.com/windows/apps/develop/ui/controls/tooltips, /infobar, /info-badge.
- **Frame and page navigation.** The frame creates pages through their parameterless constructor, so pages can't take constructor-injected services. Navigation parameters should be basic types (string, char, numeric, GUID); `GetNavigationState` throws on anything else, and the history holds a reference to every parameter. A Windows App SDK app has no `Suspending`/`Resuming`, so saving navigation state is tied to window `Closed`/`Activated` if at all. `NavigationCacheMode.Required` ignores `Frame.CacheSize` (not memory pressure). No current WinUI doc states that a new `Navigate` clears the forward stack, so don't assert it. Sources: learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.frame.navigate, .getnavigationstate; /windows/apps/develop/ui/navigation/navigate-between-two-pages.
- **Navigation controls raise events and never navigate.** `NavigationView` (`ItemInvoked`, `SelectionChanged`, `BackRequested`), `TabView` (`TabCloseRequested` doesn't remove the tab), and `BreadcrumbBar` (`ItemClicked`, not `BreadcrumbBarItemClicked`) all leave navigation to app code. `NavigationViewBackButtonVisible.Auto` shows the button on desktop. With the `TitleBar` control, Microsoft recommends hiding NavigationView's back and pane-toggle buttons and forwarding the TitleBar's events. Tab tear-out (`CanTearOutTabs`) arrived in Windows App SDK 1.6. Sources: learn.microsoft.com/windows/apps/develop/ui/controls/navigationview, /tab-view, /breadcrumbbar.
- **Dialogs and flyouts.** `ContentDialog` needs `XamlRoot` (null before the page loads) and the UI thread. Only one can be open at a time: the API reference says per thread, even across windows, while the dialogs page says per window. Deriving from `ContentDialog` needs a style `BasedOn="{StaticResource DefaultContentDialogStyle}"`. Since Windows App SDK 1.4, flyouts, menus, and popups can extend past the window when `ShouldConstrainToRootBounds` is `false`. Microsoft recommends `CommandBarFlyout` over `MenuFlyout` for context menus, and `CommandBarFlyout` primary commands show icon plus label from 1.5. `FlyoutBase.ShowAt` has no `(element, Point)` overload; `MenuFlyout.ShowAt(UIElement, Point)` is the exception, and everything else uses `FlyoutShowOptions`. Sources: learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.contentdialog, .primitives.flyoutbase.shouldconstraintorootbounds; /windows/apps/develop/ui/controls/command-bar-flyout, /menus-and-context-menus.
- **Templated controls.** `Themes/Generic.xaml` in the project that defines the control is found by path, with no merge into the app. `{x:Bind}` in a resource dictionary (including Generic.xaml) needs a code-behind class. A class derived from a built-in control might not get the WinUI styles and needs a style `BasedOn="{StaticResource Default<Control>Style}"`. `TemplatePart`/`TemplateVisualState` are documentation only, `GetTemplateChild` returns null for a missing part, and `GoToState` returns `false` without throwing for an unknown state. `Loaded` can fire before the template is applied. Returning an infinite size from `MeasureOverride` can throw. Sources: learn.microsoft.com/windows/apps/winui/winui3/xaml-templated-controls-winui-3; /develop/platform/xaml/xaml-styles, x-bind-markup-extension; /design/layout/custom-panels-overview; API pages for OnApplyTemplate, GetTemplateChild, GoToState.
- **Data binding.** `{x:Bind}` roots at the page, user control, or window class (not `DataContext`), defaults to `OneTime`, doesn't support `UpdateSourceTrigger=Explicit`, and initializes at `Loading` (pages, user controls); `Bindings.Update()` re-reads. `UpdateSourceTrigger` default is `PropertyChanged` except `TextBox.Text` (`LostFocus`). WinUI's `CollectionViewSource` does grouping and current item only, no sort or filter. `ObservableCollection<T>` has no `AddRange`, and CommunityToolkit.Mvvm adds no batching extension. `Window` has no `DataContext`. Under Native AOT, C# `{Binding}`/`DisplayMemberPath` sources need `partial` + `[WinRT.GeneratedBindableCustomProperty]`. The `Grid ColumnDefinitions="Auto, *"` shorthand is valid in WinUI 3 when rows/columns need no binding or min/max. Sources: learn.microsoft.com/windows/apps/develop/data-binding/data-binding-in-depth (feature comparison table), function-bindings; /develop/platform/xaml/x-bind-markup-extension; API pages Binding.UpdateSourceTrigger, CollectionViewSource, Grid; CsWinRT docs/aot-trimming.md.
- **MVVM Toolkit.** Current stable is CommunityToolkit.Mvvm 8.4.2 (March 2026). `[ObservableProperty]` on a field raises MVVMTK0045 in WinUI projects with CsWinRT AOT support; use partial properties, which need C# 14 from 8.4.1 on (default on net10; older target frameworks need `<LangVersion>14</LangVersion>`). Assigning a partial property in the constructor runs its change hooks. `AsyncRelayCommand` runs on the calling thread until its first `await` (no background thread), disables itself while running by default (`AllowConcurrentExecutions=false`), and rethrows exceptions on the UI thread by default. `StrongReferenceMessenger` is faster but requires unregistering; `Send` delivers synchronously on the sender's thread. XAML Behaviors 3.x (`Microsoft.Xaml.Behaviors.WinUI.Managed` 3.0.1, January 2026) puts every type in `Microsoft.Xaml.Interactivity` and needs no explicit `BehaviorCollection`. Sources: learn.microsoft.com/dotnet/communitytoolkit/mvvm/ (observableproperty, relaycommand, messenger, errors/mvvmtk0045); CommunityToolkit/dotnet and microsoft/XamlBehaviors releases.
- **Multiple UI threads.** WinUI 3 supports windows on more than one UI thread (2.5.1 fixed a shutdown crash in that configuration). Don't write "all windows share one UI thread" as a rule. By default every `Window` shares the thread it was created on (multiple-windows page). The `Window` API page still says creating more than one window "is limited to a single thread", which is 1.0.1-era text.
- **Threading APIs.** `Window` derives from `Object`, not `DependencyObject` (the DependencyObject page's derived-class prose still lists it). `DependencyObject.DispatcherQueue` is the only instance member readable off-thread, and `DependencyObject.Dispatcher`/`Window.Dispatcher` always return `null`. `Microsoft.UI.Xaml.DispatcherTimer` exists and ticks on the UI thread, alongside `DispatcherQueueTimer`. WinUI's `BindingOperations` has only `SetBinding` (no `EnableCollectionSynchronization`). The Windows App SDK UI thread is a standard STA with no ASTA reentrancy protection. The toolkit's `EnqueueAsync` lives in `CommunityToolkit.WinUI.Extensions`, namespace `CommunityToolkit.WinUI`. The threading guide owns all of this; other guides use a clause. Sources: learn.microsoft.com/windows/windows-app-sdk/api/winrt/ (microsoft.ui.xaml.window, .dependencyobject, .dispatchertimer, .data.bindingoperations); /windows/apps/develop/dispatcherqueue; /windows/apps/windows-app-sdk/migrate-to-windows-app-sdk/guides/threading.

- **App shutdown and the generic host.** `Application.Start` sets `Application.DispatcherShutdownMode` to `OnLastWindowClose` (property since 1.5), so closing the last window ends the event loop without waiting for async `Closed` handlers. `OnExplicitShutdown` keeps the thread running until `Application.Exit` or `DispatcherQueue.EnqueueEventLoopExit`. `Host.CreateApplicationBuilder` defaults the content root to the current directory and enables scope validation only in the `Development` environment. Since .NET 10, `BackgroundService` runs all of `ExecuteAsync` on a background thread. The generic host needs no custom `Main`. The DI guide owns host wiring, and app-lifecycle owns shutdown and activation. Sources: learn.microsoft.com/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.application.dispatchershutdownmode; /dotnet/api/microsoft.extensions.hosting.host.createapplicationbuilder; /dotnet/core/compatibility/extensions/10.0/backgroundservice-executeasync-task.

- **Storage and package identity.** `Windows.Storage.ApplicationData.Current` throws `InvalidOperationException` (0x80073D54) without package identity. `Microsoft.Windows.Storage.ApplicationData.GetDefault()` requires identity, and `GetForUnpackaged(publisher, product)` is the unpackaged route. Roaming app data is not supported as of Windows 11. By default, new files a packaged desktop app creates under `AppData` are redirected to a private per-package location and removed on uninstall. The legacy `Windows.Storage.Pickers` fail when the app runs elevated, and the 1.8+ pickers work. Microsoft.Data.Sqlite runs async methods synchronously, so `ToListAsync` doesn't keep the UI thread free. Clipboard access requires focus and the UI thread. File-and-data-access owns these; packaging owns the identity mechanics. Sources: /windows/apps/develop/data/store-and-retrieve-app-data; /windows/msix/desktop/flexible-virtualization; windows-app-sdk-1-8 release notes; /dotnet/standard/data/sqlite/async.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding.** Re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 15 advanced-data-patterns | Resume here. The guide is rewritten, the round 1 review (session model) is done, and its findings are applied and linted clean. Next: dispatch the round 2 `guide-reviewer` on Sonnet, focused on material changed after round 1: the incremental-loading intro (ItemsView/ItemsRepeater, the two meanings of "page"), the `onError`/`GetBaseException` paragraph, the `ErrorsChanged` rationale, `ClearErrors()`, the trimming paragraph, async custom validation, the local-first cost sentence, the sync race, the conflict table's "Ask the user" row and the detection paragraph, and the `>= LocalAccess` connectivity sample and prose. Then apply its findings, re-lint, and mark Complete. Verified during round 1: `ObservableValidator.ClearAllErrors` is private and `ClearErrors(string? = null)` is protected; the validation methods carry `[RequiresUnreferencedCode]`; `NetworkConnectivityLevel` remarks say to try services at `LocalAccess` or higher; the toolkit `onError` receives an `AggregateException` and the requested `count` is ignored in favor of `itemsPerPage` |
| 16 resource-management | Phase 0 moved in styling's custom theme-resource section; it duplicates the existing ThemeDictionaries section, merge to one |
| 18 animations-and-motion | Phase 0 moved in AnimationBuilder and Lottie; they overlap the existing "Implicit Animations via the Community Toolkit" section, merge; Lottie namespace (`CommunityToolkit.WinUI.Lottie`?) and `AnimatedIcon` claims to verify |
| 21 app-lifecycle | Phase 0 moved in navigation's deep-linking section; merge with the protocol activation section |
| 24 packaging-and-deployment | Phase 0 moved in security's code signing section; merge with "Building MSIX Packages" (both cover signing and certificates) |
| 27 webview2 | Seed only. Write from scratch: WebView2 control, runtime distribution (Evergreen vs fixed), user data folder, navigation events, host-to-web messaging and host objects, security of hosted content |
| 16 resource-management | "No cycle detection, stack overflow"; "ThemeDictionaries don't fall back"; merged-dictionary search order |
| 18 animations-and-motion | Storyboards can't animate `UIElement.Translation/Scale/Rotation` (not DPs); `ConnectedAnimationService.GetForCurrentView` in WinUI 3; "Fluent five building blocks" |
| 19 window-management | Line ~104 says "All windows in a WinUI 3 application share the same UI thread" and that a window can't be created from a background thread without marshalling: the default is one shared thread, but WinUI can run on more than one UI thread (see the multiple-UI-threads fact), so restate it as the default |
| 19 window-management | Mica "falls back on Windows 10 by rendering FallbackColor" (MicaBackdrop has no FallbackColor); CompactOverlay pixel sizes; new `TitleBar` control not covered; DesktopAcrylic on Windows 10 |
| 20 input-handling | Row 8's reviewer found input-handling teaching the "XamlUICommand system" (description and ~line 199); dialogs-flyouts-commands now owns it, so cut to a clause. Keep `ScopeOwner` here (row 8 dropped it). Accelerators on commands inside a closed `CommandBarFlyout` don't fire (microsoft-ui-xaml #448, open) while closed `MenuFlyout` ones do |
| 20 input-handling | Opacity 0 and hit testing; `HitTestCore` doesn't exist in WinUI; `FocusVisualKind` values |
| 21 app-lifecycle | `AppInstance.GetActivatedEventArgs()` is an instance method on `GetCurrent()`; `ExtendedActivationKind.ToastNotification` vs `AppNotification`; async Main with STA; background task model in Windows App SDK (1.7+ `BackgroundTaskBuilder`) |
| 22 notifications | `AppNotificationBuilder` progress bar support and scheduled notifications (later SDKs added them); badge API in Windows App SDK (1.? `BadgeNotificationManager`) |
| 23 win32-interop | XAML Islands: `WindowsXamlHost` hosts UWP XAML, not WinUI 3; WinUI 3 islands use `DesktopWindowXamlSource.Initialize(WindowId)`, and WPF/WinForms hosting of WinUI 3 support status. `Microsoft.Windows.SDK.Contracts` is for .NET Framework, not WinUI 3 |
| 25 migration-wpf-uwp | XAML Islands: `WindowsXamlHost` hosts UWP XAML, not WinUI 3; WinUI 3 islands use `DesktopWindowXamlSource.Initialize(WindowId)`, and WPF/WinForms hosting of WinUI 3 support status. `Microsoft.Windows.SDK.Contracts` is for .NET Framework, not WinUI 3 |
| 25 migration-wpf-uwp | MapControl exists since Windows App SDK 1.5; `MediaPlayerElement` "backed by Windows Media Player" |
| 26 media-and-graphics | InkCanvas/InkToolbar availability in WinUI 3; printing support status |
| 28 security | `WebAuthenticationBroker` doesn't work in desktop apps (`OAuth2Manager` in 1.7+); MSAL cache "encrypted with DPAPI by default"; LocalSettings storage location |
| 29 ai-integration | Namespaces moved (`Microsoft.Windows.AI.Text`, `Microsoft.Windows.AI.Imaging`); `IsAvailable/MakeAvailableAsync` replaced by `GetReadyState/EnsureReadyAsync`; tokens/sec and cold-start numbers unsourced |
| 30 accessibility | `FocusVisualKind.None` doesn't exist; `AccessibilitySettings` namespace in the snippet; `Microsoft.TestTools.UiAutomation`; legacy `SystemControl*` brushes; WCAG 2.2 is current |
| 31 localization | Windows App SDK apps use MRT Core `Microsoft.Windows.ApplicationModel.Resources.ResourceLoader`; runtime language switching claims |
| 32 performance | Lines ~188-192 re-teach `ISupportIncrementalLoading` with a hand-built collection; advanced-data-patterns owns incremental loading, so cut to a clause |
| 32 performance | `ItemsVirtualizingStackPanel` doesn't exist; `x:Phase` and phased rendering missing; Native AOT support missing. Lines ~24-38 and ~134-138 re-teach UI virtualization and ItemsRepeater virtualization, which collection-controls owns: cut to clauses. |
| 33 testing | WinAppDriver maintenance status; `WindowsDriver<WindowsElement>` removed in Appium.WebDriver 5 |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

- **1 architecture-and-setup.** The old claim that a `Window` not kept in a field gets garbage-collected and closes wasn't confirmed by any Microsoft source. It was removed; the guide now says only that the template keeps the window in a field so the app can reach it later.
- **4 input-controls.** No Microsoft Learn page states that WinUI 3 input controls lack a validation-error display (evidence is only GitHub issues and the absence of the preview-era validation API). The guide says the current API has no properties for showing validation errors and that apps typically build their own. `RatingControl.Value`'s default is -1 in the API metadata but "null" in the property prose; the guide cites the -1 declaration and says to treat values below zero as unrated.
- **5 text-and-status-controls.** `ProgressRing.IsActive` default conflicts: API metadata declares `true`, API prose says `false`, design guidance says to set it `true`. The guide states the conflict and says to set it explicitly. `TextBlock.IsTextSelectionEnabled` default (off) is not stated on any WinUI 3 page; the guide doesn't lean on it.
- **6 collection-controls.** ListView reorder applying to an `ObservableCollection` as Remove then Add is documented only in a Microsoft Q&A answer and a GitHub issue, not the API docs; the guide states it plainly. The sample binding `object`-typed `SelectedItem` two-way with `x:Bind` to a typed property wasn't compile-checked.

- **7 navigation-controls.** No current Learn page states that a `Frame` builds pages through their parameterless constructor; the guide states it because XAML activation requires one and microsoft-ui-xaml issue #693 confirms it in practice. The current WinUI back-navigation page no longer covers Alt+Left or the mouse back button, so the guide offers wiring them as advice, not as platform guidance. The guide doesn't say a new `Navigate` clears the forward stack, since no WinUI doc states it.
- **8 dialogs-flyouts-commands.** Microsoft's pages conflict on ContentDialog's one-at-a-time scope, and the guide states both readings. The closed-`CommandBarFlyout` accelerator caveat rests only on microsoft-ui-xaml #448 (filed against WinUI 2, still open), so it's worded as a report. No WinAppSDK page states the default of `ShouldConstrainToRootBounds` per flyout type (the UWP page gives true for `Flyout`, false for `MenuFlyout`/`CommandBarFlyout`), so the guide names the property without a default. `XamlUICommand.Command` delegation isn't documented beyond "gets or sets the command behavior", so the guide says it "can hold" a view model command.
- **9 custom-controls.** A library's per-control dictionaries merged into Generic.xaml must use an assembly-qualified `ms-appx:///<Library>/...` Source. This rests on Uno Platform docs and Community Toolkit practice, not a Microsoft Learn page, so the guide states it as practice. How often `OnApplyTemplate` reruns is inconsistent across Microsoft pages: the API summary says whenever `ApplyTemplate` is called, including by a layout pass, while the GoToState page says only on initial load. The guide cites the first and detaches handlers either way. The VS templates page calls the C# "Class Library" only "a .NET class library for sharing code across WinUI apps", so the guide says it is set up for WinUI's XAML without naming properties. The NuGet packaging failure is sourced only to open microsoft-ui-xaml issue #10970.
- **10 data-binding.** A `Window`'s `{x:Bind}` bindings start on its first `Activated` event. That comes from generated `MainWindow.g.cs` code, not a Microsoft page (the in-depth page wrongly says the window's `Loading` event), so the guide states it without citing a source. The built-in `bool` to `Visibility` conversion is documented only on the `{x:Bind}` reference with UWP-era wording, while the in-depth page points to the toolkit converter. The guide scopes it to `{x:Bind}` property bindings, which a local WinUI 3 demo confirms works.
- **11 mvvm-toolkit.** Whether VS 2026's "WinUI Blank App" template targets net10 is disputed: row 1 verified net10 from the start-here page and template package, while a December 2025 Microsoft Q&A thread reports it creating net8.0. The guide says partial properties need C# 14 and tells older target frameworks how to get it, without depending on the template. How an exception rethrown by an async command behaves in WinUI 3 is inconsistent (microsoft-ui-xaml #10964 and #6304, both open), so the guide says it reaches `Application.UnhandledException` and "can terminate the app".

- **12 threading-and-dispatching.** No WinUI 3 page states that a `PropertyChanged` or `CollectionChanged` raised off the UI thread makes the bound control throw. The guide derives it from the DependencyObject threading rule, which matches observed behavior. That the generated `Main` installs `DispatcherQueueSynchronizationContext` comes from generated code, not a Microsoft Learn page. How to put a second UI thread's windows on their own thread isn't documented beyond `DispatcherQueueController`, so the guide names the requirement (own queue and message loop) without a recipe.

- **13 dependency-injection.** No Microsoft page states the order of `Page.OnNavigatedTo` relative to the page's `Loading` event, so the window-scope sample assigns the view model in `OnNavigatedTo` and calls `Bindings.Update()` rather than relying on `{x:Bind}` initializing after it.

- **14 file-and-data-access.** The unpackaged `FutureAccessList.Add` failure rests only on WindowsAppSDK issue #2995, so the guide words it as a report. No Microsoft page states that `FutureAccessList` works or fails without package identity.

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | WinUI Fundamentals | winui-architecture-and-setup.md | Complete |
| 2 | WinUI Fundamentals | winui-xaml-fundamentals.md | Complete |
| 3 | WinUI Fundamentals | winui-layout-system.md | Complete |
| 4 | Controls & UI | winui-input-controls.md | Complete |
| 5 | Controls & UI | winui-text-and-status-controls.md | Complete |
| 6 | Controls & UI | winui-collection-controls.md | Complete |
| 7 | Controls & UI | winui-navigation-controls.md | Complete |
| 8 | Controls & UI | winui-dialogs-flyouts-commands.md | Complete |
| 9 | Controls & UI | winui-custom-controls.md | Complete |
| 10 | Data & MVVM | winui-data-binding.md | Complete |
| 11 | Data & MVVM | winui-mvvm-toolkit.md | Complete |
| 12 | Data & MVVM | winui-threading-and-dispatching.md | Complete |
| 13 | Data & MVVM | winui-dependency-injection.md | Complete |
| 14 | Data & MVVM | winui-file-and-data-access.md | Complete |
| 15 | Data & MVVM | winui-advanced-data-patterns.md | In progress |
| 16 | Styling & Resources | winui-resource-management.md | Not started |
| 17 | Styling & Resources | winui-styling-and-theming.md | Not started |
| 18 | Styling & Resources | winui-animations-and-motion.md | Not started |
| 19 | Window & Input | winui-window-management.md | Not started |
| 20 | Window & Input | winui-input-handling.md | Not started |
| 21 | Platform Integration | winui-app-lifecycle.md | Not started |
| 22 | Platform Integration | winui-notifications.md | Not started |
| 23 | Platform Integration | winui-win32-interop.md | Not started |
| 24 | Platform Integration | winui-packaging-and-deployment.md | Not started |
| 25 | Platform Integration | winui-migration-wpf-uwp.md | Not started |
| 26 | Advanced Features | winui-media-and-graphics.md | Not started |
| 27 | Advanced Features | winui-webview2.md | Not started |
| 28 | Advanced Features | winui-security.md | Not started |
| 29 | Advanced Features | winui-ai-integration.md | Not started |
| 30 | Quality & Testing | winui-accessibility.md | Not started |
| 31 | Quality & Testing | winui-localization.md | Not started |
| 32 | Quality & Testing | winui-performance.md | Not started |
| 33 | Quality & Testing | winui-testing.md | Not started |
