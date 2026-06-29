---
title: "App Notifications in WinUI 3"
layout: guide
category: "WinUI 3"
subcategory: "Platform Integration"
description: "Implementing toast notifications, badge updates, and system tray integration in WinUI 3 using the Windows App SDK notification APIs and Win32 interop."
tags: [winui, winui-3, notifications, platform-integration, win32-interop, desktop, practical]
---

## Table of Contents

- [How WinUI 3 Apps Participate in the Notification System](#how-winui-3-apps-participate-in-the-notification-system)
- [Toast Notifications](#toast-notifications)
- [Rich Toast Content](#rich-toast-content)
- [Handling Notification Activation](#handling-notification-activation)
- [Scheduled and Updated Notifications](#scheduled-and-updated-notifications)
- [Badge Notifications](#badge-notifications)
- [System Tray Integration](#system-tray-integration)
- [When to Notify and When Not To](#when-to-notify-and-when-not-to)

---

## How WinUI 3 Apps Participate in the Notification System

Windows Notification Center (Action Center) is the operating system's central hub for app notifications. When an app sends a toast, it appears as a pop-up in the lower-right corner of the screen and is also stored in Notification Center for the user to review later. Apps that participate in this system can deliver timely, actionable information without requiring the user to have the app window open.

WinUI 3 apps built with the Windows App SDK gain access to the notification system through the `Microsoft.Windows.AppNotifications` namespace, introduced in Windows App SDK 1.2. This API replaces the older UWP `Windows.UI.Notifications` approach and is designed for packaged and unpackaged Win32 desktop apps alike. Unpackaged apps require a small amount of additional setup to register with the notification platform, since there is no package identity for the system to use as the app's notification channel identifier.

For packaged apps, the system derives the app's notification identity from the package manifest. For unpackaged apps, you register a unique application user model ID (AUMID) and a display name so Windows knows which app owns incoming notifications. Either way, you call `AppNotificationManager.Default.Register()` early in the application lifecycle, before any notifications are sent or handled.

```csharp
// In App.xaml.cs, before creating the window
AppNotificationManager notificationManager = AppNotificationManager.Default;
notificationManager.NotificationInvoked += OnNotificationInvoked;
notificationManager.Register();
```

The `NotificationInvoked` event fires when the user interacts with a notification while your app is already running. When the app is not running, Windows relaunches it and passes activation arguments through the normal app activation path, which you handle in `OnLaunched`.

---

## Toast Notifications

A toast notification in WinUI 3 is built from an XML payload that the system renders. You can construct this payload by hand using the `AppNotificationBuilder` class or by writing XML directly. `AppNotificationBuilder` is the recommended starting point because it covers the most common patterns without requiring you to memorise the toast XML schema.

The simplest notification has a title and a body:

```csharp
var builder = new AppNotificationBuilder()
    .AddText("Download complete")
    .AddText("your-file.zip is ready to open.");

AppNotificationManager.Default.Show(builder.BuildNotification());
```

`AddText` appends a text element to the notification. The first call produces the title-weight line; subsequent calls produce body lines. The system handles layout, typography, and dark/light mode adaptation automatically.

If you prefer to construct the XML payload directly, you use `AppNotification` with a raw XML string. This is useful when you need toast features that `AppNotificationBuilder` does not yet expose:

```csharp
string xml = @"<toast>
    <visual>
        <binding template=""ToastGeneric"">
            <text>Download complete</text>
            <text>your-file.zip is ready to open.</text>
        </binding>
    </visual>
</toast>";

var notification = new AppNotification(xml);
AppNotificationManager.Default.Show(notification);
```

Both approaches produce the same result. The `AppNotificationBuilder` API generates valid XML internally, so mixing the two is safe as long as you work with one style per notification.

---

## Rich Toast Content

Beyond text, toasts can carry images, inline buttons, text inputs, combo boxes, and progress bars. Each of these elements is added through `AppNotificationBuilder` methods or the equivalent XML elements.

An inline image appears below the text content. A hero image spans the full width of the toast and appears above everything else. An app logo override replaces the small app icon in the corner with a custom image:

```csharp
var builder = new AppNotificationBuilder()
    .AddText("Photo upload complete")
    .AddText("Your vacation album is live.")
    .SetHeroImage(new Uri("ms-appx:///Assets/vacation-thumb.jpg"))
    .SetAppLogoOverride(new Uri("ms-appx:///Assets/photos-icon.png"), AppNotificationImageCrop.Circle);
```

Buttons make notifications actionable. Each button carries an argument string that your activation handler receives when the user clicks it:

```csharp
var builder = new AppNotificationBuilder()
    .AddText("New message from Alex")
    .AddText("Are you free for lunch?")
    .AddButton(new AppNotificationButton("Reply")
        .AddArgument("action", "reply")
        .AddArgument("conversationId", "12345"))
    .AddButton(new AppNotificationButton("Dismiss")
        .AddArgument("action", "dismiss"));
```

Text inputs paired with a reply button enable inline reply directly from the notification, so users can respond without switching to the app. You assign a matching `InputId` to connect the input field to the button:

```csharp
var builder = new AppNotificationBuilder()
    .AddText("New message from Alex")
    .AddTextBox("replyBox", "Type a reply...", "Reply")
    .AddButton(new AppNotificationButton("Send")
        .AddArgument("action", "inlineReply")
        .SetInputId("replyBox"));
```

For richer construction patterns, the [CommunityToolkit.WinUI.Notifications](https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/adaptive-interactive-toasts){:target="_blank" rel="noopener noreferrer"} NuGet package provides a fluent builder that mirrors the full toast XML schema, including progress bars, which `AppNotificationBuilder` does not yet cover. Progress bars are especially useful for file transfers or background processing operations:

```xml
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>Uploading files</text>
            <progress value="{progressValue}"
                      title="Upload progress"
                      valueStringOverride="{progressString}"
                      status="{progressStatus}" />
        </binding>
    </visual>
</toast>
```

The `{progressValue}` placeholders are bound to named data bindings you supply when creating or updating the notification.

---

## Handling Notification Activation

When a user clicks a toast or one of its buttons, your app needs to respond appropriately. The response path depends on whether the app is running at the time of activation.

If the app is running, `AppNotificationManager.NotificationInvoked` fires with an `AppNotificationActivatedEventArgs` object. The `Arguments` dictionary contains the key-value pairs you embedded in the notification's argument strings. User inputs from text boxes and combo boxes are available through the `UserInput` dictionary:

```csharp
private void OnNotificationInvoked(AppNotificationManager sender, AppNotificationActivatedEventArgs args)
{
    string action = args.Arguments["action"];

    if (action == "reply")
    {
        string conversationId = args.Arguments["conversationId"];
        DispatcherQueue.TryEnqueue(() =>
        {
            // Navigate to the conversation
            MainFrame.Navigate(typeof(ConversationPage), conversationId);
            MainWindow.Activate();
        });
    }
    else if (action == "inlineReply")
    {
        string replyText = args.UserInput["replyBox"].ToString();
        // Send the reply
    }
}
```

If the app is not running, Windows launches it and passes the notification arguments through `AppInstance.GetActivatedEventArgs()`. You inspect this in `OnLaunched`:

```csharp
protected override void OnLaunched(LaunchActivatedEventArgs args)
{
    var activationArgs = AppInstance.GetCurrent().GetActivatedEventArgs();

    if (activationArgs.Kind == ExtendedActivationKind.AppNotification)
    {
        var notificationArgs = activationArgs.Data as AppNotificationActivatedEventArgs;
        // Parse arguments and navigate to the appropriate content
    }

    // Continue with normal window creation
}
```

Centralising argument parsing in a helper keeps both paths consistent. A simple dictionary lookup based on the `action` key usually suffices, but apps with complex navigation may benefit from a small argument-router class that maps action strings to navigation targets.

---

## Scheduled and Updated Notifications

Not every notification is time-sensitive. Windows supports scheduling a notification to appear at a specific time, which is useful for reminders or calendar events. You attach a `DeliveryTime` to the notification before showing it:

```csharp
var notification = builder.BuildNotification();
notification.Expiration = DateTimeOffset.Now.AddHours(1); // Auto-remove after 1 hour
// Scheduled delivery is set via AppNotificationScheduledToastNotification if using WinRT APIs
```

For in-progress operations like uploads or downloads, you can update an existing notification rather than replacing it with a new one. The `Tag` and `Group` properties identify which notification to update. Setting the same `Tag` and `Group` on a new `Show()` call replaces the existing notification in place without generating a new pop-up:

```csharp
var notification = builder.BuildNotification();
notification.Tag = "upload-progress";
notification.Group = "file-operations";
AppNotificationManager.Default.Show(notification);

// Later, to update progress:
var updatedNotification = updatedBuilder.BuildNotification();
updatedNotification.Tag = "upload-progress";
updatedNotification.Group = "file-operations";
AppNotificationManager.Default.Show(updatedNotification);
```

To remove a specific notification programmatically, call `RemoveByTagAndGroupAsync`. To clear all of an app's notifications from Notification Center at once, use `RemoveAllAsync`. Removing notifications when the user completes the relevant action in-app keeps Notification Center tidy.

---

## Badge Notifications

Badge notifications are lightweight overlays on the taskbar button, used to communicate a quick numeric count or a status glyph without requiring a full toast. A numeric badge typically indicates unread messages or pending actions. A glyph badge uses one of a fixed set of Windows-defined icons such as `alert`, `busy`, `newMessage`, or `paused` to indicate application state.

Badge updates use the `BadgeUpdateManager` API from the `Windows.UI.Notifications` namespace, which remains the current API for this feature even in Windows App SDK projects:

```csharp
using Windows.Data.Xml.Dom;
using Windows.UI.Notifications;

// Numeric badge
string badgeXml = "<badge value=\"5\"/>";
var badgeDoc = new XmlDocument();
badgeDoc.LoadXml(badgeXml);
BadgeUpdateManager.CreateBadgeUpdaterForApplication().Update(new BadgeNotification(badgeDoc));

// Glyph badge
string glyphXml = "<badge value=\"newMessage\"/>";
var glyphDoc = new XmlDocument();
glyphDoc.LoadXml(glyphXml);
BadgeUpdateManager.CreateBadgeUpdaterForApplication().Update(new BadgeNotification(glyphDoc));

// Clear the badge
BadgeUpdateManager.CreateBadgeUpdaterForApplication().Clear();
```

Badges work well in combination with toasts. When a batch of messages arrives, a single toast with a summary plus a badge update communicates both the new content and the running total without flooding Notification Center with individual toasts for every message.

---

## System Tray Integration

WinUI 3 has no built-in system tray (notification area) API. Placing an icon in the notification area requires calling the Win32 `Shell_NotifyIcon` function via P/Invoke or through [CsWin32](https://github.com/microsoft/CsWin32){:target="_blank" rel="noopener noreferrer"}, the source-generated Windows API projection library.

The general process involves creating a hidden Win32 message window to receive tray icon messages, then registering the icon with `Shell_NotifyIcon` using a `NOTIFYICONDATA` structure. The message window handles `WM_CONTEXTMENU` and custom callback messages to respond to right-click and double-click events.

With CsWin32, you add the package and create a `NativeMethods.txt` file listing the APIs you need. CsWin32 then generates strongly typed P/Invoke signatures, eliminating the error-prone manual attribute declarations:

```
// NativeMethods.txt
Shell_NotifyIcon
WM_CONTEXTMENU
NOTIFYICONDATA
```

A minimal tray icon setup registers the icon on startup and removes it on app exit:

```csharp
// Create the icon (simplified illustration)
var iconData = new NOTIFYICONDATA
{
    cbSize = (uint)Marshal.SizeOf<NOTIFYICONDATA>(),
    hWnd = _messageWindowHandle,
    uID = 1,
    uFlags = NIF.ICON | NIF.MESSAGE | NIF.TIP,
    uCallbackMessage = WM_TRAYICON,
    hIcon = LoadAppIcon(),
    szTip = "My Application"
};
Shell_NotifyIcon(NIM.ADD, ref iconData);
```

Context menus for the tray icon are typically built using `CreatePopupMenu` and `AppendMenu` from Win32, then displayed with `TrackPopupMenu` in response to `WM_CONTEXTMENU`. The selected menu item ID comes back through `WM_COMMAND` on the message window.

For apps that need a polished tray experience without writing all of this infrastructure from scratch, the [H.NotifyIcon.WinUI](https://github.com/HavenDV/H.NotifyIcon){:target="_blank" rel="noopener noreferrer"} community library wraps the Win32 plumbing and exposes a XAML-friendly `TaskbarIcon` control with support for popup menus, balloon tips, and left/right-click handling. It is a practical choice when system tray support is a core feature rather than a minor addition.

---

## When to Notify and When Not To

The decision to notify versus showing feedback inside the app depends on whether the user is focused on your app at the time the event occurs.

If the user is actively using the app when something completes, an in-app [InfoBar](https://learn.microsoft.com/en-us/windows/apps/design/controls/infobar){:target="_blank" rel="noopener noreferrer"} or status message is almost always preferable. Popping a toast while the user is already staring at your app creates visual noise without adding value. Toasts serve users who have moved on to something else and need to be recalled to your app.

A few additional considerations:

- **Focus Assist awareness**: Windows allows users to suppress notifications when in do-not-disturb or game mode. Design your notifications so they are informative when seen but not critical to have seen immediately. Truly urgent information should be communicated through other channels.
- **Notification grouping**: If your app can generate many notifications in a short time, use `Tag` and `Group` to consolidate them. A single summary notification like "12 new messages" is far less disruptive than 12 individual toasts.
- **Actionable content**: Every toast should have a clear purpose. If clicking the notification does nothing useful, the notification probably should not exist. At minimum, clicking a notification should bring the app to the foreground and navigate to the relevant content.
- **Expiration**: Set an `Expiration` time on notifications that become meaningless after a certain point. A notification about a time-sensitive calendar reminder should not linger in Notification Center for three days.

The notification system works best when used conservatively. Each notification trains the user's attention; frequent or low-value notifications teach users to ignore them or, worse, to disable them entirely. Treating every notification as an interruption worth the user's attention produces a better experience than treating notifications as a convenient logging output.
