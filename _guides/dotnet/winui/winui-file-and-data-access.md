---
title: "File and Data Access"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Where a WinUI 3 app reads and writes data, and how package identity changes the answer: file and folder pickers in the Windows App SDK and the legacy window-handle pattern, app settings and files in ApplicationData, a local SQLite database, drag and drop, and the clipboard."
tags: [file-pickers, applicationdata, package-identity, sqlite, drag-and-drop, clipboard, practical]
---

## Package Identity Decides Which Storage APIs Work

By default a WinUI app is a desktop app that runs with full trust. Unlike a UWP app, it doesn't run inside an app container, the sandbox that limits a UWP app to its own storage, so `System.IO` can read and write any path the signed-in user can. The `Windows.Storage` types (`StorageFile`, `FileIO`) are one option among several rather than the only route. (A packaged app can opt into an app container in its manifest, and then these freedoms no longer apply.)

What does vary is whether the app has **package identity**. It has identity when it is installed from an MSIX package, the Windows app package format, or registered with a package that points at its files in an external location. It lacks identity when it runs as a plain unpackaged executable. Several storage APIs are tied to that identity:

| API | Packaged | Unpackaged |
| --- | --- | --- |
| `System.IO` with paths from `Environment.GetFolderPath` | Works | Works |
| Windows App SDK pickers (`Microsoft.Windows.Storage.Pickers`) | Works | Works |
| `Windows.Storage.ApplicationData.Current` | Works | Throws `InvalidOperationException` ("The process has no package identity") |
| `Microsoft.Windows.Storage.ApplicationData.GetDefault()` | Works | Requires package identity |
| `Microsoft.Windows.Storage.ApplicationData.GetForUnpackaged(publisher, product)` | Not needed | Works, from Windows App SDK 2.2 |

Microsoft's app data guidance says the `ApplicationData` APIs "are designed for packaged apps," and that unpackaged apps "should use alternative storage mechanisms such as direct file I/O or registry access."

Packaging also changes what ordinary file I/O does. A packaged app's install folder is read-only once deployed, so nothing the app writes at runtime can go next to its executable. And by default, new files and folders a packaged desktop app creates under the user's `AppData` folder, even through `System.IO`, are redirected to a private per-user, per-package location. The app reads them back at the path it wrote, but other processes can't see them, and Windows removes them when the app is uninstalled. A packaged app that needs a folder shared with other tools declares an exception in its manifest, as [flexible virtualization](https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization){:target="_blank" rel="noopener noreferrer"} describes.

---

## Letting the User Pick Files

### The Windows App SDK Pickers

Since Windows App SDK 1.8, the [`Microsoft.Windows.Storage.Pickers`](https://learn.microsoft.com/en-us/windows/apps/develop/files/using-file-folder-pickers){:target="_blank" rel="noopener noreferrer"} namespace provides `FileOpenPicker`, `FileSavePicker`, and `FolderPicker`. Each takes the `WindowId` of the window that owns the dialog in its constructor, and each returns a result carrying the chosen **path** rather than a `StorageFile`:

```csharp
using Microsoft.Windows.Storage.Pickers;

var picker = new FileOpenPicker(XamlRoot.ContentIslandEnvironment.AppWindowId)
{
    SuggestedStartLocation = PickerLocationId.DocumentsLibrary,
    FileTypeFilter = { ".md", ".txt" },
};

PickFileResult? result = await picker.PickSingleFileAsync();
if (result is not null)
{
    string text = await File.ReadAllTextAsync(result.Path);
}
```

From a `Window`, pass `AppWindow.Id`. From a page, go through its `XamlRoot`, the root of the element tree the page is shown in, whose `ContentIslandEnvironment.AppWindowId` gives the ID of the window the page is in, once the page is loaded. The result is `null` when the user cancels. `FileSavePicker` returns the path the user chose without creating the file (it did create it before Windows App SDK 2.0), so the app writes it with ordinary file I/O. Version 2.0 also added a `SettingsIdentifier` that makes each picker remember its own state across sessions, grouped `FileTypeChoices` on `FileOpenPicker` (the save picker already had them), and `FolderPicker.PickMultipleFoldersAsync`.

### The Legacy Pickers and the Window Handle

`Windows.Storage.Pickers`, the UWP-era pickers, still work, and code migrated from UWP or targeting Windows App SDK 1.7 or earlier uses them. They don't work when the app runs as an administrator, which the newer pickers do support. A UWP app's picker found its owner from the app's single core window, which a WinUI app doesn't have, so these pickers must be given the owning window's handle before any `Pick*Async` call, or they throw or fail silently:

```csharp
var picker = new Windows.Storage.Pickers.FileOpenPicker();
picker.FileTypeFilter.Add(".md");

IntPtr hwnd = WinRT.Interop.WindowNative.GetWindowHandle(window);
WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);

Windows.Storage.StorageFile? file = await picker.PickSingleFileAsync();
```

These return a `StorageFile`, which also carries a `Path`.

### Pickers Behind a Service

A picker needs a window ID, which a view model shouldn't know about. Put the picker behind an interface, such as `IFilePickerService` with a method returning `Task<string?>`, whose implementation lives in the UI layer and is given the window it serves. The same approach suits settings and storage in general. A view model that asks an `ISettingsService` for a value can be tested with a fake, and the app can choose a packaged or an unpackaged implementation at startup.

### Remembering What the User Picked

A full-trust app, packaged or not, can reopen a path the user picked earlier just by storing the path, since its access depends on the user's file permissions rather than on a grant from the picker. The [`StorageApplicationPermissions` lists](https://learn.microsoft.com/en-us/windows/apps/develop/files/track-recently-used-files-folders){:target="_blank" rel="noopener noreferrer"} exist mainly for sandboxed apps, where a picked file would otherwise be unreachable later. `FutureAccessList` keeps that permission for up to 1,000 items and never removes any itself. `MostRecentlyUsedList` keeps the 25 most recently used items, dropping the oldest, and can back a recent-files menu. Both store `StorageFile` and `StorageFolder` objects and hand back a token that the app saves and later exchanges for the item. Use them from a packaged app, since at least one report shows `FutureAccessList.Add` failing in an unpackaged one.

---

## App Data: Settings and Files

### Settings for Small Values

`LocalSettings`, an `ApplicationDataContainer` from a packaged app's `ApplicationData`, stores key-value pairs that survive restarts and app updates:

```csharp
var settings = Microsoft.Windows.Storage.ApplicationData.GetDefault().LocalSettings;

settings.Values["Theme"] = "Dark";
settings.Values["LastOpenedPath"] = @"C:\Users\Ana\Documents\notes.md";

string theme = settings.Values["Theme"] as string ?? "Default";
```

`LocalSettings` is a container, and its `Values` holds only simple types, namely numbers, `bool`, `char`, `string`, `DateTimeOffset`, `TimeSpan`, `Guid`, `Point`, `Size`, `Rect`, and `ApplicationDataCompositeValue`, which groups related values so they are written together atomically. Anything larger or more structured belongs in a file or a database.

An unpackaged app gets the same API from `ApplicationData.GetForUnpackaged(publisher, product)` on Windows App SDK 2.2 or later, or writes a small JSON file in its own folder under `Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)`.

### Files, Cache, and Temporary Data

A packaged app's `ApplicationData` also provides folders, each with a `StorageFolder` property and a string path property for `System.IO`:

| Store | Path property | Use it for |
| --- | --- | --- |
| Local | `LocalPath` | Data the app needs between sessions, such as a database or downloaded content. Microsoft's API reference describes this location as backed up to the cloud |
| Local cache | `LocalCachePath` | Data that can be rebuilt and shouldn't be included in backup and restore |
| Temporary | `TemporaryPath` | Scratch files. The system can delete them at any time |

Roaming data, which once synced app settings and files across a user's devices, is no longer supported as of Windows 11, and Microsoft points to a cloud service instead. Even on Windows 10, Microsoft warns that `RoamingSettings` may not survive a Microsoft Store update, so settings that must last belong in `LocalSettings`.

### App Data Is Deleted with the App

Everything in these stores is tied to the app's lifetime and removed when the user uninstalls it. That makes it the right home for preferences, caches, and state, and the wrong home for anything the user created and would expect to keep, such as documents. Save those where the user chooses, through a save picker, or in a cloud service.

---

## A Local Database

When data has structure, relationships, or needs querying, a SQLite database is the usual choice for a desktop app. It is a single file with no server, and Entity Framework Core reads and writes it through the `Microsoft.EntityFrameworkCore.Sqlite` provider. What WinUI adds is where the file lives and which thread touches it:

```csharp
string folder = Microsoft.Windows.Storage.ApplicationData.GetDefault().LocalPath;   // packaged
string dbPath = Path.Combine(folder, "notes.db");

services.AddDbContextFactory<NotesContext>(options => options.UseSqlite($"Data Source={dbPath}"));
```

An unpackaged app builds the path from `LocalApplicationData` instead. A context factory hands out a new `DbContext` for each operation. EF Core designs a context for a single unit of work and doesn't support using one from two threads at once, and a desktop app, with no request to scope a context to, can easily have two view models loading at the same moment.

The async methods don't keep the window responsive here. SQLite has no asynchronous I/O, and Microsoft.Data.Sqlite, which the EF Core provider uses, runs its async methods synchronously, so `await context.Notes.ToListAsync()` called on the UI thread does the whole query on the UI thread. Run database work on a background thread, for example inside `Task.Run`, and hand the results back to the UI. Apply migrations the same way, at startup before the first window loads data.

SQLite handles one app's data well. It serializes writes, with one writer at a time, which makes it a poor fit for data several processes update at once. Databases created by EF Core use write-ahead logging by default, which lets reads proceed while a write is in progress.

---

## Drag and Drop

Drag and drop moves data as a `DataPackage` from `Windows.ApplicationModel.DataTransfer`, the same type the clipboard uses. The source fills a package, and the target reads it through a read-only `DataPackageView`, checking which formats it holds against the identifiers in `StandardDataFormats`. A control accepts drops when `AllowDrop="True"`, it handles `DragOver` and `Drop`, and it can be hit-tested. A panel with no background can't be, so a drop area that should look empty needs `Background="Transparent"` rather than none:

```csharp
private void DropTarget_DragOver(object sender, DragEventArgs e)
{
    if (e.DataView.Contains(StandardDataFormats.StorageItems))
    {
        e.AcceptedOperation = DataPackageOperation.Copy;
    }
}

private async void DropTarget_Drop(object sender, DragEventArgs e)
{
    if (e.DataView.Contains(StandardDataFormats.StorageItems))
    {
        IReadOnlyList<IStorageItem> items = await e.DataView.GetStorageItemsAsync();
        foreach (StorageFile file in items.OfType<StorageFile>())
        {
            await ImportAsync(file.Path);
        }
    }
}
```

The target sets `AcceptedOperation` in `DragEnter` or `DragOver` to say which operation it will accept, and the drag UI reflects that choice to the user. Files dragged from File Explorer arrive as `StorageFile` items with a `Path`.

To let the user drag data out of the app, set `CanDrag="True"` on the source element and fill the package in `DragStarting`:

```csharp
private void Note_DragStarting(UIElement sender, DragStartingEventArgs e)
{
    e.Data.SetText(_note.Content);
    e.Data.RequestedOperation = DataPackageOperation.Copy;
}
```

Without a custom visual, the system builds a drag image from the element. `e.DragUI` lets the source supply its own. A source that offers `Move` handles `DropCompleted` to learn which operation the target performed, and removes the item only if it was moved.

---

## Clipboard

The static `Clipboard` class in the same namespace reads and writes a `DataPackage`, so code that builds one for drag and drop can build one for copy:

```csharp
var package = new DataPackage();
package.SetText(_note.Content);
Clipboard.SetContent(package);

DataPackageView content = Clipboard.GetContent();
if (content.Contains(StandardDataFormats.Text))
{
    string text = await content.GetTextAsync();
}
```

Standard formats include text, HTML, RTF, bitmaps, links, and storage items. An app can also define its own format with a string identifier, writing serialized data such as a JSON string with `SetData("myapp.note", json)` and reading it with `GetDataAsync("myapp.note")`. Only an app that knows the identifier can read it, so an app that also calls `SetText` on the same package lets paste within the app carry the rich data while other apps get plain text.

Two details catch desktop apps. Microsoft's API reference says an app can access the clipboard only while it has focus, and only from its UI thread. And content an app places on the clipboard can disappear when the app exits, unless the app calls `Clipboard.Flush()`, which hands the content over so it stays available after shutdown.

`Clipboard.ContentChanged` reports changes to the clipboard. Reading the clipboard in response to it, rather than when the user asks to paste, means reading whatever the user copies, passwords included, so reserve it for features that exist to watch the clipboard and make that behavior visible to the user.

---

## Choosing Where Data Lives

| Data | Where it goes |
| --- | --- |
| Preferences and small state, like the theme or the last window size | Local settings when packaged, or a small JSON file in the app's own folder under `LocalApplicationData` when unpackaged |
| Structured or queryable data the app owns | A SQLite database in the app's local data folder, private to the app and removed on uninstall when packaged |
| Content that can be downloaded or rebuilt | The local cache folder |
| Scratch files for the current session | The temporary folder |
| Documents the user creates and expects to keep | A location the user picks, or a cloud service, never app data |
| Data moving between apps | Drag and drop or the clipboard, landing in one of the rows above |
