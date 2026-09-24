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
| "Which message surface" decision | dialogs-flyouts-commands | text-and-status covers InfoBar and Tooltip only |
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
- **Multiple UI threads.** WinUI 3 supports windows on more than one UI thread (2.5.1 fixed a shutdown crash in that configuration). Don't write "all windows share one UI thread" as a rule.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding.** Re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 4 input-controls | Phase 0 moved in date/time pickers and toolkit SettingsCard/Segmented; integrate into the guide's structure and TOC; SettingsCard sample uses an undeclared `ui:` prefix |
| 11 mvvm-toolkit | Phase 0 moved in "XAML Behaviors"; verify `Microsoft.Xaml.Behaviors.WinUI.Managed` current version and the `BehaviorCollection` wrapper requirement |
| 12 threading-and-dispatching | Seed only. Write the guide around the moved sections: reader question "Which thread may touch the UI, and how does work get back to it?"; `async`/`ConfigureAwait` mechanics are owned by the C# async guide (clause only); includes toolkit `EnqueueAsync`, `DispatcherQueueTimer`, multi-window threads |
| 15 advanced-data-patterns | Phase 0 moved in connectivity detection; it duplicates the existing `ConnectivityMonitor` sample, keep one |
| 16 resource-management | Phase 0 moved in styling's custom theme-resource section; it duplicates the existing ThemeDictionaries section, merge to one |
| 18 animations-and-motion | Phase 0 moved in AnimationBuilder and Lottie; they overlap the existing "Implicit Animations via the Community Toolkit" section, merge; Lottie namespace (`CommunityToolkit.WinUI.Lottie`?) and `AnimatedIcon` claims to verify |
| 21 app-lifecycle | Phase 0 moved in navigation's deep-linking section; merge with the protocol activation section |
| 24 packaging-and-deployment | Phase 0 moved in security's code signing section; merge with "Building MSIX Packages" (both cover signing and certificates) |
| 27 webview2 | Seed only. Write from scratch: WebView2 control, runtime distribution (Evergreen vs fixed), user data folder, navigation events, host-to-web messaging and host objects, security of hosted content |
| 6 collection-controls | ListView's default panel is `ItemsStackPanel`, not `VirtualizingStackPanel`. "MVVM Toolkit's EventToCommandBehavior" doesn't exist. `Grid ColumnDefinitions="Auto, *"` shorthand may not be supported in WinUI 3 (also in data-binding, performance). TreeView Multiple mode "selecting a parent selects children" |
| 9 custom-controls | Round-2 reviewer of row 2 found full "Dependency Properties" and "Attached Properties" sections with `Register`/`RegisterAttached` samples; xaml-fundamentals owns both, so cut to clauses |
| 10 data-binding | WinUI's `CollectionViewSource` has no sort/filter; "MVVM Toolkit ObservableCollection extension that batches" doesn't exist; `UpdateSourceTrigger` default |
| 11 mvvm-toolkit | `AsyncRelayCommand` does not run on a background thread. "Maintained by Microsoft's .NET team". Page constructor injection contradicts dependency-injection |
| 13 dependency-injection | `WizardWindow { DataContext = ... }`: WinUI 3 `Window` has no DataContext |
| 14 file-and-data-access | Windows App SDK 1.8 picker API claims; `ApplicationData.Current` under unpackaged; roaming data status |
| 15 advanced-data-patterns | `IncrementalLoadingBase` in CommunityToolkit.WinUI (the toolkit type is `IncrementalLoadingCollection` with `IIncrementalSource`); `InputValidationCommand` on Control |
| 16 resource-management | "No cycle detection, stack overflow"; "ThemeDictionaries don't fall back"; merged-dictionary search order |
| 18 animations-and-motion | Storyboards can't animate `UIElement.Translation/Scale/Rotation` (not DPs); `ConnectedAnimationService.GetForCurrentView` in WinUI 3; "Fluent five building blocks" |
| 19 window-management | Mica "falls back on Windows 10 by rendering FallbackColor" (MicaBackdrop has no FallbackColor); CompactOverlay pixel sizes; new `TitleBar` control not covered; DesktopAcrylic on Windows 10 |
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
| 32 performance | `ItemsVirtualizingStackPanel` doesn't exist; `x:Phase` and phased rendering missing; Native AOT support missing |
| 33 testing | WinAppDriver maintenance status; `WindowsDriver<WindowsElement>` removed in Appium.WebDriver 5 |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

- **1 architecture-and-setup.** The old claim that a `Window` not kept in a field gets garbage-collected and closes wasn't confirmed by any Microsoft source. It was removed; the guide now says only that the template keeps the window in a field so the app can reach it later.

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | WinUI Fundamentals | winui-architecture-and-setup.md | Complete |
| 2 | WinUI Fundamentals | winui-xaml-fundamentals.md | Complete |
| 3 | WinUI Fundamentals | winui-layout-system.md | Complete |
| 4 | Controls & UI | winui-input-controls.md | Not started |
| 5 | Controls & UI | winui-text-and-status-controls.md | Not started |
| 6 | Controls & UI | winui-collection-controls.md | Not started |
| 7 | Controls & UI | winui-navigation-controls.md | Not started |
| 8 | Controls & UI | winui-dialogs-flyouts-commands.md | Not started |
| 9 | Controls & UI | winui-custom-controls.md | Not started |
| 10 | Data & MVVM | winui-data-binding.md | Not started |
| 11 | Data & MVVM | winui-mvvm-toolkit.md | Not started |
| 12 | Data & MVVM | winui-threading-and-dispatching.md | Not started |
| 13 | Data & MVVM | winui-dependency-injection.md | Not started |
| 14 | Data & MVVM | winui-file-and-data-access.md | Not started |
| 15 | Data & MVVM | winui-advanced-data-patterns.md | Not started |
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
