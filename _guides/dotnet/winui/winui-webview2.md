---
title: "Hosting Web Content with WebView2"
layout: guide
category: "WinUI 3"
subcategory: "Advanced Features"
description: "Embedding web content in a WinUI 3 app with WebView2: the Evergreen and Fixed Version runtimes, the browser processes and user data folder behind the control, initialization, navigation events, loading local content, messaging between the app and the page, and keeping hosted content from reaching the app."
tags: [webview2, corewebview2, evergreen-runtime, user-data-folder, web-messaging, practical]
---

## Table of Contents

- [What WebView2 Is](#what-webview2-is)
- [The WebView2 Runtime](#the-webview2-runtime)
- [Processes and the User Data Folder](#processes-and-the-user-data-folder)
- [Initialization and Threading](#initialization-and-threading)
- [Navigation](#navigation)
- [Loading Local Content](#loading-local-content)
- [Talking Between the App and the Page](#talking-between-the-app-and-the-page)
- [Keeping Hosted Content in Its Place](#keeping-hosted-content-in-its-place)

---

## What WebView2 Is

`WebView2` is a XAML control that shows web content rendered by the same Chromium engine as Microsoft Edge. It suits web UI an app already has (a dashboard, a help center, a report viewer), content that changes more often than the app ships, and pages that need the full web platform. It replaces UWP's `WebView`, which used the old EdgeHTML engine.

The price is a second UI stack. Each WebView2 brings a set of browser processes with their own memory, a startup delay before the first page appears, and a dependency on a runtime the app doesn't control. The page also looks and behaves like a web page unless someone styles it to match the app, and anything it shows is reachable only through a messaging bridge. A form, a list, or a settings page that could be XAML is usually better as XAML.

The control is a thin XAML wrapper. The browser itself is `CoreWebView2`, the same object WPF, WinForms, and Win32 apps host, reached through the control's `CoreWebView2` property. Settings, navigation, scripting, and messaging all live on that object, and the control adds layout, focus, and a `Source` property that XAML can set. The WinUI 3 control ships with the Windows App SDK, which carries its own copy of the WebView2 SDK. A WinUI 3 project doesn't add the `Microsoft.Web.WebView2` NuGet package itself, and adding it produces build errors.

```xml
<WebView2 x:Name="Browser" Source="https://learn.microsoft.com/windows/apps/" />
```

---

## The WebView2 Runtime

The engine isn't part of the app. It comes from the WebView2 Runtime, installed separately, in one of two distribution modes:

| | Evergreen | Fixed Version |
| --- | --- | --- |
| Where it comes from | One shared install on the machine, updated on Edge's release cadence but independently of the Edge browser | A specific runtime version the app ships in its own folder |
| Updates | Automatic, including security fixes | Only when the app ships a new version |
| Size cost | None for the app | More than 250 MB added to the app |
| Fits | Most apps | Air-gapped machines, kiosks, and regulated environments that must pin a version |

Evergreen is the default and the recommendation. It's part of Windows 11, and Microsoft has delivered it to the vast majority of Windows 10 devices, but a clean Windows 10 install, Windows Server, or an LTSC edition may not have it. An installer checks for it and runs Microsoft's bootstrapper (online) or standalone installer (offline) when it's missing, and the app checks again at startup, because a missing runtime is otherwise an exception when the control first initializes:

```csharp
string? version = null;
try
{
    version = CoreWebView2Environment.GetAvailableBrowserVersionString();
}
catch (Exception)
{
    // No runtime found
}

if (string.IsNullOrEmpty(version))
{
    // Tell the user the runtime is missing and how to install it
}
```

Evergreen has two consequences for code. First, a running app keeps the runtime version it started with, so an app that stays open for days misses security fixes until it restarts or releases every WebView2 environment, the `CoreWebView2Environment` object that ties controls to a runtime and a profile folder (see the next section). The environment's `NewBrowserVersionAvailable` event is the cue to offer a restart, which matters most when the app shows third-party content. Second, the runtime on a user's machine can be older than the SDK the app built against, for instance where an administrator has blocked updates, so code that uses a recently added API checks that it's available, with a `try`/`catch` around the call.

A Fixed Version app passes its runtime folder as `browserExecutableFolder` when it creates the environment, or sets the `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` environment variable before the first control initializes, and it owns patching that runtime. Microsoft offers downloads only for the latest two major versions, so the app keeps an archive of the version it depends on. From Fixed Version 120, an unpackaged app on Windows 10 also has to grant the `ALL APPLICATION PACKAGES` and `ALL RESTRICTED APPLICATION PACKAGES` groups read and execute access to the runtime folder at install time, because the renderer now runs in an app container, Windows' sandbox for processes with limited rights. Without the grant, the runtime stops working.

---

## Processes and the User Data Folder

A WebView2 doesn't run inside the app's process, and where its state lives decides which controls share that process. The state lives in a user data folder (UDF), which holds the browser profile: cookies, local storage, the cache, and permission grants. The first control created for a given UDF starts a browser process, and that process manages renderer processes for the pages, a GPU process, and other helpers. Every control that uses the same UDF, with the same environment options, shares that one process group, whether the controls are in the same window, different windows, or different apps in the same sign-in session.

The UDF's location decides which controls share state and whether WebView2 can start at all:

- **Packaged app**: the default UDF goes under the package's `LocalFolder`, which the app can always write to.
- **Unpackaged app**: the default UDF is created next to the executable. That fails when the app is installed under `Program Files`, which standard users can't write to, so an unpackaged app sets a custom location under `%LOCALAPPDATA%` and removes it on uninstall itself.

A custom location, or any other environment option, goes into a `CoreWebView2Environment` that the app passes to `EnsureCoreWebView2Async` before anything else initializes the control (Windows App SDK 1.5 and later):

```csharp
string udf = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "Contoso", "WebView2");

var environment = await CoreWebView2Environment.CreateWithOptionsAsync(
    browserExecutableFolder: null,   // null uses the Evergreen runtime
    userDataFolder: udf,
    options: new CoreWebView2EnvironmentOptions());

await Browser.EnsureCoreWebView2Async(environment);
```

{% include figure.html id="winui-webview2-processes" %}

Two rules follow from the sharing. Every environment that names the same UDF must be created with the same options, such as the same language, or controls from the second one fail to create. And separate UDFs mean separate process groups, each with its own memory and disk cost. An app that needs isolated sign-ins, such as two accounts side by side, uses profiles instead: named folders of browser data inside one UDF, served by the one browser process. The app creates `CoreWebView2ControllerOptions` from the environment, sets `ProfileName` (and `IsInPrivateModeEnabled` for a session that saves nothing), and passes both to `EnsureCoreWebView2Async(environment, options)`. The app ends a control's session with `WebView2.Close()`. Deleting a UDF works only after its browser process and all its children have exited, and the process ID to wait on is `CoreWebView2.BrowserProcessId`. To clear a user's data while the app runs, the browsing-data APIs remove cookies or cache without deleting the folder.

Because the browser is another process, it can crash on its own. `CoreWebView2.ProcessFailed` reports a process in the group exiting unexpectedly, or a renderer that stops responding, and its arguments say which process failed and how. Some failures recover on their own, and the documentation for `CoreWebView2ProcessFailedKind` lists the ones the app has to handle itself. When the failed process is the browser process, the environment's `BrowserProcessExited` event fires as well.

---

## Initialization and Threading

The control starts its `CoreWebView2` asynchronously, when `Source` is first set or when the app calls `EnsureCoreWebView2Async`. Until that finishes, the `CoreWebView2` property is `null`. Setting `Source` in XAML is safe because the control holds the navigation until it's ready, but code that uses `CoreWebView2` awaits initialization first:

```csharp
await Browser.EnsureCoreWebView2Async();
Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
Browser.CoreWebView2.Navigate("https://contoso.example/app");
```

The `CoreWebView2Initialized` event reports the same moment, including a failure such as a missing runtime or an unwritable UDF, for code that doesn't await.

Like any XAML element, the control and its `CoreWebView2` belong to the UI thread, and their events arrive there. Blocking that thread on a WebView2 task with `.Result` or `.Wait()` deadlocks the app, because the responses WebView2 is waiting to deliver need the same thread to be free.

---

## Navigation

A navigation normally raises this sequence of events on `CoreWebView2`, and the WinUI control repeats the first and last on itself:

1. **`NavigationStarting`**: before the request goes out. Setting `args.Cancel` blocks it. A redirect raises it again with `IsRedirect` set.
2. **`SourceChanged`**: the URL changed, which also covers in-page fragment changes that make no request.
3. **`ContentLoading`**: the new document has started loading.
4. **`HistoryChanged`**: the back and forward history updated.
5. **`BasicAuthenticationRequested`**: only when the server asks for HTTP Basic credentials.
6. **`DOMContentLoaded`**: the DOM is parsed, and images or scripts may still be loading.
7. **`NavigationCompleted`**: loading finished, with `IsSuccess` and `WebErrorStatus` reporting failures.

A failed navigation may skip `ContentLoading`, depending on whether it continues to an error page.

Every event carries the same `NavigationId` for one navigation. A second navigation started before the first completes interleaves its events with the first's, so handlers that track state match events by `NavigationId`. Navigations inside an `iframe` raise separate `FrameNavigationStarting` and `FrameNavigationCompleted` events, and an allowlist that checks only `NavigationStarting` misses them.

Links that open a new window, through `target="_blank"` or `window.open`, raise `NewWindowRequested`. Unless the handler sets `args.Handled` or supplies `args.NewWindow`, WebView2 opens the page in a separate popup window of its own, outside the app's layout and styling. Most apps either navigate the current control or hand the link to the user's browser:

```csharp
Browser.CoreWebView2.NewWindowRequested += async (sender, args) =>
{
    args.Handled = true;

    // Only web links go to the browser; ms-settings:, file:, and custom schemes don't
    if (Uri.TryCreate(args.Uri, UriKind.Absolute, out Uri? target) &&
        (target.Scheme == Uri.UriSchemeHttps || target.Scheme == Uri.UriSchemeHttp))
    {
        await Windows.System.Launcher.LaunchUriAsync(target);
    }
};
```

The scheme check matters because the page chooses the URI, and `LaunchUriAsync` opens whatever app is registered for it.

`GoBack`, `GoForward`, `Reload`, `CanGoBack`, and `CanGoForward` on the control drive the history.

---

## Loading Local Content

An app that ships its own HTML, such as a bundled single-page app or offline help, has four ways to load it. They differ in the origin the page gets, the scheme, host, and port that browsers use to decide which pages share storage and may call each other. Some web APIs also work only in a secure context, meaning a page served over HTTPS:

| Approach | The page gets | Limits |
| --- | --- | --- |
| `file:///` URL | An origin per file path | No HTTPS-only web APIs (camera, geolocation, notifications), no cross-origin requests, full paths for every resource |
| `NavigateToString` | A `null` origin at `about:blank` | 2 MB maximum, no `localStorage` or other origin-based APIs, no separate CSS or script files |
| `SetVirtualHostNameToFolderMapping` | A real HTTPS origin for a host name the app picks | Static files only, slow media loading, no separate source maps |
| `WebResourceRequested` | Whatever responses the app builds | Every intercepted request crosses to the app's UI thread, so it's the slowest and the most code |

Virtual host name mapping fits most bundled content. It maps a host name to a folder, so relative links, `localStorage`, `fetch`, and secure-context APIs all work as they would on a web server:

```csharp
string folder = Path.Combine(AppContext.BaseDirectory, "web");
Browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
    "appassets.example", folder, CoreWebView2HostResourceAccessKind.Deny);
Browser.CoreWebView2.Navigate("https://appassets.example/index.html");
```

Microsoft recommends a host name no real site uses, and the reserved `.example`, `.test`, and `.invalid` domains are guaranteed never to be registered. A `.local` name works but slows navigation. Content from sources the app trusts differently, such as its own files and downloaded documents, gets a separate host name each, so the browser keeps them in separate origins. The access kind sets what other origins may load from the mapped folder: `Deny` blocks them, `Allow` permits them, and `DenyCors` permits only requests that don't need CORS (the protocol a server uses to let other origins' scripts read its responses), so an `<img>` tag loads but a `fetch` call doesn't. Microsoft's advice is the least access that works, which is `Deny` when, as here, only the app's own pages load these files. `WebResourceRequested` is the choice only when responses have to be generated per request, such as content decrypted or assembled at run time.

---

## Talking Between the App and the Page

Four channels cross between the app and the page:

| Channel | Direction | What crosses | Fits |
| --- | --- | --- | --- |
| Web messages | Both ways | JSON or a string, checked by the receiver | Most app-page conversations |
| `ExecuteScriptAsync` | App to page | A script to run, and its result back as JSON | Reading a value or calling a function the page defines |
| `AddScriptToExecuteOnDocumentCreatedAsync` | App to every future page | A script that runs before the page's own | A small bridge library |
| Host objects | Page to app | Direct calls on an app object | Rarely, in WinUI 3 (see below) |

Web messages are the standard channel in both directions. The app posts to the page with `PostWebMessageAsJson` or `PostWebMessageAsString`, and the page listens on `window.chrome.webview`. The page posts back with `window.chrome.webview.postMessage`, and the app receives it in `WebMessageReceived`:

```csharp
Browser.CoreWebView2.WebMessageReceived += (sender, args) =>
{
    if (new Uri(args.Source).Host != "appassets.example")
    {
        return;   // A message from a page the app didn't expect
    }

    var request = JsonSerializer.Deserialize<PageRequest>(args.WebMessageAsJson);
    // Validate request, then act on it
};

Browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(status));
```

```javascript
window.chrome.webview.addEventListener("message", event => render(event.data));
window.chrome.webview.postMessage({ action: "save", id: 42 });
```

A JSON message built with a serializer can't be turned into running script by the data inside it, which is why Microsoft recommends `PostWebMessageAsJson` for anything carrying user or network data. `CoreWebView2.WebMessageReceived` hears only the top-level document, and a page inside an `iframe` messages through its `CoreWebView2Frame` instead.

The two script channels run in whatever page is loaded at the time, including one the user reached by following a link. `AddScriptToExecuteOnDocumentCreatedAsync` keeps running in every page after that, and building script text from variable data invites injection, so data travels in web messages even when the app also injects script.

WebView2 can also expose an app object to script as a host object, so JavaScript calls its methods directly. In WPF and WinForms that works with any COM-visible .NET class. WinUI 3 uses the WinRT flavor of WebView2, and WinRT has no `IDispatch` for script to call through, so a WinUI 3 app first runs Microsoft's `wv2winrt` tool, which generates a C++/WinRT adapter project for the chosen WinRT types. That's enough ceremony that messages are usually the better bridge. A host object also hands script a standing capability rather than a message the app checks each time.

---

## Keeping Hosted Content in Its Place

A browser keeps a web page in a sandbox. A WebView2 page can reach past it, through messages, host objects, and injected scripts, into an app that runs with the user's full permissions. Microsoft's guidance starts from treating all web content as untrusted, even the app's own, because the control can end up on another page through a link, a redirect, or a compromised script.

- **Check where each message came from.** `WebMessageReceived` reports the sending document's URL in `args.Source`. The app acts only on messages from origins it expects, and validates the payload even then.
- **Keep navigation on known origins.** The navigation events covered earlier are the enforcement point: an allowlist in both `NavigationStarting` and `FrameNavigationStarting`, and outside links handed to the browser from `NewWindowRequested`.
- **Turn off what the content doesn't need.** `CoreWebView2Settings` has `IsWebMessageEnabled`, `AreHostObjectsAllowed`, `IsScriptEnabled`, `AreDefaultScriptDialogsEnabled`, `AreDevToolsEnabled`, and `AreDefaultContextMenusEnabled`. A control that shows static documentation needs none of the bridges.
- **Withdraw host objects on navigation.** `RemoveHostObjectFromScript` in the `ContentLoading` handler keeps a host object from following the user to another page.
- **Host WebView2 in a non-elevated process.** Microsoft recommends running the hosting process at standard user integrity. An app that needs administrator rights for some work does it in a separate elevated process. WebView2 also refuses to run as the SYSTEM account.

SmartScreen checks the URLs the control navigates to. `CoreWebView2Settings.IsReputationCheckingRequired` (default `true`) controls it, and the setting is shared by every control on the same UDF: SmartScreen stays on while any of them has it `true`, and turning off the Windows "SmartScreen for Microsoft Edge" setting disables it regardless ("SmartScreen for Microsoft Store apps" plays that role for a Store app). An app that shows only its own bundled content can turn it off, and an app that shows arbitrary sites keeps it on.

WebView2 also isn't a sign-in surface. Showing an identity provider's sign-in page in the control and reading tokens out of redirects or cookies is the embedded-browser pattern that many providers block, so sign-in happens outside the control and WebView2 hosts content the user is already signed in to.
