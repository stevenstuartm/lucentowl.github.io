# WinUI 3 Study Guides Plan

## Overview

33 study guides covering WinUI 3 comprehensively, organized into 5 phases.

- **Category**: `"WinUI 3"`
- **Directory**: `_guides/dotnet/winui/`
- **File prefix**: `winui-`
- **Layout**: `guide`

---

## Phase 1: Foundations (7 guides)

| # | Filename | Subcategory | Title | Status |
|---|----------|-------------|-------|--------|
| 1 | `winui-architecture-and-setup.md` | WinUI Fundamentals | WinUI 3 Architecture and Project Setup | pending |
| 2 | `winui-xaml-fundamentals.md` | WinUI Fundamentals | XAML Fundamentals in WinUI 3 | pending |
| 3 | `winui-layout-system.md` | WinUI Fundamentals | WinUI 3 Layout System | pending |
| 4 | `winui-input-controls.md` | Controls & UI | Basic Input Controls in WinUI 3 | pending |
| 5 | `winui-text-and-status-controls.md` | Controls & UI | Text, Status, and Information Controls | pending |
| 6 | `winui-collection-controls.md` | Controls & UI | Collection Controls in WinUI 3 | pending |
| 7 | `winui-navigation-controls.md` | Controls & UI | Navigation Controls and Patterns | pending |

**Topics covered**:
- Windows App SDK architecture, WinUI 3 vs WPF/UWP, project structure, App.xaml
- XAML syntax, namespaces, markup extensions, x:Bind, dependency properties
- Layout panels (Grid, StackPanel, RelativePanel, Canvas), margin/padding, responsive layout
- Buttons, toggles, sliders, text inputs, NumberBox, AutoSuggestBox
- TextBlock, RichTextBlock, ProgressBar/Ring, InfoBar, Tooltip, date/time pickers
- ListView, GridView, TreeView, FlipView, ItemsRepeater
- NavigationView, TabView, BreadcrumbBar, Frame/Page navigation

---

## Phase 2: Core Patterns (6 guides)

| # | Filename | Subcategory | Title | Status |
|---|----------|-------------|-------|--------|
| 8 | `winui-dialogs-flyouts-commands.md` | Controls & UI | Dialogs, Flyouts, and Command Surfaces | pending |
| 9 | `winui-data-binding.md` | Data & MVVM | Data Binding in WinUI 3 | pending |
| 10 | `winui-mvvm-toolkit.md` | Data & MVVM | MVVM Pattern with CommunityToolkit.Mvvm | pending |
| 11 | `winui-dependency-injection.md` | Data & MVVM | Dependency Injection in WinUI 3 | pending |
| 12 | `winui-styling-and-theming.md` | Styling & Resources | Styling, Theming, and Fluent Design | pending |
| 13 | `winui-resource-management.md` | Styling & Resources | Resource Management in WinUI 3 | pending |

**Topics covered**:
- ContentDialog, Flyout, MenuFlyout, TeachingTip, MenuBar, CommandBar, CommandBarFlyout
- Binding modes, INotifyPropertyChanged, ObservableCollection, converters, DataTemplates, CollectionViewSource
- ObservableObject, ObservableProperty, RelayCommand, AsyncRelayCommand, IMessenger, source generators
- Microsoft.Extensions.DependencyInjection, Microsoft.Extensions.Hosting, service registration
- Styles, implicit styles, lightweight styling, control templates, Fluent Design, theme switching
- ResourceDictionary, merged dictionaries, StaticResource vs ThemeResource, scoping

---

## Phase 3: Interaction & Media (6 guides)

| # | Filename | Subcategory | Title | Status |
|---|----------|-------------|-------|--------|
| 14 | `winui-window-management.md` | Window & Input | Window Management in WinUI 3 | pending |
| 15 | `winui-input-handling.md` | Window & Input | Input Handling and Gestures | pending |
| 16 | `winui-custom-controls.md` | Controls & UI | Building Custom Controls | pending |
| 17 | `winui-animations-and-motion.md` | Styling & Resources | Animations and Motion | pending |
| 18 | `winui-media-and-graphics.md` | Advanced Features | Media, Graphics, and the Visual Layer | pending |
| 19 | `winui-notifications.md` | Platform Integration | App Notifications in WinUI 3 | pending |

**Topics covered**:
- Window/AppWindow, title bar customization, multi-window, presenters, Mica/Acrylic materials
- Pointer events, gesture recognition, keyboard input, focus management, XamlUICommand
- UserControl, templated controls, attached properties, Generic.xaml
- Storyboarded, connected, implicit animations, VisualStateManager, composition animations
- MediaPlayerElement, InkCanvas, shapes, composition visual layer, printing
- Toast notifications, badge notifications, system tray via Win32 interop

---

## Phase 4: Data & Platform (6 guides)

| # | Filename | Subcategory | Title | Status |
|---|----------|-------------|-------|--------|
| 20 | `winui-file-and-data-access.md` | Data & MVVM | File and Data Access | pending |
| 21 | `winui-networking.md` | Platform Integration | Networking and Remote Communication | pending |
| 22 | `winui-app-lifecycle.md` | Platform Integration | App Lifecycle and Activation | pending |
| 23 | `winui-packaging-and-deployment.md` | Platform Integration | Packaging and Deployment | pending |
| 24 | `winui-win32-interop.md` | Platform Integration | Win32 Interop and Native Access | pending |
| 25 | `winui-migration-wpf-uwp.md` | Platform Integration | Migration from WPF and UWP | pending |

**Topics covered**:
- File pickers, SQLite/EF Core, ApplicationData, drag & drop, clipboard
- HttpClient, gRPC, WebSocket
- Activation, instancing, background tasks, power management, app restart/recovery
- MSIX packaging, unpackaged deployment, self-contained, Store/sideloading
- CsWin32, HWND access, COM interop, XAML Islands
- UWP migration, WPF migration, feature gaps and workarounds

---

## Phase 5: Quality & Ecosystem (8 guides)

| # | Filename | Subcategory | Title | Status |
|---|----------|-------------|-------|--------|
| 26 | `winui-accessibility.md` | Quality & Testing | Accessibility in WinUI 3 | pending |
| 27 | `winui-localization.md` | Quality & Testing | Localization and Globalization | pending |
| 28 | `winui-performance.md` | Quality & Testing | Performance Optimization | pending |
| 29 | `winui-testing.md` | Quality & Testing | Testing WinUI 3 Applications | pending |
| 30 | `winui-community-toolkit.md` | Advanced Features | Windows Community Toolkit | pending |
| 31 | `winui-advanced-data-patterns.md` | Data & MVVM | Advanced Data Patterns | pending |
| 32 | `winui-security.md` | Advanced Features | Security and Credential Management | pending |
| 33 | `winui-ai-integration.md` | Advanced Features | Windows AI Integration | pending |

**Topics covered**:
- Automation peers, screen readers, keyboard navigation, high contrast
- .resw files, x:Uid, RTL support, formatting, WinUI3Localizer
- UI virtualization, deferred loading, x:Bind performance, profiling, resource optimization
- MSTest/UITestMethod, ViewModel testing, WinAppDriver, integration testing
- Additional controls, behaviors, animations helpers, Lottie-Windows
- Incremental loading, data validation (INotifyDataErrorInfo), caching/offline
- Credential Locker, WebAuthenticationBroker, code signing
- Phi Silica, Windows AI APIs, LoRA fine-tuning

---

## Subcategory Summary

| Subcategory | Description | Guide Count |
|-------------|-------------|-------------|
| WinUI Fundamentals | Architecture, XAML, and layout foundations | 3 |
| Controls & UI | Built-in and custom controls for building interfaces | 5 |
| Data & MVVM | Data binding, MVVM pattern, dependency injection, and data access | 5 |
| Styling & Resources | Visual styling, theming, resources, and animations | 3 |
| Window & Input | Window management, input handling, and gestures | 2 |
| Platform Integration | Lifecycle, packaging, interop, networking, migration, notifications | 6 |
| Quality & Testing | Accessibility, localization, performance, and testing | 4 |
| Advanced Features | Community Toolkit, media, security, and AI integration | 5 |

---

## Orchestration Process

### Per-Phase Workflow

1. **Spawn Sonnet agents** (one per guide, in parallel)
   - Each agent creates one guide file in `_guides/dotnet/winui/`
   - Agent references existing guide format (front matter, prose style, content standards)
   - Agent runs `python lint_content.py <filepath>` to self-validate
   - Agent fixes any linting issues found
   - Agent touches NOTHING outside of its own guide file

2. **Main context validation** (after all agents in phase complete)
   - Lint each guide: `python lint_content.py <filepath>`
   - Validate front matter (layout, category, subcategory, description, tags)
   - Verify content quality and structure
   - Fix any remaining issues

3. **Config update** (after phase validation)
   - Add all completed guides to `assets/data/study_guides_config.json`
   - Verify config JSON is valid

4. **Mark phase complete** and proceed to next phase
