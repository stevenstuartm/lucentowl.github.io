---
title: "Window Management in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Window & Input"
description: "Managing application windows in WinUI 3 using Window, AppWindow, and native APIs for title bar customization, multi-window support, backdrop materials, and window presentation modes."
tags: [winui, winui-3, windowing, desktop, title-bar, mica, acrylic, practical]
---

## The Three Layers of Window Management

WinUI 3 exposes window management through three distinct layers, and each one gives you a different level of control. Knowing which layer to reach for depends on what you need to accomplish.

The first layer is the WinUI 3 `Window` class. This is the XAML-aware surface you work with most directly. It hosts your `Frame`, `Page`, and other XAML content, and it provides high-level properties and events like `Content`, `Activated`, `Closed`, and `SizeChanged`. For most application code, `Window` is the right starting point. It abstracts away lower-level details and integrates cleanly with the XAML rendering lifecycle.

The second layer is `AppWindow`, which comes from the Windows App SDK's windowing namespace. `AppWindow` sits below `Window` and exposes capabilities the XAML layer does not surface directly, including title bar customization, precise size and position control, presentation mode changes, and move and resize events. You obtain an `AppWindow` instance from a `Window` through its `AppWindow` property, introduced in Windows App SDK 1.3. When you need to do more than host XAML content, such as customizing the caption area or switching the window into compact overlay mode, you drop down to this layer.

The third layer is the native `HWND`. WinUI 3 applications run as standard Win32 processes, and every window has an underlying window handle. You retrieve it using `WindowNative.GetWindowHandle(window)` from the `WinRT.Interop` namespace. The HWND is what you pass to Win32 interop APIs, COM interfaces that require a parent window, and third-party libraries that predate WinRT. Most application code should never need to touch the HWND directly, but it is available when platform interop demands it.

---

## Basic Window Configuration

Setting the initial size, position, and title of a window is straightforward through `AppWindow`. A common pattern is to configure these properties in the `Window`'s constructor or in `App.xaml.cs` immediately after creating the main window.

```csharp
// In App.xaml.cs or MainWindow.xaml.cs
var appWindow = this.AppWindow;

appWindow.Title = "My Application";
appWindow.MoveAndResize(new RectInt32(100, 100, 1280, 720));
```

`RectInt32` takes X, Y, width, and height in physical pixels. If you want to size or position based on logical units that account for display scaling, you can query the display information through `DisplayArea.GetFromWindowId(appWindow.Id, DisplayAreaFallback.Primary)` and factor in the scale from `appWindow.ClientSize` relative to the logical dimensions.

Setting the window icon requires the HWND, since `AppWindow` does not expose an icon property directly. You call the `SendMessage` Win32 API with `WM_SETICON` and a handle to the icon resource.

```csharp
var hwnd = WindowNative.GetWindowHandle(this);
var hIcon = PInvoke.LoadImage(
    IntPtr.Zero,
    "Assets/AppIcon.ico",
    IMAGE_TYPE.IMAGE_ICON,
    32, 32,
    IMAGE_FLAGS.LR_LOADFROMFILE
);
PInvoke.SendMessage(new HWND(hwnd), PInvoke.WM_SETICON, new WPARAM(0), new LPARAM(hIcon));
```

For simpler icon scenarios, packaging your application with a properly named `Assets/Square44x44Logo.png` in your package manifest handles the taskbar and title bar icon automatically without any code.

---

## Title Bar Customization

Title bar customization in WinUI 3 comes in two distinct forms. The simpler form leaves the system title bar in place but adjusts its colors to match your application theme. The more involved form removes the system title bar entirely and extends your XAML content into that region.

### Adjusting System Title Bar Colors

When you only need to change the background, foreground, or button hover colors to match a dark or branded theme, you use `AppWindowTitleBar` properties without changing the overall structure of the chrome.

```csharp
var titleBar = this.AppWindow.TitleBar;
titleBar.BackgroundColor = Colors.DarkSlateBlue;
titleBar.ForegroundColor = Colors.White;
titleBar.ButtonBackgroundColor = Colors.DarkSlateBlue;
titleBar.ButtonForegroundColor = Colors.White;
titleBar.ButtonHoverBackgroundColor = Colors.MediumSlateBlue;
titleBar.ButtonHoverForegroundColor = Colors.White;
titleBar.InactiveBackgroundColor = Colors.SlateBlue;
titleBar.ButtonInactiveBackgroundColor = Colors.SlateBlue;
```

This approach has the advantage of keeping the native drag and minimize/maximize/close button behavior intact while giving the title bar a customized appearance.

### Extending into the Title Bar

When you want custom controls such as search boxes, tabs, or back buttons in the title bar region, you extend your XAML canvas into that space. This requires setting `ExtendsContentIntoTitleBar` to `true` and designating a XAML element as the custom drag region.

```csharp
// In MainWindow.xaml.cs constructor
this.AppWindow.TitleBar.ExtendsContentIntoTitleBar = true;
this.SetTitleBar(AppTitleBar); // AppTitleBar is a named XAML element
```

```xml
<!-- MainWindow.xaml -->
<Grid>
    <Grid x:Name="AppTitleBar" Height="48" VerticalAlignment="Top">
        <TextBlock Text="My App" VerticalAlignment="Center" Margin="16,0,0,0"/>
    </Grid>
    <Frame x:Name="ContentFrame" Margin="0,48,0,0"/>
</Grid>
```

`SetTitleBar` marks the entire named element as a draggable region. Any interactive controls you place inside that element, such as buttons or text boxes, will not respond to drag input because the XAML input system defers to the draggable region for those hit tests. To make specific child controls interactive while keeping the surrounding area draggable, you need to use `InputNonClientPointerSource`, which is covered in the section on custom chrome.

The system caption buttons (minimize, maximize, close) remain visible on top of your extended content on the right side. Their positions are exposed through `AppWindow.TitleBar.LeftInset` and `AppWindow.TitleBar.RightInset`, which tell you how many pixels to reserve so your content does not appear underneath them.

---

## Multi-Window Support

WinUI 3 supports creating additional windows by instantiating new `Window` objects. All windows in a WinUI 3 application share the same UI thread, which means you cannot create a window from a background thread without marshalling to the dispatcher. The application remains alive as long as at least one window is open.

```csharp
private void OpenSecondaryWindow()
{
    var secondWindow = new SecondaryWindow();
    secondWindow.Activate();
}
```

Creating a new window is straightforward, but managing its lifetime requires attention. You should hold a reference to secondary windows if you need to interact with them later, since they are otherwise only kept alive by the native window system. When the user closes a secondary window, the `Closed` event fires and the managed object may be collected.

```csharp
private SecondaryWindow? _secondaryWindow;

private void OpenSecondaryWindow()
{
    if (_secondaryWindow == null)
    {
        _secondaryWindow = new SecondaryWindow();
        _secondaryWindow.Closed += (_, _) => _secondaryWindow = null;
    }
    _secondaryWindow.Activate();
}
```

This pattern ensures that opening the secondary window multiple times brings the existing window to focus rather than creating duplicates, and that the reference is cleared when the user closes it.

Secondary windows are independent `Window` instances with their own `AppWindow`, their own title bar, and their own content tree. They can be configured, sized, and positioned independently of the main window.

---

## Presentation Modes

`AppWindowPresenter` controls the overall presentation mode of a window. Three named presenters are available through the Windows App SDK.

`OverlappedPresenter` is the default. It represents a standard resizable, bordered window. You can configure properties like `IsMaximizable`, `IsMinimizable`, `IsResizable`, and `IsAlwaysOnTop` through this presenter.

`FullScreenPresenter` removes all chrome and expands the window to fill the entire screen. This is appropriate for media players, kiosks, or immersive experiences where the window frame would be distracting.

`CompactOverlayPresenter` is the picture-in-picture mode. It renders a small always-on-top window, typically between 160x160 and 500x500 pixels, that floats above all other windows. This is covered in detail in the next section.

Switching between presenters at runtime is done through `AppWindow.SetPresenter`.

```csharp
// Switch to full screen
this.AppWindow.SetPresenter(AppWindowPresenterKind.FullScreen);

// Return to default windowed mode
this.AppWindow.SetPresenter(AppWindowPresenterKind.Default);

// Access presenter properties for the default mode
if (this.AppWindow.Presenter is OverlappedPresenter overlapped)
{
    overlapped.IsResizable = false;
    overlapped.IsAlwaysOnTop = true;
}
```

Calling `SetPresenter(AppWindowPresenterKind.Default)` does not restore the previous presenter's configuration. It creates a new `OverlappedPresenter` with default settings. If you need to preserve custom settings, read them before switching and reapply them when returning.

---

## Compact Overlay

Compact overlay mode keeps a small window on top of all other windows, making it suitable for video players, timers, media controls, and dashboards that users want visible while working in other applications.

You activate it by setting the compact overlay presenter, and you can optionally specify the preferred size.

```csharp
private void EnterCompactOverlay()
{
    var compactPresenter = AppWindowPresenter.CreateForKind(AppWindowPresenterKind.CompactOverlay)
        as CompactOverlayPresenter;

    if (compactPresenter != null)
    {
        compactPresenter.RequestedSize = CompactOverlaySize.Medium; // Small, Medium, or Large
        this.AppWindow.SetPresenter(compactPresenter);
    }
}

private void ExitCompactOverlay()
{
    this.AppWindow.SetPresenter(AppWindowPresenterKind.Default);
}
```

The three size options map to approximate pixel dimensions of 160x160, 240x240, and 500x500 respectively, though the actual size reflects the system's scaling and the window's content constraints. You can refine the size after applying the presenter with `AppWindow.MoveAndResize`.

From a UI design standpoint, compact overlay windows should display only the most essential content. A video thumbnail with playback controls, a countdown timer, or a stock ticker is appropriate. Full navigation, settings panels, or content-heavy views do not fit the compact overlay use case.

---

## Mica and Acrylic Backdrop Materials

WinUI 3 supports system backdrop materials that allow the window background to show content from behind the window or from the desktop wallpaper, creating a sense of depth that integrates the application visually with the Windows environment.

You apply a backdrop material through the `SystemBackdrop` property on the `Window`. The two main options are `MicaBackdrop` and `DesktopAcrylicBackdrop`.

```csharp
// Apply Mica
this.SystemBackdrop = new MicaBackdrop();

// Apply Acrylic
this.SystemBackdrop = new DesktopAcrylicBackdrop();
```

`MicaBackdrop` samples the desktop wallpaper and applies a subtle tint, producing a muted, integrated look that Microsoft uses throughout Windows 11 system applications. Mica is designed for windows that have significant content area and where the background effect supports rather than competes with that content. It requires Windows 11 and falls back gracefully on Windows 10 by rendering the `FallbackColor`.

`DesktopAcrylicBackdrop` shows a blurred, translucent version of whatever is physically behind the window, including other applications and the desktop. It is more visually active than Mica and is better suited to secondary panels, flyouts, or utility windows where the blurred-background effect adds context. Acrylic also works on Windows 10.

Both materials respond automatically to the system's dark and light theme settings and to window focus changes. When the window loses focus, Mica fades to a flat color and Acrylic reduces its opacity; this is intentional system behavior rather than a bug.

If you need a specific fallback for systems where the material is unavailable, you can configure the `FallbackColor`.

```csharp
var micaBackdrop = new MicaBackdrop
{
    Kind = MicaKind.BaseAlt // Slightly darker Mica variant
};
this.SystemBackdrop = micaBackdrop;
```

`MicaKind.Base` is the standard lighter variant. `MicaKind.BaseAlt` applies more tinting and is typically used for sidebar or navigation pane areas rather than main content regions. Microsoft's design guidance recommends `MicaKind.BaseAlt` for `NavigationView`-based layouts where the navigation panel and the content panel should appear as distinct surfaces.

Backdrop materials do not render in the title bar unless you extend content into it. When you set `ExtendsContentIntoTitleBar = true`, the title bar region participates in the backdrop effect, which is how many Windows 11 applications achieve a fully unified material appearance from top to bottom.

---

## Custom Chrome and Draggable Regions

When you extend content into the title bar, the default `SetTitleBar` approach designates an entire XAML element as draggable but makes interactive child controls within it unresponsive to pointer input. For a custom title bar with real controls inside it, such as a back button, search box, or tab strip, you need more precise control over which areas respond to input and which pass through to window dragging.

`InputNonClientPointerSource` from the `Microsoft.UI.Input` namespace provides this control. You register specific rectangular regions as pass-through areas, and pointer input in those areas is handled by the window management system for dragging rather than by your XAML controls.

```csharp
private void SetupCustomTitleBarInput()
{
    var nonClientSource = InputNonClientPointerSource.GetForWindowId(this.AppWindow.Id);

    // Define the full title bar area as draggable
    var titleBarRect = new RectInt32(0, 0, (int)AppTitleBar.ActualWidth, (int)AppTitleBar.ActualHeight);

    // Subtract the interactive control areas from the draggable region
    var backButtonRect = GetElementRect(BackButton);
    var searchBoxRect = GetElementRect(SearchBox);

    nonClientSource.SetRegionRects(NonClientRegionKind.Caption, new[] { titleBarRect });
    nonClientSource.SetRegionRects(NonClientRegionKind.Passthrough, new[] { backButtonRect, searchBoxRect });
}

private RectInt32 GetElementRect(FrameworkElement element)
{
    var transform = element.TransformToVisual(null);
    var bounds = transform.TransformBounds(new Rect(0, 0, element.ActualWidth, element.ActualHeight));
    var scale = this.Content.XamlRoot.RasterizationScale;
    return new RectInt32(
        (int)(bounds.X * scale),
        (int)(bounds.Y * scale),
        (int)(bounds.Width * scale),
        (int)(bounds.Height * scale)
    );
}
```

A few details matter here. The rectangles passed to `SetRegionRects` are in physical pixels, not logical units, so you must multiply logical coordinates by the `RasterizationScale`. You should recalculate and reapply these regions whenever the window resizes, since control positions change with layout. Registering a `SizeChanged` handler on the window that calls your setup method again handles this automatically.

The `NonClientRegionKind.Caption` region is what the system treats as the draggable title bar. Pointer-down events in this region trigger window dragging. The `NonClientRegionKind.Passthrough` regions within it override that behavior for the areas occupied by your controls, allowing normal XAML hit testing to proceed.

This combination, marking the broad region as caption and carving out passthrough areas for interactive controls, is the standard approach for building fully custom title bars in WinUI 3 that mix drag behavior with functional controls.
