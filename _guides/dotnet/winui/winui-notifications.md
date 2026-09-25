---
title: "App Notifications in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Sending and handling app notifications from a WinUI 3 app with the Windows App SDK: registration, content, clicks, progress updates, scheduling, taskbar badges, and a system tray icon."
tags: [practical, app-notifications, notification-activation, scheduled-notifications, badge-notifications, system-tray]
---

## Table of Contents

- [How an App Joins the Notification System](#how-an-app-joins-the-notification-system)
- [Building a Notification](#building-a-notification)
- [Handling a Click](#handling-a-click)
- [Updating, Replacing, and Removing](#updating-replacing-and-removing)
- [Scheduling a Notification](#scheduling-a-notification)
- [Taskbar Badges](#taskbar-badges)
- [A System Tray Icon](#a-system-tray-icon)
- [When to Notify](#when-to-notify)


## How an App Joins the Notification System

An app notification, often still called a toast, is a pop-up Windows shows outside the app's window. It then stays in Notification Center (Action Center on Windows 10) until the user dismisses it or it expires, after three days by default. A notification can be purely informational, open the app when clicked, or run an action from one of its buttons without showing the app at all.

The Windows App SDK's API for this lives in `Microsoft.Windows.AppNotifications`, with the content builder in `Microsoft.Windows.AppNotifications.Builder`. It works for packaged and unpackaged apps. Microsoft's pages disagree on whether it needs the Windows App SDK's Singleton package, a separately installed part of the runtime. The API reference notes that dependency on every `AppNotificationManager` member, while the self-contained deployment guide says only push notifications need it. A self-contained app, which doesn't install that package, should test notifications on a clean machine. Before an app shows its first notification, it calls `AppNotificationManager.Default.Register()`, and the order of that call matters:

```csharp
// In App.OnLaunched, or in a custom Main if the app has one,
// before reading the activation arguments
AppNotificationManager.Default.NotificationInvoked += OnNotificationInvoked;
AppNotificationManager.Default.Register();

var activation = AppInstance.GetCurrent().GetActivatedEventArgs();
```

- **Subscribe to `NotificationInvoked` before calling `Register`.** Otherwise a click starts a new process to handle it instead of reaching the running app.
- **Call `Register` before `GetActivatedEventArgs`**, so the activation arguments reflect a notification launch.
- **Call `Unregister` before the app exits**, so a later click launches the app again. `UnregisterAll` removes the app's notification registration entirely, for an app that will never use notifications again.

A click on a notification has to be able to start the app when it isn't running, so Windows launches it through COM activation. The app is registered as the COM server for a class ID, and Windows asks COM to create that class. What `Register` does depends on whether the app is packaged as MSIX:

| | Packaged (MSIX) | Unpackaged |
|---|---|---|
| **How Windows launches the app for a click** | The manifest declares a `windows.toastNotificationActivation` extension and a `windows.comServer` entry with the same GUID, whose `Arguments` are `----AppNotificationActivated:` | `Register()` registers the calling process as the COM server itself |
| **Display name and icon** | From the package | Read from the shell, or passed explicitly with `Register(displayName, iconUri)` |

An app running elevated, as administrator, can't send or receive notifications. `Show` fails silently, which makes it easy to lose an afternoon wondering why nothing appears while testing from an elevated Visual Studio.


## Building a Notification

A notification is an XML document that Windows renders. `AppNotificationBuilder` writes that XML for you and returns an `AppNotification`:

```csharp
var notification = new AppNotificationBuilder()
    .AddArgument("action", "openDownloads")
    .AddText("Download complete")
    .AddText("quarterly-report.pdf is ready to open.")
    .BuildNotification();

AppNotificationManager.Default.Show(notification);
```

A notification takes at most three text elements, and a fourth `AddText` throws. The first is the title, shown on up to two lines, and the other two share up to four lines of body. `AddArgument` on the builder attaches key-value pairs to the notification's body, and they come back to the app when the user clicks it. The builder covers most of the content schema:

| Content | Builder calls |
|---|---|
| Images | `SetAppLogoOverride` (the small image on the left, optionally cropped to a circle), `SetHeroImage` (full width across the top), `SetInlineImage` (full width after the text) |
| Buttons | `AddButton(new AppNotificationButton("Reply").AddArgument("action", "reply"))`, each with its own arguments. Five at most, counting any placed in the notification's context menu with `SetContextMenuPlacement` |
| Inputs | `AddTextBox(id, placeholder, title)` and `AddComboBox`, whose values come back with the click |
| Progress | `AddProgressBar` (see [Updating, Replacing, and Removing](#updating-replacing-and-removing)) |
| Sound and timing | `SetAudioUri`, `SetAudioEvent`, `MuteAudio`, `SetDuration`, `SetTimeStamp` |
| Behavior | `SetScenario` with `Reminder`, `Alarm`, `IncomingCall`, or `Urgent`, which adjusts how Windows presents the notification. A reminder or alarm without a button falls back to a normal notification, and `Urgent` needs a check with `IsUrgentScenarioSupported` |

A text box paired with a button makes an inline reply. The button names the input it submits:

```csharp
var notification = new AppNotificationBuilder()
    .AddArgument("action", "openConversation")
    .AddArgument("conversationId", "9813")
    .AddText("Alex")
    .AddText("Are you free for lunch?")
    .AddTextBox("replyBox", "Type a reply", "Reply")
    .AddButton(new AppNotificationButton("Send")
        .AddArgument("action", "sendReply")
        .AddArgument("conversationId", "9813")
        .SetInputId("replyBox"))
    .BuildNotification();
```

The conversation ID appears twice because a click returns only the arguments of what was clicked. The builder's arguments go with the body, and a button's go with that button.

For a feature the builder doesn't expose, pass XML to the `AppNotification(string payload)` constructor instead. The two produce the same kind of object, and `Payload` returns the XML either way.


## Handling a Click

A click on the notification's body or one of its buttons reaches the app as an `AppNotificationActivatedEventArgs`. Its `Arguments` holds the key-value pairs of the body or the button that was clicked, and its `UserInput` holds the values of any text boxes and combo boxes.

When the app is already running, the click raises `NotificationInvoked` on the running process. The docs don't say which thread raises it, so dispatch to the UI thread before touching UI:

```csharp
private void OnNotificationInvoked(AppNotificationManager sender, AppNotificationActivatedEventArgs args)
{
    args.Arguments.TryGetValue("action", out string? action);

    if (action == "sendReply")
    {
        // A background action: do the work without showing the window
        _ = _messages.SendAsync(args.Arguments["conversationId"], args.UserInput["replyBox"]);
        return;
    }

    s_mainWindow.DispatcherQueue.TryEnqueue(() =>
    {
        s_mainWindow.Activate();
        s_navigation.RouteNotification(args.Arguments);
    });
}
```

When the app isn't running, Windows starts it through COM activation. Microsoft's quickstart is inconsistent about how that click then arrives. Its text says the activation kind is `Launch` and the arguments come through `NotificationInvoked`, while its sample checks the activation kind for `ExtendedActivationKind.AppNotification`. Handling both paths, as the sample does, covers either behavior:

```csharp
protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
{
    s_mainWindow = new MainWindow(); // created, not yet shown

    AppNotificationManager.Default.NotificationInvoked += OnNotificationInvoked;
    AppNotificationManager.Default.Register();

    var activation = AppInstance.GetCurrent().GetActivatedEventArgs();
    if (activation.Kind == ExtendedActivationKind.AppNotification)
    {
        // Launched by a click: route it like a click on a running app
        OnNotificationInvoked(AppNotificationManager.Default,
            (AppNotificationActivatedEventArgs)activation.Data);
    }
    else
    {
        s_mainWindow.Activate();
    }
}
```

This follows Microsoft's quickstart sample. Both paths end in the same `OnNotificationInvoked`, so a click behaves the same whether or not the app was open. If a click on a closed app does arrive as `Launch`, as the quickstart's text says, this code shows the window before `NotificationInvoked` delivers the arguments, which is harmless for a click that opens content but defeats a background action.

A button meant to act without opening the app, like the inline reply above, is the app's decision to make. For a Windows App SDK app, Windows always launches the app in the foreground, and setting `activationType="background"` in the XML is ignored. That is why the sample creates the window without activating it until it knows the click wants UI. If the window was never shown when a background action finishes, call `Application.Current.Exit()` to end the process.


## Updating, Replacing, and Removing

### Identifying a Notification

`Tag` and `Group` together identify a notification, so the app can update, replace, or remove it later. Set them on the builder with `SetTag` and `SetGroup`, or on the `AppNotification` before calling `Show`.

### Progress That Updates in Place

A progress bar shows a long operation, such as a download, an export, or an install. Its fields are data-bound: the `Bind` calls write named placeholders into the XML instead of values, and the app fills them in from the notification's `Progress` data, first when it shows the notification and then with each update. Give the notification a tag and set its initial `Progress`:

```csharp
var notification = new AppNotificationBuilder()
    .AddText("Exporting project")
    .AddProgressBar(new AppNotificationProgressBar()
        .BindTitle()
        .BindValue()
        .BindValueStringOverride()
        .BindStatus())
    .BuildNotification();

notification.Tag = "export";
notification.Group = "jobs";
notification.Progress = new AppNotificationProgressData(1)
{
    Title = "Q3 report",
    Value = 0.0,
    ValueStringOverride = "0 of 42 pages",
    Status = "Exporting..."
};
AppNotificationManager.Default.Show(notification);
```

Then push new values with `UpdateAsync`, incrementing the sequence number each time so Windows knows which update is newest. The initial data used 1, so `_sequence` starts at 1 and the first update is 2:

```csharp
var data = new AppNotificationProgressData(++_sequence)
{
    Value = pagesDone / 42.0,
    ValueStringOverride = $"{pagesDone} of 42 pages"
};
AppNotificationProgressResult result =
    await AppNotificationManager.Default.UpdateAsync(data, "export", "jobs");
```

An update changes only data-bound fields, meaning the progress bar's properties and the top-level text. It doesn't pop the notification up again, and it leaves it in place in Notification Center. If the user has dismissed the notification, the update fails, and the result reports that the notification wasn't found.

### Replacing Instead

Calling `Show` with a new notification that has the same `Tag` and `Group` replaces the old one. A replacement can change everything, moves to the top of Notification Center, and pops up again unless `SuppressDisplay` is `true`. It is also delivered even if the user dismissed the original. That makes it the right way to finish a progress sequence: when the export completes, replace the progress notification with an "Export finished" notification that has an Open button and no progress bar.

### Removing and Expiring

`RemoveByTagAsync`, `RemoveByTagAndGroupAsync`, `RemoveByGroupAsync`, `RemoveByIdAsync`, and `RemoveAllAsync` take the app's notifications out of Notification Center. Remove a notification once the user has dealt with its subject inside the app, so Notification Center doesn't keep offering stale news. For content that goes stale on its own, such as a meeting reminder after the meeting, set `Expiration` before calling `Show`, and Windows removes the notification at that time. Three days is both the default and the maximum, so `Expiration` can only shorten a notification's life. Setting `ExpiresOnReboot` removes it when the PC restarts, which suits something like "You're sharing your screen".


## Scheduling a Notification

The Windows App SDK's notification API has no scheduling of its own. `Show` displays immediately. To have Windows show a notification later, whether or not the app is running then, build the content with `AppNotificationBuilder` and hand its XML to the older `Windows.UI.Notifications` scheduler, which Microsoft documents for this use:

```csharp
using Windows.Data.Xml.Dom;
using Windows.UI.Notifications;

string payload = new AppNotificationBuilder()
    .AddArgument("action", "openTask")
    .AddArgument("taskId", "311")
    .AddText("Report due tomorrow")
    .BuildNotification()
    .Payload;

var xml = new XmlDocument();
xml.LoadXml(payload);

var scheduled = new ScheduledToastNotification(xml, DateTimeOffset.Now.AddHours(20))
{
    Tag = "task-311",
    Group = "reminders"
};
ToastNotificationManager.CreateToastNotifier().AddToSchedule(scheduled);
```

Microsoft's scheduling page doesn't say whether this works for unpackaged apps, and the reference page for the parameterless `CreateToastNotifier()` tells desktop apps to use the overload that takes an AppUserModelID. An unpackaged app should test scheduling before depending on it. To cancel a scheduled notification, find it by tag in `GetScheduledToastNotifications()` and pass it to `RemoveFromSchedule`. A scheduled notification has a five-minute delivery window. If the PC is off at the scheduled time and stays off longer than that, Windows drops the notification. For a reminder that must arrive however long the machine was off, Microsoft recommends a background task with a time trigger instead.


## Taskbar Badges

A badge is a small overlay on the app's taskbar button: a count of unread items, or a status glyph. Since Windows App SDK 1.7, `BadgeNotificationManager` in `Microsoft.Windows.BadgeNotifications` sets it:

```csharp
BadgeNotificationManager.Current.SetBadgeAsCount(5);
BadgeNotificationManager.Current.SetBadgeAsGlyph(BadgeNotificationGlyph.NewMessage);
BadgeNotificationManager.Current.ClearBadge();
```

A count shows 1 to 99, and anything higher shows as "99+". The glyphs are a fixed set of system images, such as `Alert`, `Attention`, `Error`, `NewMessage`, `Available`, `Away`, `Busy`, `Paused`, and `Playing`. If the app is pinned to the taskbar, its badge shows even while the app isn't running, which makes a badge count the natural running total next to a summary notification.


## A System Tray Icon

WinUI 3 has no API for the notification area, the icons beside the clock. An app that needs a tray icon calls Win32 directly, through platform invoke (P/Invoke) declarations that [CsWin32](https://github.com/microsoft/CsWin32){:target="_blank" rel="noopener noreferrer"} can generate from a `NativeMethods.txt` file listing the APIs by name. The steps are these:

1. **Create a window to own the icon.** Windows sends the icon's events to a window procedure, so the app needs a native window: a hidden top-level window, or its main window's handle. It can't be a message-only window, because step 4 depends on a broadcast that message-only windows don't receive.
2. **Add the icon** with `Shell_NotifyIcon(NIM_ADD, ...)`. Its `NOTIFYICONDATA` names the owning window, an icon ID, the icon, the tooltip, and a callback message, an app-chosen message ID that Windows sends for the icon's events.
3. **Handle the callback message.** Its `lParam` says what happened, such as a click or a request for the context menu (`WM_CONTEXTMENU`), and the app shows its window or a menu in response.
4. **Add the icon again when the taskbar is recreated.** When Explorer restarts, and on Windows 10 when the primary display's DPI changes, the taskbar broadcasts a `TaskbarCreated` message (from `RegisterWindowMessage`) to every top-level window. Any icons are gone at that point, and the app has to add them again.
5. **Remove the icon** with `NIM_DELETE` when the app exits.

Most apps don't write that plumbing. The community library [H.NotifyIcon.WinUI](https://github.com/HavenDV/H.NotifyIcon){:target="_blank" rel="noopener noreferrer"} wraps it in a XAML `TaskbarIcon` control with a context menu and click handling.

A tray app usually keeps running with its window closed, which changes two things set up elsewhere in the app:

- **The app mustn't exit with its last window.** By default it does, so set `Application.Current.DispatcherShutdownMode` to `DispatcherShutdownMode.OnExplicitShutdown`, and end the app with `Application.Current.Exit()` from the tray menu's Exit command.
- **Closing the window should hide it.** Handle `AppWindow.Closing`, set `args.Cancel = true`, and call `AppWindow.Hide()`. The tray icon's click then shows the window again.


## When to Notify

A notification is for a user who is somewhere else. If the user is looking at the app when something finishes, an in-app message such as an `InfoBar` tells them without the noise of a pop-up. Notifications are for calling them back after they have moved on.

- **Respect do not disturb.** Users can silence notifications with Do Not Disturb (Focus Assist on Windows 10), and they then go straight to Notification Center. An `Urgent` notification can break through, but only where the Windows build supports it and the user has allowed it for the app, so anything that must be seen immediately needs a fallback. `AppNotificationManager.Default.Setting` reports whether the user has turned the app's notifications off.
- **Consolidate bursts.** Twelve messages should produce one "12 new messages" notification, replaced as more arrive, not twelve pop-ups, with a badge carrying the count.
- **Make every notification lead somewhere.** Clicking it should at least open the app on the content it mentions. A notification with nowhere to go probably shouldn't exist.
- **Let stale notifications expire**, with `Expiration` as described above.

Each notification spends some of the user's attention. An app that spends it on low-value news teaches the user to ignore it, or to turn its notifications off entirely.
