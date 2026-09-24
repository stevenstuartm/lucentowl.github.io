---
title: "WinUI 3 Architecture and Project Setup"
layout: guide
category: "WinUI 3"
subcategory: "WinUI Fundamentals"
description: "What WinUI 3 and the Windows App SDK are and how they ship separately from Windows, when to choose WinUI 3 over WPF or UWP, the files in a new project, how the app starts and reports fatal exceptions, and how a Debug run differs from a published build."
tags: [windows-app-sdk, project-structure, app-startup, msix, hot-reload, fundamentals]
---

## What the Windows App SDK Is

For most of Windows' history, the UI framework you used shipped with the operating system. New controls or rendering fixes reached users only when they installed a new version of Windows. That coupling is what the [Windows App SDK](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/){:target="_blank" rel="noopener noreferrer"} removes. It is a set of libraries and a runtime that ship through NuGet, so improvements reach an app when the developer updates a package rather than when the user updates Windows.

WinUI 3 is the UI layer of the Windows App SDK. It provides the controls, the layout system, and the XAML engine that renders them. The rest of the SDK covers work around the UI:

| Area | What it provides |
| --- | --- |
| WinUI 3 | Controls, layout, styling, and the XAML runtime |
| Windowing | `AppWindow`: the title bar, size and position, and the presenter (normal, full-screen, or compact overlay) |
| App lifecycle | Activation, single-instancing, power notifications |
| Notifications | App (toast) notifications and push notifications |
| Resources | MRT Core, the resource system that picks localized strings and scaled images |
| Windows AI and ML | On-device models and Windows ML |

Because the SDK brings its own implementation, the same WinUI version renders the same controls on Windows 10 and Windows 11. The SDK is backward compatible to Windows 10 version 1809, though Microsoft supports it only on Windows releases that are themselves still in support. A few visual features still depend on the OS. Mica, the window background material that picks up a tint from the desktop wallpaper, needs Windows 11.

A WinUI 3 app is a standard Win32 desktop process. It has a window handle (HWND), runs a normal Windows message loop, and can call Win32 and COM APIs directly. It doesn't run inside the UWP sandbox. It runs with full trust, like any other desktop app, so it can read the file system and registry and start other processes. It is usually installed as an MSIX package, the modern Windows installer format. When it is, Windows redirects some of its writes to per-user app data locations, which it cleans up at uninstall.

The Windows App SDK is also distinct from the **Windows SDK**, the older set of headers and metadata that describes the APIs built into Windows itself. A WinUI 3 project uses both: the Windows App SDK for WinUI and its libraries, and the Windows SDK for OS APIs such as `Windows.Storage`.

Since version 2.0, released in April 2026, the SDK follows semantic versioning. The NuGet package version matches the SDK version, stable updates have shipped roughly monthly since then, and breaking changes are reserved for major versions. Microsoft services each major release for a fixed period, so an app has to move forward periodically to stay on a supported release.

---

## Choosing Between WinUI 3, WPF, and UWP

All three frameworks use XAML, and all three still run. They differ in their process model and in where Microsoft's investment goes. Fluent is Microsoft's current design language, the look of Windows 11's own apps, and each framework gets to it differently.

| | WPF | UWP | WinUI 3 |
| --- | --- | --- | --- |
| First shipped | 2006, with .NET Framework 3.0 | 2015, with Windows 10 | 2021 |
| Process model | Win32 desktop process | Sandboxed (AppContainer) | Win32 desktop process |
| Devices | Windows PCs | PCs, Xbox, HoloLens | Windows PCs |
| Controls and design | Classic controls; optional Fluent theme since .NET 9 | WinUI 2, the Fluent control library for UWP | WinUI 3 Fluent controls |
| Where new features land | .NET releases | Little new investment | Windows App SDK releases |

**WPF** is the mature option. It runs as an ordinary desktop process with a large control ecosystem, and it isn't frozen. .NET 9 added a Fluent theme with light and dark modes and system accent colors. WPF remains a sound choice for maintaining an existing WPF app or when a team's investment in WPF libraries outweighs what WinUI adds.

**UWP** ran every app in an AppContainer, a Windows sandbox where file, network, and device access had to be declared as capabilities and often approved by the user. That made UWP safe for consumer apps distributed through the Store and awkward for line-of-business and developer tools. UWP is still the only one of the three that targets Xbox and HoloLens, which WinUI 3 does not.

**WinUI 3** takes the Fluent control library that UWP had and makes it available to ordinary desktop processes. Choose it for a new Windows desktop app that should look like a current Windows 11 app, or that needs the Windows App SDK's windowing, lifecycle, notification, and on-device AI APIs.

The choice isn't strictly either-or. The Windows App SDK isn't tied to WinUI, so a WPF or WinForms app can reference it to use app notifications, windowing, or the Windows AI APIs without rewriting its UI. XAML Islands go a step further and host individual WinUI controls inside a Win32 window.

---

## Creating a Project

A WinUI 3 project can come from Visual Studio or from the .NET CLI:

- **Visual Studio 2026** with the **WinUI application development** workload provides the **WinUI Blank App (Packaged)** template.
- **The .NET CLI** has its own template package, currently published as a preview. After `dotnet new install Microsoft.WindowsAppSDK.WinUI.CSharp.Templates`, `dotnet new winui` creates a project. That project references `Microsoft.Windows.SDK.BuildTools.WinApp`, which lets `dotnet run` register the app and launch it with package identity.

The template name says **Packaged**, which means the app is installed as an MSIX package. Installing a package gives the app a **package identity**: a name and publisher that Windows records and uses to attribute things to the app. Features such as file type associations declared in the manifest and background tasks registered with Windows depend on it.

Either path needs Windows **Developer Mode**, a setting under System > Advanced that allows installing unsigned development packages.

There's no separate unpackaged template. Running from a plain folder means setting `WindowsPackageType` to `None`, choosing the unpackaged launch profile, and either installing the Windows App SDK runtime on the target machine or bundling it with the app.

### The Target Framework and Platforms

The generated project targets a Windows-specific framework moniker such as `net10.0-windows10.0.26100.0`. Two version numbers matter, and they are easy to confuse:

- **The target version** in the moniker (10.0.26100.0) decides which Windows APIs the compiler can see.
- **`TargetPlatformMinVersion`** (10.0.17763.0, Windows 10 version 1809) is the oldest Windows version the app claims to run on.

The project also lists `x86`, `x64`, and `ARM64` under `<Platforms>`, and sets the runtime identifier to the build machine's architecture by default. Parts of the Windows App SDK are native code compiled per architecture, so a WinUI 3 build targets a specific processor architecture rather than the `AnyCPU` that most .NET class libraries use.

### Key NuGet Packages

The template references `Microsoft.WindowsAppSDK`, which brings WinUI 3, the XAML compiler, and the SDK runtime APIs, and `Microsoft.Windows.SDK.BuildTools`, which supplies Windows SDK build tooling such as the packaging tools. Most real apps add a few more:

| Package | Adds |
| --- | --- |
| `CommunityToolkit.Mvvm` | Source-generated observable properties, commands, and messaging for ViewModels |
| `CommunityToolkit.WinUI.Controls.*` | Controls and panels WinUI doesn't include, one package per control family |
| `Microsoft.Extensions.Hosting` | .NET dependency injection, configuration, and logging |

---

## What's in a New Project

A new project splits its UI between a window and a page. The `Window` is the top-level window on screen. Inside it, a `Frame` control shows one `Page` at a time, and the page holds the app's actual UI.

| File | Role |
| --- | --- |
| `App.xaml`, `App.xaml.cs` | Application-wide resources, and the entry point for app code |
| `MainWindow.xaml`, `MainWindow.xaml.cs` | The window: title bar, backdrop, and a `Frame` for pages |
| `MainPage.xaml`, `MainPage.xaml.cs` | The first page, where the app's UI goes |
| `Package.appxmanifest` | The package's identity and declarations to Windows |
| `app.manifest` | The Win32 application manifest: OS compatibility and DPI awareness |
| `Properties/launchSettings.json` | Launch profiles for running packaged or unpackaged |
| `Properties/PublishProfiles/` | One publish profile per processor architecture |
| `Assets/` | Logos and the window icon |

### App.xaml and App.xaml.cs

`App.xaml` holds application-wide resources, and even in a new project it isn't empty. It merges `XamlControlsResources`, the dictionary that supplies the default style and template of every WinUI control. Deleting that line leaves controls without their styles, so app styles and third-party dictionaries are added alongside it rather than in place of it. Resources declared here are available to every element in the app and exist before the first window is created.

`App.xaml.cs` is the entry point for app code. Its constructor is the first authored code that runs, and `OnLaunched` is where the app creates its first window.

### MainWindow and MainPage

The window and the content are split across two files. `MainWindow.xaml` sets a Mica backdrop, places a `TitleBar` control in the top row, and fills the rest with a `Frame` named `RootFrame`. Its constructor extends the app's content into the title bar area, sets the window icon, and navigates the frame to `MainPage`.

The frame keeps a history of the pages it has shown. `MainPage.xaml` is where the app's UI starts. Building UI in a page rather than directly in the window gives it page features such as navigation events, and it lets the title bar and backdrop stay in place while the frame swaps pages.

### Package.appxmanifest and app.manifest

The two manifests do different jobs:

- **`Package.appxmanifest`** is the packaged app's declaration to Windows. It defines the package identity (name, publisher, version), the display name and logos, the capabilities the app requests, and extensions that integrate with the shell, such as file type associations and URI protocols. Editing it doesn't require recompiling C#, but it changes what the installed package can do.
- **`app.manifest`** is the classic Win32 manifest embedded in the executable. The template uses it to declare Windows 10 compatibility, which some features need when the app runs unpackaged, and per-monitor DPI awareness, so the app renders sharply when moved between displays with different scaling.

### Launch and Publish Profiles

`Properties/launchSettings.json` defines two ways to start the app from Visual Studio: **Package**, which deploys and runs it as an MSIX package, and **Unpackaged**, which runs the built executable directly. The publish profiles under `Properties/PublishProfiles/` target `win-x86`, `win-x64`, and `win-arm64`, and each one publishes a self-contained app that carries its own copy of the .NET runtime.

### Assets

The `Assets` folder holds the app's logos at the sizes Windows needs for the Start menu, taskbar, and Store listings, plus the `.ico` file used for the window icon. The template ships placeholders, which a production app replaces with its own artwork.

---

## How the App Starts

The `App` class derives from `Microsoft.UI.Xaml.Application`. When the process starts, the XAML-generated entry point creates the `App` instance and the framework calls `OnLaunched`. The template's version creates the main window and activates it:

```csharp
public partial class App : Application
{
    private Window? _window;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        _window = new MainWindow();
        _window.Activate();
    }
}
```

`Activate()` shows the window and brings it to the foreground. The template keeps the window in a field so the rest of the app can reach it later, for example to change its content, respond to a second activation, or find the window that should own a dialog.

The `args` parameter describes a normal launch. A WinUI 3 app can also be started by opening a file, following a custom URI, or clicking a notification, and the Windows App SDK's `AppInstance` API reports which of these happened.

### Startup Configuration

`App` exists for the lifetime of the process and is created before any window, so application-wide setup belongs in its constructor or at the start of `OnLaunched`: building the dependency injection container, loading settings, and configuring logging. Anything a window's constructor needs must be ready before that window is created.

### Unhandled Exceptions

`Application.UnhandledException` fires when an exception escapes app code with no remaining chance to be caught, such as an exception thrown from an event handler that the XAML framework invoked, or one raised during layout. After the event, the app is normally terminated.

Setting `e.Handled = true` in the handler prevents termination in most cases, and Microsoft's documentation advises against doing it routinely:

- The handler rarely knows whether the app is in a consistent state, so continuing can cause further failures.
- Some exceptions leave the framework itself inconsistent, and the app is terminated even when the handler sets `Handled`.
- The event's `Exception` property isn't guaranteed to match the original exception's type, message, or stack trace. The event args' own `Message` property usually carries the original message.

The practical use of the event is to log what happened and, where it's safe, show the user a message before the app closes. Exceptions that app code can anticipate are better caught where they occur, where the full exception is still available.

The handler must be attached in code, typically in the `App` constructor, because it can't be wired in `App.xaml`. It also sees only exceptions that reach the XAML framework. Other failures surface elsewhere:

| Where the exception happens | Where it's reported |
| --- | --- |
| Code the XAML framework called on the UI thread, or layout | `Application.UnhandledException` |
| A background thread | `AppDomain.CurrentDomain.UnhandledException`, and the process ends |
| A faulted `Task` that nothing awaited | `TaskScheduler.UnobservedTaskException`, when the task is garbage collected, possibly long after the failure |

---

## Debug Runs, Published Builds, and the Edit Loop

### What Changes When You Publish

Publishing uses the per-architecture profiles, which make the output self-contained. The project file adds two more settings for every configuration except Debug. **ReadyToRun** precompiles the app's IL to native code, which shortens startup at the cost of a larger output. **Trimming** removes code the build can't see being used, which shrinks the output.

| | Debug run (F5) | Published Release build |
| --- | --- | --- |
| .NET runtime | The one installed on the machine | Bundled with the app, one build per architecture |
| Windows App SDK runtime | Installed with the SDK tooling | Still required on the target machine, unless the app bundles it |
| ReadyToRun | Off | On |
| Trimming | Off | On |
| Hot Reload | Available with the debugger attached | Not available |
| Code reached only through reflection | Works | May have been trimmed away |

The last row is why an app that works under F5 can fail after publishing. Reflection-based `{Binding}` expressions, which resolve property names at runtime, are a usual casualty, along with some serializers and plugin loading. Compiled `{x:Bind}` bindings are generated at build time and don't depend on reflection. Run the published build before shipping it. For a packaged app, the thing that ships is the MSIX package built from it, not the publish folder.

### No Designer: Hot Reload and the Live Visual Tree

Visual Studio has no drag-and-drop XAML designer for WinUI 3, which surprises developers coming from WPF or WinForms. The replacement is the running app itself, with the debugger attached:

- **XAML Hot Reload** applies markup edits to the running app as you type them. It suits layout, spacing, styles, and colors.
- **The Live Visual Tree** and **Live Property Explorer** show the running app's element tree, each element's current property values, and where each value came from.
- **C# Hot Reload** applies many code edits while the debugger is attached. A change only shows when the edited code runs again, such as on the next click of a button.

All three need the debugger, so they're unavailable under Ctrl+F5. C# Hot Reload also requires the Debug configuration and doesn't work when trimming or ReadyToRun is enabled for the debug profile. Some edits, such as changing a class's base type, still need a restart, and Visual Studio offers to rebuild when it can't apply one.

---

## Common Setup Pitfalls

### Building for AnyCPU

A project copied from a general .NET template, or edited by hand, can end up targeting `AnyCPU` with no runtime identifier. The build can then fail to resolve a runtime identifier, or the app can't load the native Windows App SDK components. Keep the platform list and runtime identifier the template generated.

### Confusing the Target Version with the Minimum Version

Raising the version in the target framework moniker exposes newer Windows APIs to the compiler but doesn't raise `TargetPlatformMinVersion`. The app still installs on older Windows versions, and a call to an API those versions lack throws at runtime. Check for newer APIs with `ApiInformation.IsTypePresent` or `IsMethodPresent`, or raise the minimum version deliberately.

### XAML Errors That Appear Only at Runtime

A XAML file can compile and still fail when it loads. The usual causes are a type from a referenced assembly that the XAML namespace declarations don't resolve, or a `{StaticResource}` key that doesn't exist. The resulting `XamlParseException` names a line in the file, but its message is often vague. With the debugger attached, the Output window shows parse errors as they happen, and Visual Studio's **XAML Binding Failures** window lists bindings that couldn't resolve.
