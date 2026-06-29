---
title: "App Lifecycle and Activation"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Understanding application activation, instancing, background tasks, power management, and graceful shutdown in WinUI 3 desktop applications."
tags: [winui, winui-3, app-lifecycle, activation, background-tasks, desktop, practical]
---

## How WinUI 3 Applications Start

When Windows launches a WinUI 3 application, the process begins with activation. Activation is the mechanism through which the operating system delivers context to your app describing why it was launched and what it should do. The `Application.OnLaunched` override is where this process enters your code, but before you can make useful decisions there, you need to retrieve the activation arguments.

`AppInstance.GetActivatedEventArgs()` returns an `AppActivationArguments` object that carries the activation kind along with the data specific to that kind. The `Kind` property is an `ExtendedActivationKind` enum value, and each value corresponds to a different reason the app was started. The most common kinds are `Launch` (the user opened the app directly), `Protocol` (a URI scheme was invoked), `File` (a file with a registered association was opened), and `ToastNotification` (the user clicked an interactive notification). Checking the kind at startup lets you route the user to the right place in your application immediately, rather than always landing on the default home screen.

```csharp
protected override void OnLaunched(LaunchActivatedEventArgs args)
{
    var activationArgs = AppInstance.GetActivatedEventArgs();

    switch (activationArgs.Kind)
    {
        case ExtendedActivationKind.Launch:
            // Normal startup; navigate to home
            break;
        case ExtendedActivationKind.Protocol:
            var protocolArgs = activationArgs.Data as ProtocolActivatedEventArgs;
            // Navigate based on protocolArgs.Uri
            break;
        case ExtendedActivationKind.File:
            var fileArgs = activationArgs.Data as FileActivatedEventArgs;
            // Open the file from fileArgs.Files
            break;
    }

    m_window = new MainWindow();
    m_window.Activate();
}
```

Unlike UWP, WinUI 3 desktop applications are multi-instanced by default. When the user launches the app a second time, Windows starts a fresh process. This is the expected behavior for most desktop software, but there are scenarios where you want to prevent it.


## Single-Instance Applications

A single-instance application ensures that only one process runs at a time. If the user tries to launch a second copy, the new activation is redirected to the existing instance instead of starting fresh. This pattern suits applications where multiple windows would be confusing or where state is inherently singular, such as a music player, a system tray utility, or a document editor that manages a global recent-files list.

The Windows App SDK provides `AppInstance` to handle this. You register a key at startup, and if another instance is already registered with that key, you redirect to it and exit.

```csharp
static async Task Main(string[] args)
{
    WinRT.ComWrappersSupport.InitializeComWrappers();

    var instance = AppInstance.FindOrRegisterForKey("main");

    if (!instance.IsCurrent)
    {
        // Another instance is already running; redirect activation and exit
        var activationArgs = AppInstance.GetActivatedEventArgs();
        await instance.RedirectActivationToAsync(activationArgs);
        return;
    }

    // This is the first instance; register to receive redirected activations
    instance.Activated += OnActivated;

    Application.Start(p =>
    {
        var context = new DispatcherQueueSynchronizationContext(
            DispatcherQueue.GetForCurrentThread());
        SynchronizationContext.SetSynchronizationContext(context);
        new App();
    });
}
```

The `instance.Activated` event fires on the existing process whenever a redirect occurs. Your handler receives the activation arguments from the new launch attempt, so you can bring the existing window to the foreground and navigate to the appropriate content. Be careful to marshal work onto the UI thread inside the handler, since the event can arrive on a background thread.

Single-instance logic must run before `Application.Start`, which is why WinUI 3 apps that need this pattern often use a `Program.cs` entry point rather than relying entirely on the XAML-generated startup code.


## Protocol Activation

Protocol activation allows other applications or web pages to launch your app by navigating to a custom URI scheme. A link like `myapp://article/42` can open your application directly to a specific piece of content, which is a useful pattern for cross-application workflows, email links, and share integrations.

Registering a URI scheme requires an entry in `Package.appxmanifest`. Under the `Extensions` element inside the `Application` node, you declare a `Protocol` extension with the scheme name.

```xml
<Extensions>
  <uap:Extension Category="windows.protocol">
    <uap:Protocol Name="myapp">
      <uap:DisplayName>My Application</uap:DisplayName>
    </uap:Protocol>
  </uap:Extension>
</Extensions>
```

At runtime, when your application is launched via `myapp://some/path?query=value`, `GetActivatedEventArgs()` returns `ExtendedActivationKind.Protocol` and the data casts to `ProtocolActivatedEventArgs`. The `Uri` property on that object gives you the full URI, which you can parse to determine where in the app to navigate.

Deep linking works best when your navigation system can accept a destination from outside the normal startup flow. Passing the URI through to a navigation service during `OnLaunched` lets any part of the app become directly addressable from external callers.


## File Activation

File activation is how your application becomes the handler for specific file types. When a user double-clicks a `.myd` file in Explorer or selects your application from the "Open with" dialog, Windows launches your app and delivers the file paths through activation arguments.

The manifest declaration registers the file type association.

```xml
<Extensions>
  <uap:Extension Category="windows.fileTypeAssociation">
    <uap:FileTypeAssociation Name="mydocument">
      <uap:SupportedFileTypes>
        <uap:FileType>.myd</uap:FileType>
      </uap:SupportedFileTypes>
    </uap:FileTypeAssociation>
  </uap:Extension>
</Extensions>
```

At runtime, activation delivers `ExtendedActivationKind.File` and the data casts to `FileActivatedEventArgs`. The `Files` property is a collection of `IStorageItem` objects representing everything the user selected. Iterating that collection and casting each item to `StorageFile` gives you the file objects your application can read.

File activation can also arrive on an already-running instance if you configure single-instance behavior. In that case, the `instance.Activated` event on the existing process receives the file list, and you handle it the same way you would in `OnLaunched`.


## Background Tasks

Background tasks let your application execute code when the application is not in the foreground, or even when it is not running at all. For packaged WinUI 3 applications, background tasks use COM-based activation. Windows starts a lightweight COM server defined in your package, invokes the task entry point, and your code runs to completion without a UI.

You implement a background task by creating a class that implements `IBackgroundTask` from the `Windows.ApplicationModel.Background` namespace.

```csharp
public sealed class DataSyncTask : IBackgroundTask
{
    public async void Run(IBackgroundTaskInstance taskInstance)
    {
        var deferral = taskInstance.GetDeferral();
        try
        {
            await SyncDataAsync();
        }
        finally
        {
            deferral.Complete();
        }
    }
}
```

Calling `taskInstance.GetDeferral()` is necessary for any async work. Without it, the Run method returns before the async operations complete and Windows terminates the task. The deferral keeps the process alive until you call `Complete()`.

Registering a background task connects the task class to a trigger and requires a corresponding manifest declaration. Common triggers include `TimeTrigger` for periodic execution, `SystemTrigger` for system events like network availability changes, and `PushNotificationTrigger` for raw push payloads.

```csharp
var builder = new BackgroundTaskBuilder();
builder.Name = "DataSyncTask";
builder.TaskEntryPoint = "MyApp.BackgroundTasks.DataSyncTask";
builder.SetTrigger(new TimeTrigger(15, false)); // every 15 minutes
await BackgroundExecutionManager.RequestAccessAsync();
var registration = builder.Register();
```

The manifest must also declare the background task under `Extensions` to allow out-of-process activation. Packaged apps have stricter constraints than classic desktop apps, and the background task class must be in a separate WinRT component project or registered as an in-process task with the correct activation class ID.

Background task time is limited. Windows can cancel a task when system resources are constrained, so registering a cancellation handler with `taskInstance.Canceled` and saving partial progress lets the task resume cleanly if it is invoked again later.


## Power and Energy Management

Desktop applications that run on laptops and tablets should respond to power state changes. An application doing heavy background processing on battery drains the user's charge faster than expected, which erodes trust. The Windows App SDK provides the `Microsoft.Windows.System.Power` namespace to monitor the device's energy situation.

`PowerManager` exposes static properties and events covering battery charge level, power source (AC or DC), display status, and energy saver mode. Subscribing to these events and adjusting behavior accordingly is straightforward.

```csharp
PowerManager.PowerSourceKindChanged += OnPowerSourceChanged;
PowerManager.BatteryStatusChanged += OnBatteryStatusChanged;
PowerManager.EnergySaverStatusChanged += OnEnergySaverChanged;

private void OnPowerSourceChanged(object sender, object args)
{
    if (PowerManager.PowerSourceKind == PowerSourceKind.DC)
    {
        // Running on battery; reduce sync frequency, pause heavy background work
        _syncService.SetInterval(TimeSpan.FromMinutes(30));
    }
    else
    {
        _syncService.SetInterval(TimeSpan.FromMinutes(5));
    }
}

private void OnEnergySaverChanged(object sender, object args)
{
    if (PowerManager.EnergySaverStatus == EnergySaverStatus.On)
    {
        // Pause animations, reduce polling, defer non-critical work
        _animationService.Pause();
    }
    else
    {
        _animationService.Resume();
    }
}
```

Reading `PowerManager.RemainingChargePercent` gives the current battery level as an integer from 0 to 100. Combining this with the power source lets you make nuanced decisions, such as throttling a CPU-intensive export operation when the battery is below 20% and no charger is connected.

These are the kinds of adaptations users notice when they are absent. An application that ignores power state and pegs the CPU while the user is on an airplane is one that does not get opened again.


## App Restart and Recovery

Windows provides two related mechanisms for handling application termination gracefully. App restart allows the application to request that Windows restart it automatically after a crash or update. App recovery allows the application to save state during an unrecoverable failure before the process terminates.

`RegisterApplicationRestart` from the Win32 API registers a command-line string that Windows will pass to the restarted instance. The Windows App SDK does not wrap this in a managed API, so you call it through P/Invoke.

```csharp
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
static extern int RegisterApplicationRestart(string pwzCommandline, int dwFlags);

// Call this early in startup
RegisterApplicationRestart("/restored", 0);
```

When the app is restarted by Windows, the `/restored` argument arrives through the command line or activation args, and you can use it to reload the last saved state rather than starting fresh.

For recovery, `RegisterApplicationRecoveryCallback` lets you provide a delegate that Windows calls when it detects the application is about to terminate due to an unhandled exception. Inside that delegate you have a brief window to save documents, flush logs, or write a crash dump. Calling `ApplicationRecoveryInProgress` periodically during the callback keeps Windows from canceling your recovery delegate prematurely, and calling `ApplicationRecoveryFinished` signals that you are done.

These APIs are most relevant for document-centric applications where losing unsaved work would be a significant problem. Applications with ephemeral state, like a media player, may not need recovery registration, but restart registration is low-cost and worthwhile for almost any application.


## Graceful Shutdown

WinUI 3 applications terminate in one of several ways: the user closes the last window, code calls `Application.Current.Exit()`, Windows shuts down, or the process crashes. The predictable paths all provide opportunities to save state and clean up resources before the process ends.

The `Window.Closed` event fires when the user or code closes a specific window. For single-window applications, this is effectively the application shutdown event. You can subscribe to it from `App.xaml.cs` after creating the main window, or from within the window class itself.

```csharp
m_window = new MainWindow();
m_window.Closed += OnMainWindowClosed;
m_window.Activate();

private async void OnMainWindowClosed(object sender, WindowEventArgs args)
{
    // Save user preferences and application state
    await _settingsService.SaveAsync();
    await _documentService.SaveDirtyDocumentsAsync();
}
```

If you need to prevent the window from closing, such as when there are unsaved changes and you want to prompt the user, you can set `args.Handled = true` inside the handler. This cancels the close operation and gives you control to display a confirmation dialog before deciding whether to proceed.

`Application.Current.Exit()` triggers a clean shutdown of the application from code. It does not wait for async operations, so any work you need to do before exiting must happen before you call it.

When Windows itself is shutting down, the sequence is less predictable. The OS sends `WM_QUERYENDSESSION` and `WM_ENDSESSION` messages to Win32 processes, but WinUI 3 does not surface these through managed events directly. If your application needs to handle system shutdown, you can process these messages through a `WndProc` subclass using `SetWindowLongPtr` and a custom message handler registered on the HWND. For most applications, reliable behavior during system shutdown comes from writing state frequently during normal operation rather than relying on a single save at the last moment.

A useful pattern is to treat state persistence as continuous rather than terminal. Writing updated settings and document state on each meaningful change means that a crash or forced shutdown loses only the most recent action, not everything since the last save. Applications that checkpoint aggressively are more resilient than those that rely on the shutdown path being clean.

Cleanup of unmanaged resources like COM objects, file handles, and native library handles belongs in the `Closed` handler or in `IDisposable` implementations on services. WinUI 3 runs as a standard Win32 process, and the garbage collector does not guarantee timely finalization for objects holding native handles. Explicit cleanup on shutdown prevents resource leaks from accumulating across the application's lifetime.
