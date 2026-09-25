---
title: "Window Management in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Window & Input"
description: "Managing WinUI 3 windows through Window, AppWindow, and the native HWND: size, position, icon, and closing, custom title bars with the TitleBar control or by hand, Mica and acrylic backdrops, multiple windows, and full-screen and compact overlay presenters."
tags: [appwindow, title-bar, system-backdrop, multi-window, compact-overlay, practical]
---

## Three Layers of a Window

A WinUI 3 window is three objects, each owning a different part of what the user sees:

| Layer | What it is | Reach for it to |
| --- | --- | --- |
| `Window` (`Microsoft.UI.Xaml`) | The XAML host: holds the `Content` tree, the backdrop, and window events such as `Activated` and `Closed` | Set content, respond to activation, apply a backdrop, use a custom title bar element |
| `AppWindow` (`Microsoft.UI.Windowing`) | The Windows App SDK's view of the top-level window | Size, position, icon, title bar colors and height, presenters (normal, full-screen, or picture-in-picture), closing |
| `HWND` | The Win32 window handle underneath both | Call Win32 or COM APIs that need a parent window |

`window.AppWindow` returns the `AppWindow` for a XAML window, and `WindowNative.GetWindowHandle(window)` in `WinRT.Interop` returns its `HWND`. Most code stays in the first two layers. A `Window` is not a `FrameworkElement`, so it has no `Resources`, `DataContext`, or `RequestedTheme` of its own, and those go on its root element.

---

## Size, Position, Icon, and Closing

`AppWindow` works in physical screen pixels:

```csharp
public MainWindow()
{
    InitializeComponent();

    AppWindow.Title = "Order Desk";
    AppWindow.MoveAndResize(new RectInt32(100, 100, 1280, 800));
    AppWindow.SetIcon("Assets/AppIcon.ico");

    if (AppWindow.Presenter is OverlappedPresenter presenter)
    {
        presenter.PreferredMinimumWidth = 640;
        presenter.PreferredMinimumHeight = 480;
    }
}
```

XAML lays out in effective pixels, the device-independent units that scale with the display. On a display scaled to 150%, 1280 physical pixels is about 853 effective pixels, so a size chosen to fit a layout is multiplied by the scale first. Once content has loaded, `Content.XamlRoot.RasterizationScale` gives that scale. `Resize` changes only the size and `Move` only the position, and `ResizeClient` sizes the area inside the frame instead of the whole window.

A fixed position like the one above can land off-screen on another machine. `DisplayArea.GetFromWindowId(AppWindow.Id, DisplayAreaFallback.Nearest)` returns the display the window is on, and its `WorkArea` is that display minus the taskbar, which is what centering calculates against:

```csharp
DisplayArea display = DisplayArea.GetFromWindowId(AppWindow.Id, DisplayAreaFallback.Nearest);
RectInt32 work = display.WorkArea;
AppWindow.Move(new PointInt32(
    work.X + (work.Width - AppWindow.Size.Width) / 2,
    work.Y + (work.Height - AppWindow.Size.Height) / 2));
```

Restoring the window where the user left it is the app's job. The platform's placement-persistence APIs are still experimental, so an app saves `AppWindow.Position` and `AppWindow.Size` when the window closes and passes them to `MoveAndResize` at the next start, after checking that the saved rectangle still falls within a connected display.

`SetIcon` sets the window's icon, and its string overload takes the path to an `.ico` file. `SetTitleBarIcon` and `SetTaskbarIcon` set the two places separately. `PreferredMinimumWidth` and `PreferredMinimumHeight`, with maximum counterparts, arrived in Windows App SDK 1.7. Before that, a minimum size meant handling Win32 messages.

Closing has two events. `AppWindow.Closing` fires when the user closes the window through the system, with the close button or Alt+F4, and setting `args.Cancel` keeps it open. It's the documented way to stop a close, and the place to ask about unsaved work:

```csharp
AppWindow.Closing += async (sender, args) =>
{
    if (!ViewModel.HasUnsavedChanges) return;

    args.Cancel = true;
    if (await ConfirmDiscardAsync())
    {
        ViewModel.DiscardChanges();
        Close();
    }
};
```

The handler cancels first because the decision needs an `await`, and it calls `Close()` itself once the user agrees. `DiscardChanges` clears `HasUnsavedChanges`, so if `Close()` raises `Closing` again, the handler lets it through instead of asking twice. `Window.Closed` is documented as firing once the window has closed, and is for releasing what the window held. When the last window closes, the app's message loop ends by default.

---

## Custom Title Bars

An app has three levels of title bar customization, from recoloring the system title bar to replacing it entirely.

### Recoloring the System Title Bar

`AppWindow.TitleBar` exposes colors for the title bar background and text and for each state of the caption buttons, the minimize, maximize, and close buttons at the right. `IsCustomizationSupported` returns `true` on Windows 11 and, from Windows App SDK 1.2, on Windows 10, but Windows 10 ignores the colors:

```csharp
if (AppWindowTitleBar.IsCustomizationSupported())
{
    AppWindowTitleBar titleBar = AppWindow.TitleBar;
    titleBar.BackgroundColor = Colors.DarkSlateBlue;
    titleBar.ForegroundColor = Colors.White;
    titleBar.ButtonBackgroundColor = Colors.DarkSlateBlue;
    titleBar.ButtonHoverBackgroundColor = Colors.MediumSlateBlue;
}
```

These colors ignore transparency, apart from the caption button backgrounds once content is extended into the title bar, as described below. They're fixed values, so an app that switches themes updates them itself.

### The TitleBar Control

Replacing the title bar with XAML means hiding the system one and telling the window which element acts as the title bar. WinUI's `TitleBar` control does most of that work. It lays out an optional back button and pane toggle button, an icon, a title and subtitle, and slots for custom content such as a search box, and it reserves space for the caption buttons and a minimum drag area:

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto" />
        <RowDefinition Height="*" />
    </Grid.RowDefinitions>

    <TitleBar x:Name="AppTitleBar" Title="Order Desk" Subtitle="Preview"
              IsBackButtonVisible="True"
              IsBackButtonEnabled="{x:Bind RootFrame.CanGoBack, Mode=OneWay}"
              BackRequested="AppTitleBar_BackRequested">
        <TitleBar.IconSource>
            <ImageIconSource ImageSource="ms-appx:///Assets/AppIcon.png" />
        </TitleBar.IconSource>
        <AutoSuggestBox PlaceholderText="Search orders" Width="320" />
    </TitleBar>

    <Frame x:Name="RootFrame" Grid.Row="1" />
</Grid>
```

```csharp
public MainWindow()
{
    InitializeComponent();
    ExtendsContentIntoTitleBar = true;
    SetTitleBar(AppTitleBar);
}
```

`ExtendsContentIntoTitleBar` is set in code, early in the constructor. Setting it in XAML fails, and setting it later can flash the system title bar first. The control first shipped in Windows App SDK 1.7. From 2.1 it works out its drag regions itself, so the search box receives clicks and the empty space around it drags the window. On earlier versions, interactive content placed in it may need passthrough regions set by hand, as described next. With a `NavigationView` below it, Microsoft's guidance is to hide the navigation view's own back and pane buttons and use the title bar's, forwarding its `BackRequested` and `PaneToggleRequested` events.

### Building One by Hand

Without the control, `SetTitleBar` accepts any element once `ExtendsContentIntoTitleBar` is `true`, and the system treats the whole element as the drag area. Interactive content inside it needs its areas marked as passthrough with `InputNonClientPointerSource`. The rectangles are in physical pixels measured from the top-left of the window's client area, not the screen coordinates `Move` uses:

```csharp
public MainWindow()
{
    InitializeComponent();
    ExtendsContentIntoTitleBar = true;
    SetTitleBar(AppTitleBar);
    AppTitleBar.Loaded += (_, _) => SetPassthroughRegions();
    AppTitleBar.SizeChanged += (_, _) => SetPassthroughRegions();
}

private void SetPassthroughRegions()
{
    double scale = AppTitleBar.XamlRoot.RasterizationScale;
    var source = InputNonClientPointerSource.GetForWindowId(AppWindow.Id);
    source.SetRegionRects(NonClientRegionKind.Passthrough, [GetRect(SearchBox, scale)]);
}

private static RectInt32 GetRect(FrameworkElement element, double scale)
{
    Rect bounds = element.TransformToVisual(null)
        .TransformBounds(new Rect(0, 0, element.ActualWidth, element.ActualHeight));
    return new RectInt32(
        (int)Math.Round(bounds.X * scale), (int)Math.Round(bounds.Y * scale),
        (int)Math.Round(bounds.Width * scale), (int)Math.Round(bounds.Height * scale));
}
```

{% include figure.html id="winui-title-bar-regions" %}

Microsoft's guidance is to compute these regions first when the title bar element has loaded, then again in the title bar element's own `SizeChanged` handler, as the constructor wires up. The window's `Changed` event can fire before the title bar has resized, such as on maximize, and gives stale positions. Other details come from `AppWindow.TitleBar`. `LeftInset` and `RightInset` give the space the caption buttons take, reserved with padding columns so right-to-left layouts work too. Setting `PreferredHeightOption` to `Tall`, allowed only after extending into the title bar, makes the caption buttons match a 48-pixel title bar that holds interactive content. With content extended, the caption button backgrounds can also be transparent so the backdrop shows through.

---

## Mica and Acrylic Backdrops

A window's `SystemBackdrop` fills its background with a material:

```xml
<Window.SystemBackdrop>
    <MicaBackdrop Kind="BaseAlt" />
</Window.SystemBackdrop>
```

| Backdrop | Look | Microsoft's guidance |
| --- | --- | --- |
| `MicaBackdrop` | Opaque, tinted by the desktop wallpaper, sampled once | The base layer of long-lived windows such as the main app window |
| `MicaBackdrop Kind="BaseAlt"` | Mica with stronger tinting | Windows that need contrast between the title bar and commanding areas, typically a tabbed title bar |
| `DesktopAcrylicBackdrop` | Semi-transparent frosted glass over what's behind the window | Transient surfaces such as flyouts and popups, which also have a `SystemBackdrop` property |

Mica shows only where nothing opaque sits on top of it. Elements between the window and the content that should reveal it need transparent backgrounds, and Microsoft's layering guidance puts content areas on `LayerFillColorDefaultBrush`, a low-opacity fill that keeps the material faintly visible. A window that extends into the title bar lets Mica run from top to bottom, which is how Microsoft recommends showing it.

Mica turns into a solid color, `SolidBackgroundFillColorBase` or its `Alt` counterpart, when the window is inactive, when transparency effects are off, in Battery Saver, on low-end hardware, and on Windows versions before Windows 11. In a contrast theme, the user's chosen background color replaces it.

Since Windows App SDK 2.0, `SystemBackdropElement` puts a backdrop material behind one region of a page, such as a card, rather than the whole window. For control over tint and fallback colors, `MicaController` and `DesktopAcrylicController` in `Microsoft.UI.Composition.SystemBackdrops` expose those settings, at the cost of wiring up activation and theme changes by hand.

---

## Multiple Windows

A second window is a new `Window` object, activated like the first:

```csharp
private ReportWindow? _reportWindow;

private void ShowReport()
{
    if (_reportWindow is null)
    {
        _reportWindow = new ReportWindow();
        _reportWindow.Closed += (_, _) => _reportWindow = null;
    }
    _reportWindow.Activate();
}
```

Keeping the reference lets a second click bring the existing window forward instead of opening a duplicate, and the `Closed` handler clears it. Each window has its own `AppWindow`, title bar, backdrop, and content tree with its own `XamlRoot`, which is why a dialog or picker must be told which window it belongs to.

By default, a new window runs on the UI thread of the code that created it, so windows created from the main window share one thread and one slow handler freezes them all. WinUI can also run windows on separate UI threads, each with its own dispatcher queue and message loop.

---

## Presenters

An `AppWindow`'s presenter decides what kind of window it is. `SetPresenter` switches between the three kinds:

```csharp
AppWindow.SetPresenter(AppWindowPresenterKind.FullScreen);   // no frame, fills the display
AppWindow.SetPresenter(AppWindowPresenterKind.Default);      // back to a normal window
```

`OverlappedPresenter` is the normal resizable window, and its properties control what the user can do with it, such as `IsResizable`, `IsMaximizable`, `IsMinimizable`, and `IsAlwaysOnTop`, along with `Maximize()`, `Minimize()`, and `Restore()`. `OverlappedPresenter.CreateForDialog()` and `CreateForToolWindow()` start from settings suited to those roles. A dialog-style presenter doesn't make the window modal. `IsModal = true` throws unless the window has an owner, and giving a XAML window an owner goes through Win32 interop. `FullScreenPresenter` removes the frame for media playback, presentations, or kiosks.

`CompactOverlayPresenter` is picture-in-picture, a small window kept above all others, for a video, a timer, or a call. Its `InitialSize` picks the starting size as a share of the display's work area, about 5% for `Small`, 15% for `Medium`, and 25% for `Large`:

```csharp
var overlay = CompactOverlayPresenter.Create();
overlay.InitialSize = CompactOverlaySize.Medium;
AppWindow.SetPresenter(overlay);
```

A custom title bar needs attention when the presenter changes, since a full-screen window has no title bar to show and a compact overlay window has little room for one. `AppWindow.Changed` reports the switch through `args.DidPresenterChange`, which is where the app hides its title bar element or restores it and resets `ExtendsContentIntoTitleBar`.

A compact overlay window has room for one thing, such as a video with its play button, so the app usually swaps in a reduced view when it enters the mode and restores the full one when it returns to `Default`.
