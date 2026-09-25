---
title: "App Lifecycle and Activation"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "How a WinUI 3 desktop app learns why it was started and routes the activation, stays single-instance, registers background tasks, adapts to power state, and shuts down or restarts without losing work."
tags: [practical, app-lifecycle, activation, single-instance, background-tasks, power-management, shutdown]
---

## Table of Contents

- [Activation: Why the App Started](#activation-why-the-app-started)
- [Instancing](#instancing)
- [Background Tasks](#background-tasks)
- [Adapting to Power State](#adapting-to-power-state)
- [Restart and Recovery](#restart-and-recovery)
- [Shutdown](#shutdown)


## Activation: Why the App Started

Windows starts an app for a reason: the user clicked its tile, opened a file it handles, followed a link with its URI scheme, or signed in with the app set to run at startup. That reason, plus its data (the file, the URI), is the activation. UWP gave each reason its own override, such as `OnFileActivated` and `OnActivated`. A WinUI 3 app has only `Application.OnLaunched`, which runs for every activation, after the `App` constructor. The `LaunchActivatedEventArgs` passed to it reports `Launch` whatever actually happened, so read the real activation from the Windows App SDK's app lifecycle API:

```csharp
using Microsoft.Windows.AppLifecycle;

protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
{
    AppActivationArguments activation = AppInstance.GetCurrent().GetActivatedEventArgs();

    s_mainWindow = new MainWindow();
    s_mainWindow.Activate();
    s_navigation.Route(activation);

    // Activations redirected here during startup (see Instancing)
    while (s_pendingActivations.TryDequeue(out AppActivationArguments? pending))
        s_navigation.Route(pending);
}
```

`AppInstance.GetCurrent()` returns the running process's instance, and `GetActivatedEventArgs()` on it returns an `AppActivationArguments`. Its `Kind` is an `ExtendedActivationKind`, and its `Data` is the matching event-args object from `Windows.ApplicationModel.Activation`, such as `IProtocolActivatedEventArgs`. The kinds most desktop apps meet are these:

| Kind | Started by | `Data` gives you |
|---|---|---|
| `Launch` | The tile, the Start menu, a shortcut, or the command line | The command-line arguments |
| `File` | Opening a file of a type the app registered | `Files`, a list of `IStorageItem` |
| `Protocol` | A URI with the app's scheme, such as `myapp://article/42` | `Uri` |
| `StartupTask` | The user signing in, with the app registered to start then | The startup task's ID |

Notification clicks have their own delivery path through `AppNotificationManager`. An app that uses notifications has to call `AppNotificationManager.Default.Register()` before it reads its activation arguments.

### Registering for File and Protocol Activation

An app receives `File` or `Protocol` activations only after registering the file types or URI scheme with Windows, and how it registers depends on whether it is packaged.

| | Packaged (MSIX) | Unpackaged |
|---|---|---|
| **Where** | Extensions in `Package.appxmanifest` | Code, through `ActivationRegistrationManager` |
| **When** | At install, removed at uninstall | Whenever the app calls it, usually at startup, per user |
| **Kinds available** | All of UWP's activation kinds | `Launch`, `File`, `Protocol`, and `StartupTask` |

A packaged app declares the scheme and file types in its manifest:

```xml
<Extensions>
  <uap:Extension Category="windows.protocol">
    <uap:Protocol Name="myapp">
      <uap:DisplayName>My App</uap:DisplayName>
    </uap:Protocol>
  </uap:Extension>
  <uap:Extension Category="windows.fileTypeAssociation">
    <uap:FileTypeAssociation Name="mydocument">
      <uap:SupportedFileTypes>
        <uap:FileType>.myd</uap:FileType>
      </uap:SupportedFileTypes>
    </uap:FileTypeAssociation>
  </uap:Extension>
</Extensions>
```

An unpackaged app has no manifest to hold these, so it calls `ActivationRegistrationManager.RegisterForProtocolActivation`, `RegisterForFileTypeActivation`, and `RegisterForStartupActivation` with its executable path, and the matching `Unregister` methods when the user turns a feature off. These registrations are per user. An app installed for several users registers for each of them.

### Routing an Activation to a Page

An activation that names a destination, such as a URI path or a file, is a deep link, and it's only useful if the app can go straight there. Keep that mapping in one place, the `Route` method in the sample above. It switches on `Kind`, casts `Data` (`Uri` for a protocol, `Files` for a file activation), and resolves the result to a page type and parameter, falling back to the home page. The activation code then stays a few lines long, and every entry point, including a startup launch, a redirected activation (below), and a notification click, goes through the same mapping. Parse the URI defensively, since any program on the machine can launch it with any path.

There is no suspend or resume step to handle after this. `Microsoft.UI.Xaml.Application` has no `Suspending` or `Resuming` event, because Windows doesn't suspend a desktop app the way it suspended a UWP app. State is saved on the paths covered under [Shutdown](#shutdown).

By default, each launch starts a new process. A running copy of the app hears nothing about the second launch, which reads its own arguments in its own `OnLaunched`. An already-running instance receives an activation only when the new process redirects it there, which is what single-instancing does.


## Instancing

### Multi-Instance by Default

WinUI 3 apps are multi-instanced. Every launch starts a new process with its own window, the way Notepad behaves. That suits many apps, but for a music player, a tray utility, or an editor that should open every file in one window, a second launch should activate the copy already running.

### Making the App Single-Instance

The Windows App SDK makes this a decision the new process takes as early as it can. The same API works for packaged and unpackaged apps. It registers a key with `AppInstance.FindOrRegisterForKey`. If no other instance holds the key, the process gets its own `AppInstance` back with `IsCurrent` set to `true`, and it carries on starting up. If another instance already registered the key, the call returns that instance instead, and the new process passes its activation to it with `RedirectActivationToAsync` and exits.

{% include figure.html id="winui-activation-redirect" %}

The decision should happen before the app does any work it would have to throw away, such as creating a window. Microsoft's migration guide shows a simpler version inside `OnLaunched`, but warns that `OnLaunched` can be too late for that reason, and recommends a custom `Main`. Define `DISABLE_XAML_GENERATED_MAIN` in the project file to stop the XAML compiler supplying its own. (Since Windows App SDK 2.3, the symbol renames the generated entry point to `XamlGeneratedProgram.XamlGeneratedMain()` rather than removing it, so a custom `Main` can call it.)

```xml
<PropertyGroup>
  <DefineConstants>$(DefineConstants);DISABLE_XAML_GENERATED_MAIN</DefineConstants>
</PropertyGroup>
```

`Main` must run on a single-threaded apartment (STA) thread, the COM threading mode a UI thread needs, where the thread's own message loop services calls to its objects. Blocking that thread stalls those calls, yet `RedirectActivationToAsync` has to finish before the process exits. Making `Main` `async` doesn't solve this. Before `Application.Start` there is no synchronization context to bring an `await` back to the same thread, so the code after the first `await` runs on a thread-pool thread and not the STA. Microsoft's pattern runs the redirect on a worker thread and waits for it with `CoWaitForMultipleObjects`, a wait that doesn't block the STA:

```csharp
public static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        WinRT.ComWrappersSupport.InitializeComWrappers();

        AppActivationArguments activation = AppInstance.GetCurrent().GetActivatedEventArgs();
        AppInstance mainInstance = AppInstance.FindOrRegisterForKey("main");

        if (!mainInstance.IsCurrent)
        {
            RedirectAndWait(mainInstance, activation);
            return 0;
        }

        mainInstance.Activated += App.OnRedirectedActivation;

        Application.Start(_ =>
        {
            var context = new DispatcherQueueSynchronizationContext(
                DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(context);
            _ = new App();
        });
        return 0;
    }

    private static void RedirectAndWait(AppInstance target, AppActivationArguments activation)
    {
        IntPtr done = CreateEvent(IntPtr.Zero, true, false, null);
        Task.Run(() =>
        {
            target.RedirectActivationToAsync(activation).AsTask().Wait();
            SetEvent(done);
        });
        CoWaitForMultipleObjects(0, 0xFFFFFFFF, 1, [done], out _);

        // Bring the existing instance's window to the front
        SetForegroundWindow(Process.GetProcessById((int)target.ProcessId).MainWindowHandle);
    }

    // P/Invoke declarations for CreateEvent, SetEvent, CoWaitForMultipleObjects,
    // and SetForegroundWindow omitted
}
```

An app that also uses notifications has to call `AppNotificationManager.Default.Register()` in `Main`, before the `GetActivatedEventArgs` call, since that ordering rule applies wherever the app first reads its activation.

The first instance receives each redirected activation through its `Activated` event, as the same `AppActivationArguments` the second process read. The docs don't say which thread raises it, so dispatch to the window's `DispatcherQueue` before touching UI, then route the activation through the same `Route` method as a startup launch. The handler is attached before `App` or its window exists, so an activation that arrives during startup has to wait for the window:

```csharp
// In App, which keeps its main window and navigation service in static fields
public static void OnRedirectedActivation(object? sender, AppActivationArguments args)
{
    if (s_mainWindow is null)
    {
        s_pendingActivations.Enqueue(args); // a ConcurrentQueue that OnLaunched drains
        return;
    }

    s_mainWindow.DispatcherQueue.TryEnqueue(() =>
    {
        s_mainWindow.Activate();
        s_navigation.Route(args);
    });
}
```

Some details differ from UWP and catch people out:

- **Redirection doesn't end the process.** In UWP a redirect terminated the app. Here the process keeps running, so `Main` has to return after redirecting.
- **Keys are app-defined, one per instance.** Registering a new key replaces the instance's old one. An editor that runs one file per instance can use the file's path as its key, so opening a file that is already open redirects to the instance that has it, while other files start new instances.
- **Keys are released when the process exits.** A redirect can still race a closing instance, so an app can call `UnregisterKey` as it begins shutting down, and new launches stop finding it by that key.
- **Debugging needs a deployed copy.** One debugger session can't launch the app twice, so test single-instancing by deploying the app and launching it from Start.


## Background Tasks

A background task runs code when a trigger fires, such as a time zone change, the network becoming available, or a push notification, even when the app isn't running. Work that only matters while the app is open doesn't need one. A timer or a hosted service inside the app is simpler.

Since Windows App SDK 1.7, a WinUI 3 app registers a task with the Windows App SDK's own `BackgroundTaskBuilder` in `Microsoft.Windows.ApplicationModel.Background`. The task runs through COM activation. The app gives its task class a GUID, called a CLSID, and declares in its manifest which executable serves that CLSID. When the trigger fires, the system's background task host, `backgroundtaskhost.exe`, asks COM for an object of that CLSID, and COM gets it from the app's process through a class factory the app registered. The task is therefore an ordinary full-trust class inside the app, rather than the Windows Runtime component that UWP's out-of-process tasks used.

This requires MSIX packaging. An unpackaged app gets the same effect from Windows Task Scheduler or a separately installed .NET worker service.

The task is a class that implements `IBackgroundTask` and is exposed to COM under a fixed GUID:

```csharp
[ComVisible(true)]
[ClassInterface(ClassInterfaceType.None)]
[Guid("5B1E7F2A-9C3D-4E8B-A6F1-2D7C9E4B8A31")]
[ComSourceInterfaces(typeof(IBackgroundTask))]
public sealed class SyncTask : IBackgroundTask
{
    private BackgroundTaskDeferral? _deferral;
    private volatile bool _canceled;

    [MTAThread]
    public async void Run(IBackgroundTaskInstance taskInstance)
    {
        _deferral = taskInstance.GetDeferral();
        taskInstance.Canceled += (_, _) => _canceled = true;
        try
        {
            await SyncChangesAsync(() => _canceled);
        }
        finally
        {
            _deferral.Complete();
        }
    }
}
```

`Run` returns at its first `await`, and without a deferral the system would treat the task as finished and could end the host process. `GetDeferral` keeps it alive until `Complete`. The system can cancel a task, so the `Canceled` handler records the request and the work checks it and stops early. Keep tasks short, because long-running ones may be terminated.

Registration names the trigger and points at the class by its GUID. Call `RequestAccessAsync` first, and don't register the same task twice. Either check `BackgroundTaskRegistration.AllTasks` or unregister and re-register at startup:

```csharp
await BackgroundExecutionManager.RequestAccessAsync();

var builder = new Microsoft.Windows.ApplicationModel.Background.BackgroundTaskBuilder
{
    Name = "SyncOnNetwork"
};
builder.SetTrigger(new SystemTrigger(SystemTriggerType.NetworkStateChange, false));
builder.AddCondition(new SystemCondition(SystemConditionType.InternetAvailable));
builder.SetTaskEntryPointClsid(typeof(SyncTask).GUID);
builder.Register();
```

Two pieces of setup complete the wiring:

- **The manifest** declares a `windows.backgroundTasks` extension whose `EntryPoint` is `Microsoft.Windows.ApplicationModel.Background.UniversalBGTask.Task`, and a `windows.comServer` extension that lists the task's GUID under the app's executable and grants `backgroundtaskhost.exe` permission to launch it.
- **The app registers a class factory** for the task with `CoRegisterClassObject`, or COM activation fails. For a task that runs inside the app's own process, this happens in the `App` constructor. For one that runs in a separate copy of the executable, a custom `Main` checks for a command-line flag, registers the factory, and waits instead of starting the UI.

The [background tasks article](https://learn.microsoft.com/windows/apps/windows-app-sdk/applifecycle/background-tasks){:target="_blank" rel="noopener noreferrer"} has the full manifest and class factory code.


## Adapting to Power State

An app that keeps syncing, indexing, and animating at full rate on battery drains the charge faster than the user expects. `PowerManager` in `Microsoft.Windows.System.Power` reports the device's power state to packaged and unpackaged apps alike, through static properties, each with a matching `...Changed` event:

| Property | Tells you |
|---|---|
| `EffectivePowerMode` | The device's effective power mode. The property is an async operation, so read it with `await` |
| `PowerSourceKind` | `AC` or `DC` (battery) |
| `BatteryStatus` | `Charging`, `Discharging`, `Idle`, or `NotPresent` |
| `RemainingChargePercent` | Battery charge, 0 to 100 |
| `PowerSupplyStatus` | Whether the charger is adequate, for example `Inadequate` |
| `EnergySaverStatus` | Whether battery saver is on |
| `DisplayStatus` | `On`, `Dimmed`, or `Off` |
| `UserPresenceStatus` | Whether the user is present |

Each event reports only that something changed, and one reading rarely decides what to do. Unplugging can raise `PowerSupplyStatusChanged`, but whether to scale back depends on the battery status and charge as well. So point every event at one method that reads the current state and decides:

```csharp
PowerManager.PowerSourceKindChanged += (_, _) => AdjustWorkload();
PowerManager.PowerSupplyStatusChanged += (_, _) => AdjustWorkload();
PowerManager.BatteryStatusChanged += (_, _) => AdjustWorkload();
PowerManager.RemainingChargePercentChanged += (_, _) => AdjustWorkload();
PowerManager.EnergySaverStatusChanged += (_, _) => AdjustWorkload();

private void AdjustWorkload()
{
    bool lowBattery = PowerManager.PowerSourceKind == PowerSourceKind.DC
        && PowerManager.BatteryStatus == BatteryStatus.Discharging
        && PowerManager.RemainingChargePercent < 25;
    bool weakCharger = PowerManager.PowerSourceKind == PowerSourceKind.AC
        && PowerManager.PowerSupplyStatus == PowerSupplyStatus.Inadequate;
    bool saver = PowerManager.EnergySaverStatus == EnergySaverStatus.On;

    _syncService.Interval = lowBattery || weakCharger || saver
        ? TimeSpan.FromMinutes(30)
        : TimeSpan.FromMinutes(5);
}
```

The events use a callback model like Win32's power notifications, and the docs don't say they arrive on the UI thread, so dispatch before touching UI from a handler. Watch `DisplayStatus` too. With the display off, the app can stop rendering and do deferred work instead.


## Restart and Recovery

### Restarting on Purpose

`AppInstance.Restart(arguments)`, available to packaged and unpackaged apps, restarts the app immediately with a new command line, for example after the user changes a setting that only applies at startup or after a failed initialization that should retry in a safe mode. It returns an `AppRestartFailureReason` explaining why when the restart can't happen, such as another restart already pending.

### Restarting After a Crash, Hang, or Update

Windows can also offer to restart an app that crashed or stopped responding, and restart it automatically after an update, but only if the app registered for it. The Windows App SDK doesn't wrap this, so the app calls Win32's `RegisterApplicationRestart` directly through platform invoke (P/Invoke). `LibraryImport` needs the containing class to be `partial` and the project to set `AllowUnsafeBlocks` to `true`:

```csharp
internal static partial class NativeMethods
{
    [LibraryImport("kernel32.dll", StringMarshalling = StringMarshalling.Utf16)]
    internal static partial int RegisterApplicationRestart(string? commandLine, int flags);
}

// At startup
NativeMethods.RegisterApplicationRestart("/restored", 0);
```

The command line (without the executable name) is what the restarted instance receives, so the app can tell a restart from a fresh launch and reopen the user's work. The flags opt out of cases: `RESTART_NO_CRASH` (1), `RESTART_NO_HANG` (2), `RESTART_NO_PATCH` (4), and `RESTART_NO_REBOOT` (8).

Registration changes less than its name suggests. After a crash or hang, Windows offers the user a restart and doesn't restart the app on its own. Only an update restarts it automatically. To avoid a restart loop, Windows restarts only an app that had been running for at least 60 seconds. Register early, because the registration must exist before the crash or hang.

`RegisterApplicationRecoveryCallback` is the companion API. It gives Windows Error Reporting a function to call in a dying process so the app can save what it can, with the callback calling `ApplicationRecoveryInProgress` periodically so it isn't cut off and `ApplicationRecoveryFinished` when done. Code running in a process that has just failed can't rely on much of its own state, so treat recovery as a last attempt and not a substitute for saving as the user works.


## Shutdown

### What Ends the App

By default the app ends when its last window closes. `Application.Start` sets `Application.DispatcherShutdownMode` to `OnLastWindowClose`, so closing the last window ends the UI thread's event loop. Code can also end it with `Application.Current.Exit()`, and Windows ends it when the user signs out or the system shuts down.

The last-window rule has a consequence that loses data. A `Window.Closed` handler that is `async` runs only until its first `await`, and then the event loop ends without waiting for the rest:

```csharp
// The save can be cut off: nothing waits for it after the window closes
private async void OnMainWindowClosed(object sender, WindowEventArgs args)
{
    await _documents.SaveAllAsync();
}
```

Two fixes work. For a short save, do it synchronously in `Closed`. For anything that needs to await or ask the user, stop the close first. `AppWindow.Closing` fires before the window closes and its args have a `Cancel` property. Set it, finish the work, then close the window from code:

```csharp
_window.AppWindow.Closing += async (sender, args) =>
{
    if (!_documents.HasUnsavedChanges) return;

    args.Cancel = true;
    if (await ConfirmSaveAsync())
    {
        await _documents.SaveAllAsync();
        _documents.MarkClean();
        _window.Close();
    }
};
```

Clear the unsaved state before calling `Close()`, so that if `Closing` fires again the handler lets it through. An app that must outlive its windows, such as one that keeps a tray icon, sets `DispatcherShutdownMode` to `OnExplicitShutdown` and ends itself with `Application.Current.Exit()`. `Exit` doesn't wait for pending async work either, so finish that before calling it.

### When Windows Shuts Down

At sign-out or system shutdown, Windows sends each top-level window `WM_QUERYENDSESSION` and then `WM_ENDSESSION`. WinUI 3 doesn't surface these as events, so an app that has to respond intercepts them on its window's native handle (HWND) by installing its own window procedure, a technique called subclassing. The time is short. When an installer closes the app to update it, Microsoft gives five seconds to respond to these messages.

The dependable answer to every shutdown path, including a crash or a pulled plug, is to save continuously. Write settings when they change and checkpoint documents as the user edits. Then a shutdown loses at most the last action, and the shutdown handlers become a final flush rather than the only save.
