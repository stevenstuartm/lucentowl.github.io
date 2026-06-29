---
title: "WinUI 3 Architecture and Project Setup"
layout: guide
category: "WinUI 3"
subcategory: "WinUI Fundamentals"
description: "Understanding the Windows App SDK foundation, how WinUI 3 relates to WPF and UWP, project structure, and application startup configuration."
tags: [winui, winui-3, xaml, desktop, windows-app-sdk, dotnet, fundamentals]
---

## What Is the Windows App SDK

For most of its history, Windows development meant choosing between two parallel universes. You either wrote WPF or WinForms applications that were deeply integrated with the operating system but shipped with Windows, or you wrote UWP applications that lived inside a sandboxed container and received more frequent updates but came with significant capability restrictions. The [Windows App SDK](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/){:target="_blank" rel="noopener noreferrer"} was Microsoft's attempt to resolve this tension by decoupling the modern Windows UI stack from the OS release cycle entirely.

The Windows App SDK ships as a NuGet package. This means that when Microsoft ships improvements to the rendering engine, the navigation model, or the control library, those improvements reach developers through a package update rather than a Windows feature update. An application targeting Windows App SDK 1.5 gets the same controls and behaviors whether it runs on Windows 10 or Windows 11, because the SDK brings its own implementation rather than relying on what the OS version happens to include. This decoupling is not a small technical detail; it changes how desktop Windows development works in practice, both for Microsoft's release velocity and for developer access to modern APIs.

WinUI 3 is the UI layer within the Windows App SDK. It provides the controls, layout system, and XAML rendering engine. The Windows App SDK also includes other pieces such as the app lifecycle APIs, windowing APIs, and push notification support, all of which are accessible to WinUI 3 applications. Thinking of WinUI 3 and the Windows App SDK as a single thing is reasonable for most purposes, since WinUI 3 is the primary consumer of the SDK's capabilities.

The practical consequence of this architecture is that a WinUI 3 application runs as a standard Win32 process. It has an HWND, it participates in the normal Windows message loop, and it can call Win32 APIs directly. The sandboxing restrictions that made UWP awkward for certain desktop scenarios simply do not apply unless you explicitly opt into a restricted deployment model.

---

## WinUI 3 vs WPF vs UWP

Understanding which technology to choose requires understanding how each one came to exist and what problems each was designed to solve.

### The WPF Era

WPF arrived with .NET Framework 3.0 in 2006 and represented a substantial leap forward for Windows desktop development. It introduced XAML as a markup language for describing UI, hardware-accelerated rendering through DirectX, a powerful data binding system, and a flexible styling and templating model. WPF applications run as standard Win32 processes and have unrestricted access to the Windows API. They can read and write the file system, launch processes, access the registry, and call COM APIs without special permissions.

WPF remains the right choice when you are maintaining an existing WPF application, when you need to target Windows 7 (which WinUI 3 does not support), or when you are working in a context where migrating a substantial existing codebase is impractical. WPF is not deprecated and will continue to receive maintenance updates through .NET, but it is not receiving the new controls, visual design updates, or platform integration features that are being built into WinUI 3.

### The UWP Era

UWP launched alongside Windows 10 in 2015 and represented a distinct model for Windows applications, one built around sandboxing rather than the traditional Win32 process model. UWP apps run inside an AppContainer sandbox, which restricts their ability to access the file system, network, and system resources to only what the user explicitly grants through capabilities declarations and runtime permission prompts. The motivation was security, consistent deployment through the Microsoft Store, and cross-device compatibility across PCs, phones, Xbox, and HoloLens.

The sandboxing that made UWP safe for consumer scenarios also made it frustrating for enterprise desktop applications. WinUI 2.x was the XAML control library for UWP, but by the time it matured enough to be truly competitive with WPF's control set, the UWP model itself had fallen out of favor for broad desktop development. Many developer tools, line-of-business applications, and enterprise software could not run inside the AppContainer restrictions without significant rearchitecting.

### WinUI 3: The Convergence

WinUI 3 lifts the WinUI control library out of UWP and makes it available to standard Win32 desktop applications. You get the modern Fluent Design controls, the modern XAML rendering engine, and access to current Windows platform features, but without the AppContainer sandbox. The application runs as a normal Win32 process with full access to the system.

The decision between the three comes down to a small set of practical questions. Use WPF when you have an existing WPF codebase that would require extensive effort to migrate, when you need to target Windows versions below Windows 10 version 1809, or when your team has deep WPF expertise and the project timeline does not justify retraining. Use UWP when you are building a game or an app targeting Xbox or HoloLens, since WinUI 3 does not support those platforms. Choose WinUI 3 for new desktop applications targeting Windows 10 and Windows 11, when you want access to the most current Fluent Design controls, when you want the Windows App SDK's windowing and lifecycle APIs, or when you are building an application that needs to appear in the Microsoft Store with a modern packaging model.

---

## Project Setup and Structure

### Choosing the Right Template

Visual Studio ships with several WinUI 3 project templates. The naming can be confusing at first, but the right starting point for most desktop applications is "Blank App, Packaged (WinUI 3 in Desktop)." The "Packaged" in the name refers to MSIX packaging, which means the application is deployed as an MSIX installer rather than a loose directory of files. MSIX packaging enables clean installation and uninstallation, per-user or per-machine install, support for the Microsoft Store, and access to certain Windows App SDK features that require a package identity.

The "Unpackaged" variant exists for scenarios where MSIX deployment is not viable, such as xcopy deployment or environments with restrictive software installation policies. Unpackaged applications have slightly reduced access to some Windows App SDK APIs but cover the majority of desktop application scenarios.

### The TargetFramework and Platform Targets

The project file for a WinUI 3 application targets a platform-specific TFM such as `net8.0-windows10.0.19041.0`. The `windows10.0.19041.0` suffix corresponds to Windows 10 version 2004, which is the minimum supported version for Windows App SDK 1.x applications. This TFM makes the Windows Runtime type projections available at compile time and enables the tooling to generate the necessary interop code for XAML compilation.

The project also specifies `<Platforms>` containing `x86`, `x64`, and `arm64`. Unlike most .NET applications where `AnyCPU` is the standard target, WinUI 3 applications must be compiled for a specific processor architecture because the Windows App SDK native components are architecture-specific. Visual Studio handles this automatically during development, defaulting to x64 on most developer machines.

### Key NuGet Packages

The primary package dependency is `Microsoft.WindowsAppSDK`, which brings in the WinUI 3 controls, the XAML compiler infrastructure, and the Windows App SDK runtime APIs. For most applications, you will also add `CommunityToolkit.WinUI.UI.Controls` to get additional controls from the Windows Community Toolkit, and `CommunityToolkit.Mvvm` to get the MVVM source generator infrastructure. The `Microsoft.Extensions.Hosting` package is commonly added when you want .NET's dependency injection and configuration systems, which integrate well with WinUI 3 despite not being Windows-specific.

---

## Project Structure Walkthrough

### App.xaml and App.xaml.cs

Every WinUI 3 application starts with `App.xaml` and its code-behind `App.xaml.cs`. The XAML file is primarily a place to declare application-scoped resources, including merged resource dictionaries for custom styles and the application's global theme resources. The code-behind file is where the application's entry point lives.

`App.xaml` typically looks sparse in a new project, containing little more than the application resource dictionary. Its importance grows as you add custom styles, application-wide brushes, or merged dictionaries that pull in third-party control libraries.

### MainWindow.xaml

The `MainWindow.xaml` file defines the application's primary window. In a minimal project, it contains a single control, often a `Button` or a `StackPanel` with placeholder content. In a real application, it typically contains a `NavigationView` that provides the top-level navigation shell, with individual pages hosted inside a `Frame`.

The relationship between `MainWindow.xaml` and the pages your application navigates to is important. The window itself is a container; it does not contain your application's UI directly in most patterns. Instead, the window hosts a `Frame`, and the `Frame` navigates between pages. This separation means the window-level elements like the title bar and the navigation control remain persistent while the content area changes as the user navigates.

### Package.appxmanifest

For packaged applications, the `Package.appxmanifest` file describes the MSIX package. It defines the application's identity (package name, publisher, version), capabilities the application requests such as internet access or webcam access, file type associations, protocol activations, and the application's display name and icons. Think of it as the application's declaration to the operating system of what it is and what permissions it needs.

Changes to the manifest do not require recompilation of the C# code, but they do affect how the MSIX package is structured and what runtime access the application has. Adding a capability like `Webcam` to the manifest does not automatically grant webcam access; on Windows 11, the user must also grant access through the privacy settings, but without the capability declaration the application will not even be able to prompt for it.

### Assets Folder

The Assets folder contains the application's icon images at various sizes and scales. Windows requires multiple image dimensions to display the application icon correctly in different contexts such as the Start menu, the taskbar, and the Windows Settings app. The project template generates placeholder images for all required sizes. In a production application, these get replaced with the actual application icon in each required dimension.

---

## App.xaml.cs Deep Dive

### The Entry Point and OnLaunched

The `App` class inherits from `Microsoft.UI.Xaml.Application`. The XAML application infrastructure calls `OnLaunched` when the application starts, passing an `AppActivationArguments` object that describes how the application was activated. A standard launch from the Start menu or taskbar provides a `LaunchActivatedEventArgs`, but activation can also come from file associations, protocol handlers, push notifications, or other sources.

The typical `OnLaunched` implementation creates the main window, activates it to make it visible, and optionally performs startup initialization. A minimal implementation looks like this in C#:

```csharp
protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
{
    m_window = new MainWindow();
    m_window.Activate();
}

private Window? m_window;
```

The window must be stored in a field to prevent garbage collection. The WinUI 3 `Window` object does not register itself with the process in a way that would keep it alive automatically; once the reference goes out of scope, the garbage collector can collect it and the window will close.

### Global Resources and Startup Configuration

The `App` class is where application-wide initialization belongs. Before calling `m_window.Activate()`, you can initialize dependency injection by configuring a service container, configure logging, load application settings from a configuration file, or set up any other application-wide services.

Resource dictionaries declared in `App.xaml` are available to every control in the application. This is the correct place to put custom brushes, common styles, and merged dictionaries for third-party control themes. Resources defined here are in scope before the first window is shown, so controls that reference them during their constructor or initialization phase will find them available.

### Handling Unhandled Exceptions

WinUI 3 applications can receive unhandled exceptions through the `UnhandledException` event on the `App` class. This event fires when an exception propagates to the top of the XAML dispatcher loop without being caught. The handler receives the exception and a flag that controls whether the exception is considered handled. Setting `e.Handled = true` prevents the application from crashing, but this should be used cautiously; swallowing exceptions without logging them or showing appropriate UI leads to silent data loss and confusing behavior.

For async code, `TaskScheduler.UnobservedTaskException` catches exceptions from `Task` objects whose exceptions were never observed. Both handlers together provide a reasonable safety net, but neither replaces proper exception handling at the boundaries where errors should actually be caught and acted upon.

---

## Window, AppWindow, and HWND

WinUI 3 has three distinct but related concepts for representing the application window, and understanding how they relate to each other removes a significant source of confusion.

The `Microsoft.UI.Xaml.Window` class is the WinUI 3 managed representation of a window. It is what you interact with from XAML and C# to control the window's content, show or hide it, and respond to window-level events through the XAML framework. This is the type you instantiate in `OnLaunched` and the type you reference when you need to set the window's content or title.

The `Microsoft.UI.Windowing.AppWindow` class provides access to the window's presentation model. This is where you go to customize the title bar, change the window presenter between windowed, maximized, full-screen, and compact overlay modes, control the window's position and size at the OS level, and respond to window state changes like minimize and restore. You get the `AppWindow` from a `Window` instance through the `AppWindow` property, which is available on `Window` in Windows App SDK 1.3 and later.

The HWND is the underlying Win32 window handle. Every WinUI 3 window has an HWND because it runs as a standard Win32 process. You need the HWND when interacting with Win32 APIs directly, such as when using file dialogs that require a parent window handle, calling into COM APIs that expect an HWND, or configuring certain platform integrations. You retrieve the HWND using `WinRT.Interop.WindowNative.GetWindowHandle(window)` where `window` is the `Microsoft.UI.Xaml.Window` instance.

The pattern these three types establish is that the XAML `Window` manages XAML content, the `AppWindow` manages the OS-level window presentation, and the HWND is the identity that Win32 APIs use to locate the window. Applications that only display XAML content and respond to standard user interactions rarely need to work with anything below `Window`. Applications that customize the title bar or integrate with Win32 APIs will work with both `AppWindow` and potentially the HWND.

---

## Debug vs Release and XAML Hot Reload

### Build Configuration Differences

WinUI 3 applications behave somewhat differently between Debug and Release builds in ways that matter during development. The Debug configuration includes XAML debugging infrastructure and disables certain optimizations to make the debugger experience more accurate. The Release configuration enables Native AOT compilation of the XAML markup, which improves startup time and reduces memory usage but also means that XAML errors that were soft failures in Debug become hard failures in Release.

Testing the Release build before shipping is more important for WinUI 3 applications than for many other .NET application types. XAML binding errors, missing resources, and improperly declared data templates can all manifest differently between the two configurations.

### XAML Hot Reload

XAML Hot Reload allows you to modify XAML markup while the application is running and see the changes reflected immediately without restarting. It works through a side channel that the Debug build maintains with Visual Studio, watching for XAML file changes and pushing updates to the running process.

Hot Reload has meaningful constraints. It does not execute C# code-behind changes; for those, you still need to restart. It does not always handle changes to control templates or resource dictionaries correctly, and complex binding expressions can cause it to fall back to a full refresh. Despite these limitations, it is genuinely useful for layout adjustments, visual tweaks, and iterating on styles without the overhead of a full restart cycle.

XAML Hot Reload in WinUI 3 is generally reliable for changes to element properties, layout values, and simple style modifications. Treat it as a productivity accelerator for visual work rather than a general-purpose live coding tool.

---

## Common Pitfalls

### Not Storing a Window Reference

Creating a window in `OnLaunched` and calling `Activate()` without storing the window in a field will cause the window to be garbage collected shortly after launch. The window appears, flickers, and closes. Always store the window reference in an instance field on the `App` class.

### Missing Platform Targets

WinUI 3 applications must target a specific CPU architecture. Running a WinUI 3 application as `AnyCPU` is not supported and results in runtime failures. The project template configures this correctly by default, but if you copy a project file from a regular .NET application and modify it, this is an easy configuration to miss.

### Confusing Window and AppWindow APIs

The `Window` class has a `Title` property that sets the text displayed in the title bar. The `AppWindow` has a `Title` property as well. When you customize the title bar using `AppWindow.TitleBar`, the `Window.Title` property may not update the visual title bar anymore, depending on the customization applied. Understanding which level of the abstraction you are working with prevents confusing situations where setting a property appears to have no effect.

### XAML Compilation Errors Appearing Only at Runtime

Type lookup in XAML can fail in ways that compile successfully but throw at runtime, particularly when using types from referenced assemblies that are not properly included in the XAML namespace declarations. The `XamlParseException` that results often points to a line in the XAML file, but the message can be opaque. Running the application in Debug mode and checking the Output window for XAML binding warnings is a habit worth developing early.
