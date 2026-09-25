---
title: "Win32 Interop and Native Access"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Reaching below WinUI 3: window handles and WindowId, WinRT APIs in a desktop app, CsWin32 declarations, receiving window messages by subclassing, and hosting WinUI 3 inside Win32, WPF, or WinForms apps with XAML Islands."
tags: [advanced, win32, hwnd, cswin32, window-subclassing, xaml-islands, desktopwindowxamlsource]
---

## Table of Contents

- [Where WinUI Ends and Win32 Begins](#where-winui-ends-and-win32-begins)
- [From a Window to Its Handle](#from-a-window-to-its-handle)
- [Calling WinRT APIs from a Desktop App](#calling-winrt-apis-from-a-desktop-app)
- [Declaring Win32 Functions with CsWin32](#declaring-win32-functions-with-cswin32)
- [Receiving Window Messages](#receiving-window-messages)
- [Hosting WinUI in an Existing App with XAML Islands](#hosting-winui-in-an-existing-app-with-xaml-islands)


## Where WinUI Ends and Win32 Begins

A WinUI 3 app is an ordinary Win32 process. Its windows are standard top-level windows with handles, its UI thread runs a Win32 message loop, and the whole native API surface is available to it. That surface has three layers: the flat C functions of Win32, COM (Windows' older object model, where components are created by a class ID and used through interfaces), and WinRT (the newer object model behind the `Windows.*` namespaces). What WinUI adds is a layer on top, not a sandbox around it.

That layer covers most needs, so check it before reaching lower. The Windows App SDK already wraps many things that once required Win32:

| Need | Windows App SDK API |
|---|---|
| Window icon, size, position, title bar, and presenters (overlapped, full screen, compact overlay) | `AppWindow` |
| File and folder pickers | `Microsoft.Windows.Storage.Pickers` |
| Notifications, badges | `AppNotificationManager`, `BadgeNotificationManager` |
| Power and battery state | `PowerManager` |

Some features still have no WinRT or Windows App SDK equivalent and go through Win32 directly. System-wide hotkeys (`RegisterHotKey`), flashing the taskbar button (`FlashWindowEx`), progress on the taskbar button (the `ITaskbarList3` COM interface), a notification-area icon (`Shell_NotifyIcon`), and responding to window messages, the notifications Windows sends to a window such as `WM_QUERYENDSESSION` at sign-out, all live there. The rest of this guide covers the plumbing those need: a window handle, declarations for the native functions, and a way to receive the messages Win32 sends back.


## From a Window to Its Handle

Win32 identifies a window by its handle, an `HWND`. The Windows App SDK identifies it by a `WindowId`, which is what `AppWindow` and the newer SDK APIs take. A WinUI `Window` gives you either:

```csharp
using Microsoft.UI;
using WinRT.Interop;

IntPtr hwnd = WindowNative.GetWindowHandle(this);            // this: a WinUI Window
WindowId windowId = Win32Interop.GetWindowIdFromWindow(hwnd); // or this.AppWindow.Id
```

`Win32Interop.GetWindowFromWindowId` goes the other way, and `AppWindow.GetFromWindowId` gets the `AppWindow` for any window id.

### WinRT Objects That Need an Owner Window

Many WinRT classes were written for UWP, where every UI thread had a `CoreWindow` they could attach their dialogs to. A desktop app has no `CoreWindow`, so these classes need to be told which window owns them before they show anything. Classes that implement `IInitializeWithWindow`, including the older `Windows.Storage.Pickers` pickers, `MessageDialog`, `DevicePicker`, `GraphicsCapturePicker`, `StoreContext`, and `LauncherOptions`, take the handle through `InitializeWithWindow.Initialize`:

```csharp
var picker = new Windows.Graphics.Capture.GraphicsCapturePicker();
InitializeWithWindow.Initialize(picker, WindowNative.GetWindowHandle(this));
GraphicsCaptureItem? item = await picker.PickSingleItemAsync();
```

Others have their own interop interface with a `...ForWindow` method instead. Sharing is the common one. A desktop app calls `IDataTransferManagerInterop.ShowShareUIForWindow` rather than `DataTransferManager.ShowShareUI`, and print, the input pane, and the system media transport controls follow the same pattern. Microsoft's list of these classes is explicitly incomplete, so the reliable check is whether a class's reference page mentions `IInitializeWithWindow` or an interop interface. Prefer the Windows App SDK replacement where one exists. The `Microsoft.Windows.Storage.Pickers` pickers take a `WindowId` in their constructor and need none of this.


## Calling WinRT APIs from a Desktop App

A WinUI 3 project reaches the operating system's WinRT APIs (the `Windows.*` namespaces) through its target framework moniker. `net10.0-windows10.0.26100.0` compiles against the API set of that Windows version, through a reference package the SDK adds automatically. The `Microsoft.Windows.SDK.Contracts` NuGet package that older articles mention is only for .NET Framework and .NET Core 3.x projects.

Two limits apply to a desktop app:

- **Some WinRT APIs don't work outside UWP.** Classes built around `CoreWindow`, `CoreApplicationView`, or `ApplicationView` aren't supported, and neither are the per-view `GetForCurrentView` methods common in UWP code. Some of those return null, and some also throw. Also, `Windows.UI.Xaml`, `Windows.UI.Colors`, and most of `Windows.UI.Text` are unsupported in .NET 6 and later in favor of their `Microsoft.UI` counterparts. Microsoft keeps a list of [WinRT APIs not supported in desktop apps](https://learn.microsoft.com/windows/apps/desktop/modernize/winrt-api-desktop-app-support){:target="_blank" rel="noopener noreferrer"}.
- **The version in the moniker isn't the version the app requires.** It sets which APIs compile, while `SupportedOSPlatformVersion` sets the oldest Windows the app runs on. When the two differ, the compiler warns (CA1416) at each call to an API newer than the minimum. Guard those calls at run time with `ApiInformation.IsTypePresent`, `IsMethodPresent`, or `IsApiContractPresent`, or with .NET's `OperatingSystem.IsWindowsVersionAtLeast`:

```csharp
if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22000))
{
    // Windows 11 only
}
```


## Declaring Win32 Functions with CsWin32

Calling a Win32 function from C# goes through platform invoke (P/Invoke), which needs a declaration of the function's signature. Writing those by hand means getting every parameter type, struct layout, and constant right. [CsWin32](https://github.com/microsoft/CsWin32){:target="_blank" rel="noopener noreferrer"}, the `Microsoft.Windows.CsWin32` package, generates them from Windows' own API metadata instead. List what you need, one name per line, in a `NativeMethods.txt` file:

```
RegisterHotKey
UnregisterHotKey
FlashWindowEx
ITaskbarList3
WM_HOTKEY
```

At build time it generates a static `PInvoke` class with the functions, the constants, and typed wrappers such as `HWND`, plus enums and structs they use. COM interfaces like `ITaskbarList3` work the same way. The typed handles mean passing an `HWND` where Win32 expects one, instead of an `IntPtr` that could hold anything.

For functions the metadata doesn't cover, declare them by hand with `LibraryImport` or `DllImport`. The mechanics of those declarations, `SafeHandle`, and COM wrappers are the same as in any .NET app. One WinUI-specific point matters. Current WinUI templates trim published apps, removing code the build can't see being used, and an app may opt into Native AOT, which compiles it ahead of time to native code. Native AOT doesn't support .NET's built-in COM interop (`[ComImport]` interfaces), so a COM interface used in an AOT app needs the source-generated form (`[GeneratedComInterface]`) instead.


## Receiving Window Messages

Some Win32 features answer through window messages. A registered hotkey arrives as `WM_HOTKEY`, sign-out as `WM_QUERYENDSESSION`, an Explorer restart as the `TaskbarCreated` broadcast. WinUI doesn't expose its window procedure, the function Windows calls for every message to a window. To see these messages, the app subclasses the window: it installs its own procedure in front of WinUI's with `SetWindowSubclass`, handles the messages it cares about, and passes everything to `DefSubclassProc` so WinUI still gets every message.

The sample declares the functions by hand with `DllImport` so their signatures are visible on the page. CsWin32 can generate all of them from `NativeMethods.txt`.

```csharp
internal static partial class Native
{
    public const uint WM_HOTKEY = 0x0312;
    public const uint MOD_ALT = 0x0001, MOD_CONTROL = 0x0002;

    public delegate nint SubclassProc(nint hwnd, uint msg, nint wParam, nint lParam,
                                      nuint idSubclass, nuint refData);

    [DllImport("comctl32.dll")]
    public static extern bool SetWindowSubclass(nint hwnd, SubclassProc proc, nuint id, nuint refData);

    [DllImport("comctl32.dll")]
    public static extern bool RemoveWindowSubclass(nint hwnd, SubclassProc proc, nuint id);

    [DllImport("comctl32.dll")]
    public static extern nint DefSubclassProc(nint hwnd, uint msg, nint wParam, nint lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool RegisterHotKey(nint hwnd, int id, uint modifiers, uint vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(nint hwnd, int id);
}

public sealed partial class MainWindow : Window
{
    private const int QuickCaptureHotKey = 1;
    private readonly Native.SubclassProc _subclassProc; // a field keeps the delegate alive
    private readonly nint _hwnd;

    public MainWindow()
    {
        InitializeComponent();
        _hwnd = WindowNative.GetWindowHandle(this);
        _subclassProc = OnWindowMessage;
        Native.SetWindowSubclass(_hwnd, _subclassProc, 1, 0);

        if (!Native.RegisterHotKey(_hwnd, QuickCaptureHotKey,
                Native.MOD_CONTROL | Native.MOD_ALT, 0x4B /* K */))
        {
            // Another app already owns Ctrl+Alt+K: offer the user another shortcut
            ReportHotKeyConflict();
        }

        Closed += (_, _) =>
        {
            Native.UnregisterHotKey(_hwnd, QuickCaptureHotKey);
            Native.RemoveWindowSubclass(_hwnd, _subclassProc, 1);
        };
    }

    private nint OnWindowMessage(nint hwnd, uint msg, nint wParam, nint lParam,
                                 nuint idSubclass, nuint refData)
    {
        if (msg == Native.WM_HOTKEY && wParam == QuickCaptureHotKey)
        {
            ShowQuickCapture();
        }
        return Native.DefSubclassProc(hwnd, msg, wParam, lParam);
    }
}
```

Three details make or break this:

- **Keep the delegate alive.** Windows holds only a native pointer to the procedure. If the delegate is a local that the garbage collector reclaims, the next message calls freed memory and crashes the app. Store it in a field for as long as the subclass is installed.
- **Always call `DefSubclassProc`** for messages you don't fully handle, and usually for those you do. Swallowing a message WinUI needs, such as a size or activation message, breaks the window in ways that are hard to trace back.
- **Everything happens on the UI thread.** Windows delivers a window's messages on the thread that created it, which for a WinUI window is its UI thread, so the handler can touch UI directly, and it must not block. The subclass helpers don't work across threads either, so call `SetWindowSubclass` and `RemoveWindowSubclass` from that thread too.

`RegisterHotKey` fails if another app already holds the combination, which is why the sample checks its result.


## Hosting WinUI in an Existing App with XAML Islands

The earlier sections reach from WinUI down into Win32. XAML Islands go the other way. They put WinUI 3 content inside an app built on something else: a C++ Win32 app, WPF, or WinForms. An existing app can then adopt WinUI one region at a time, replacing a settings page or a new feature panel while the rest keeps running unchanged.

The Windows App SDK's hosting API, stable since version 1.4, lives in `Microsoft.UI.Xaml.Hosting`. Any control that derives from `Microsoft.UI.Xaml.UIElement` can be hosted in any part of the app that has an `HWND`. A WinUI app gets a lot of setup from its template that a host app doesn't have, so the host does that setup itself. Microsoft's WinForms islands sample shows the full sequence.

### Setting Up the Host Thread

Everything WinUI needs is per UI thread: one set of setup per thread, then as many islands on it as the app wants. In the host's `Main`, before its own message loop starts:

1. **Create a `DispatcherQueue`**, the work queue WinUI uses to run code on a UI thread, with `DispatcherQueueController.CreateOnCurrentThread()`. WinUI's XAML runtime on a thread lives and dies with that queue.
2. **Create a XAML `Application` object.** Controls, theme resources, and XAML type lookup all depend on one. The sample's `XamlApp` derives from `Microsoft.UI.Xaml.Application`, calls `WindowsXamlManager.InitializeForCurrentThread()` in its constructor, merges `XamlControlsResources` so controls get their default styles, and implements `IXamlMetadataProvider` to answer type lookups from each library of WinUI controls the host uses. Without a library's provider, loading its controls throws a `XamlParseException`.
3. **Let WinUI see messages first.** The host's message loop has to pass each message to WinUI before dispatching it, so WinUI can handle keyboard accelerators and focus navigation. A C++ host calls `ContentPreTranslateMessage` in its `GetMessage` loop. The sample's WinForms host hooks the same function into the WinForms loop through a helper.
4. **Shut down on exit.** When the host's message loop ends, call `ShutdownQueue()` on the `DispatcherQueueController`, which tears down the WinUI objects on the thread.

### Creating an Island

With the thread set up, each island takes a few lines:

```csharp
_island = new DesktopWindowXamlSource();
_island.Initialize(Win32Interop.GetWindowIdFromWindow(hostHwnd));
_island.Content = new SettingsPanel(); // any WinUI UIElement
_island.SiteBridge.MoveAndResize(new RectInt32(0, 0, 640, 480));
```

`DesktopWindowXamlSource` is the island. `Initialize` attaches it to a host window by its `WindowId`, and its `SiteBridge`, a `DesktopChildSiteBridge` that manages the island's own child window inside the host window, positions and sizes it. The host moves it again whenever its own layout changes, so a WPF or WinForms host usually wraps the island in a control of its own that calls `MoveAndResize` on resize. Close (`Dispose`) the island when the host is finished with it.

### Handing Focus Across the Boundary

Keyboard focus moves within the host and within the island on its own, but crossing between them needs the host's help. When the user tabs past either end of the island, `DesktopWindowXamlSource.TakeFocusRequested` fires, and its request says whether focus left forward or backward, so the host can focus the control on that side. When the user tabs into the island from the host, the host calls `NavigateFocus` with a request for the first control, or the last one if Shift is held.

{% include figure.html id="winui-island-focus" %}

A host app built with WPF, WinForms, or C++ is usually unpackaged, and it depends on the Windows App SDK runtime like any other unpackaged WinUI app, so the runtime has to be installed on the machine unless the host deploys it self-contained.

Older material about XAML Islands usually means something else. UWP XAML Islands, from Windows 10 1903, hosted UWP's `Windows.UI.Xaml` controls, and WPF and WinForms apps used them through the Community Toolkit's `WindowsXamlHost` control. That control hosts only UWP controls, not WinUI 3 content. For a new app, building it in WinUI 3 directly is simpler than hosting islands at all. Islands earn their complexity when a full rewrite isn't an option.
