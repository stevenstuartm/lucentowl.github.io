---
title: "File and Data Access"
layout: guide
category: "WinUI 3"
subcategory: "Data & MVVM"
description: "Accessing files, local databases, and application settings in WinUI 3 using file pickers, SQLite with Entity Framework Core, ApplicationData, drag and drop, and the clipboard."
tags: [winui, winui-3, data-access, sqlite, file-system, entity-framework, desktop, practical]
---

## Table of Contents

- [File and Folder Pickers](#file-and-folder-pickers)
- [SQLite with Entity Framework Core](#sqlite-with-entity-framework-core)
- [ApplicationData and Settings](#applicationdata-and-settings)
- [Drag and Drop](#drag-and-drop)
- [Clipboard Access](#clipboard-access)
- [Choosing the Right Storage Approach](#choosing-the-right-storage-approach)

---

## File and Folder Pickers

WinUI 3 desktop applications can open file pickers through the `FileOpenPicker`, `FileSavePicker`, and `FolderPicker` classes, but there is one significant difference from UWP: desktop apps require an explicit window handle before showing any picker dialog. UWP handled this automatically because each app ran in a single-window sandboxed process. Desktop apps run in a standard Win32 process and can have multiple top-level windows, so the system needs to know which window should own the dialog.

You retrieve the window handle using `WindowNative.GetWindowHandle` and pass it to the picker through `InitializeWithWindow.Initialize`:

```csharp
using Microsoft.UI.Xaml;
using WinRT.Interop;
using Windows.Storage.Pickers;

var picker = new FileOpenPicker();
picker.FileTypeFilter.Add(".png");
picker.FileTypeFilter.Add(".jpg");

var hwnd = WindowNative.GetWindowHandle(this); // 'this' is your Window
InitializeWithWindow.Initialize(picker, hwnd);

var file = await picker.PickSingleFileAsync();
if (file != null)
{
    // file.Path gives you the full path as a string
}
```

`FolderPicker` works the same way, and `FileSavePicker` follows the same pattern with `SuggestedStartLocation` and `FileTypeChoices` to control the default directory and allowed extensions. You can also restrict to a single-select or multi-select mode through `PickSingleFileAsync` versus `PickMultipleFilesAsync`.

Windows App SDK 1.8 introduced a simplified picker API that removes the need to manually call `InitializeWithWindow`. When you create the picker through the new factory methods that accept a window reference directly, the initialization step happens internally. If your project targets SDK 1.8 or later, the simplified approach reduces boilerplate, but the `InitializeWithWindow` pattern remains common in older codebases and is worth knowing.

Once you have a `StorageFile` from a picker, you can read its contents as text using `FileIO.ReadTextAsync(file)` or as a byte stream through `file.OpenAsync(FileAccessMode.Read)`. Writing follows the same pattern with `FileIO.WriteTextAsync` or by acquiring a write stream. These are the same `Windows.Storage` APIs that existed in UWP, so documentation and examples from UWP file access apply directly to WinUI 3 desktop.

---

## SQLite with Entity Framework Core

For applications that need to persist structured data locally, SQLite is the natural choice. It is a file-based relational database that requires no installation, no server process, and no network configuration. Entity Framework Core provides a .NET-native data access layer on top of SQLite, letting you work with your database through C# classes and LINQ rather than raw SQL strings.

To get started, add the `Microsoft.EntityFrameworkCore.Sqlite` package from NuGet. You will also want `Microsoft.EntityFrameworkCore.Tools` if you plan to use migrations from the package manager console, and `Microsoft.EntityFrameworkCore.Design` for the design-time tooling.

Define your entities as plain C# classes and your context by inheriting from `DbContext`:

```csharp
public class Note
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AppDbContext : DbContext
{
    public DbSet<Note> Notes { get; set; } = null!;

    protected override void OnConfiguring(DbContextOptionsBuilder options)
    {
        var folder = ApplicationData.Current.LocalFolder.Path;
        var dbPath = Path.Combine(folder, "app.db");
        options.UseSqlite($"Data Source={dbPath}");
    }
}
```

Storing the database file in `ApplicationData.Current.LocalFolder` keeps it within the per-user app data directory, where the application always has write access without requiring elevated permissions.

Migrations let EF Core manage schema changes as your entities evolve. You run `Add-Migration InitialCreate` in the package manager console to generate migration files, then apply them at application startup:

```csharp
using var context = new AppDbContext();
context.Database.Migrate();
```

Calling `Migrate()` at startup creates the database if it does not exist and applies any pending migrations. This is appropriate for desktop apps where you control the upgrade lifecycle; server applications typically apply migrations through a separate deployment step.

Querying uses LINQ directly against your `DbSet`:

```csharp
var recentNotes = await context.Notes
    .Where(n => n.CreatedAt > DateTime.Today.AddDays(-7))
    .OrderByDescending(n => n.CreatedAt)
    .ToListAsync();
```

SQLite works well for single-user desktop applications, small-to-medium datasets, and local caches. It is less suited for scenarios involving concurrent write access from multiple processes, very large datasets where a full relational engine would offer better optimization, or applications requiring stored procedures and advanced database features. For most WinUI 3 desktop apps, SQLite covers the full range of local persistence needs without unnecessary complexity.

---

## ApplicationData and Settings

Not everything belongs in a database. User preferences, window dimensions, last-opened file paths, and feature toggles are better stored as key-value pairs through `ApplicationData`. The `ApplicationData.Current` property gives access to local storage, roaming storage, and temporary storage areas that the OS manages on behalf of the application.

`LocalSettings` stores key-value pairs in the application's local data folder. Values survive application restarts and persist until the user uninstalls the app:

```csharp
var settings = ApplicationData.Current.LocalSettings;

// Write a setting
settings.Values["theme"] = "dark";
settings.Values["lastOpenedPath"] = @"C:\Users\username\Documents";

// Read a setting with a fallback
var theme = settings.Values["theme"] as string ?? "light";
```

Settings values can be strings, numbers, booleans, and other primitive types. For structured data, you can serialize to JSON and store as a string, though if the data grows complex enough to warrant serialization, a SQLite table is often the cleaner choice.

`LocalFolder` gives you a `StorageFolder` representing the application's local data directory. You can create files and subdirectories here for any content the app needs to persist that is larger than a simple setting value:

```csharp
var localFolder = ApplicationData.Current.LocalFolder;
var cacheFile = await localFolder.CreateFileAsync(
    "cache.json",
    CreationCollisionOption.ReplaceExisting);
await FileIO.WriteTextAsync(cacheFile, jsonContent);
```

Roaming storage, accessible through `RoamingFolder` and `RoamingSettings`, synchronizes data across devices when the user is signed into a Microsoft account. WinUI 3 packaged apps can use roaming storage, though Microsoft has signaled that roaming storage is a legacy feature with limited investment going forward. For new apps that need cross-device sync, consider a cloud backend rather than relying on roaming storage.

---

## Drag and Drop

WinUI 3 controls support drag and drop through a set of events on `UIElement`. To allow a control to accept dropped content, set `AllowDrop="True"` in XAML and handle the `DragOver` and `Drop` events. To make a control draggable, handle `DragStarting` and populate a `DataPackage`.

Accepting files dragged from File Explorer is a common pattern:

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
        var items = await e.DataView.GetStorageItemsAsync();
        foreach (var item in items)
        {
            if (item is StorageFile file)
            {
                // Process the file
            }
        }
    }
}
```

The `DragOver` handler must set `e.AcceptedOperation` to something other than `None` for the `Drop` event to fire. Setting it in `DragOver` also controls the cursor icon shown during the drag, indicating to the user whether a copy, move, or link operation will occur.

For dragging data out of your app, handle `DragStarting` on the source element and populate the event's `Data` property:

```csharp
private void Source_DragStarting(UIElement sender, DragStartingEventArgs e)
{
    e.Data.SetText("Some draggable text");
    e.Data.RequestedOperation = DataPackageOperation.Copy;
}
```

You can customize the drag visual through `e.DragUI.SetContentFromDataPackage()` or by providing a custom `SoftwareBitmap`. If you do not provide a custom visual, the system generates a thumbnail automatically.

WinUI 3 drag and drop follows the same `DataPackage` model used throughout the Windows App SDK for clipboard and share operations, so the patterns transfer between them.

---

## Clipboard Access

The clipboard in WinUI 3 is accessed through the static `Clipboard` class in the `Windows.ApplicationModel.DataTransfer` namespace. Reading and writing follow the `DataPackage` pattern used in drag and drop, which means the same code structure handles both features.

Writing text to the clipboard:

```csharp
var package = new DataPackage();
package.SetText("Hello, clipboard");
Clipboard.SetContent(package);
```

Reading from the clipboard requires checking what formats are present before attempting to retrieve a value:

```csharp
var content = Clipboard.GetContent();
if (content.Contains(StandardDataFormats.Text))
{
    var text = await content.GetTextAsync();
}
```

Images use `StandardDataFormats.Bitmap`, and files use `StandardDataFormats.StorageItems`. For HTML, use `StandardDataFormats.Html`, which delivers the content as an HTML fragment string.

Custom formats allow applications to share data in proprietary formats that only applications understanding the format can consume. You define a custom format identifier as a string and use `SetData` and `GetDataAsync`:

```csharp
// Writing a custom format
package.SetData("com.myapp.notedata", serializedNote);

// Reading a custom format
if (content.Contains("com.myapp.notedata"))
{
    var data = await content.GetDataAsync("com.myapp.notedata");
}
```

To receive notifications when the clipboard contents change, subscribe to `Clipboard.ContentChanged`:

```csharp
Clipboard.ContentChanged += async (s, e) =>
{
    var content = Clipboard.GetContent();
    // Inspect or react to new clipboard contents
};
```

Be conservative with clipboard monitoring. Applications that continuously read from the clipboard raise user trust concerns, and Windows 10 and 11 notify users when an app accesses clipboard data. Reading only in direct response to user actions is the right default.

---

## Choosing the Right Storage Approach

The four storage mechanisms covered in this guide serve different purposes, and picking the wrong one for a task creates unnecessary friction. A few rules of thumb make the decision straightforward for most cases.

Use `LocalSettings` for small, simple values that control application behavior: the selected theme, remembered window bounds, a boolean for whether a first-run dialog has been shown, or the path of the last opened file. Settings entries should be independent scalar values, not collections or complex objects.

Use `LocalFolder` for files the application manages directly, such as cached data from a web API, exported documents waiting for the user to copy elsewhere, or temporary work files. The folder gives you full file system access within a safe, per-app boundary, and `StorageFile` and `FileIO` provide async-friendly wrappers over the underlying streams.

Use SQLite with EF Core when the data has structure, relationships, or needs querying. A note-taking app's notes belong in SQLite. An inventory list where you filter by category and sort by date belongs in SQLite. A log of application events that you query for the last hundred entries belongs in SQLite. If you find yourself storing JSON strings in `LocalSettings` to represent anything beyond a single object, you have outgrown settings and should move to a local database.

Use file pickers when the user needs to choose where data comes from or goes to. Pickers are for user-initiated open and save operations against arbitrary locations in the file system, not for internal data management. The distinction matters because picker-accessed files live outside the app's private storage and may require `Windows.Storage` bookmarks to re-access without asking the user again.

Drag and drop and clipboard occupy a different dimension from the others: they are transfer mechanisms rather than storage mechanisms. They move or copy data between applications, or between different parts of the same application. The data being transferred will typically land in one of the four storage options once the transfer completes.

One area worth thinking through early is data that needs to survive an application update or reinstall. `LocalSettings` and `LocalFolder` both live under the application's data directory, which the OS may clear when the app is uninstalled. For data users would consider irreplaceable, such as documents or records they have created, the correct pattern is to store it somewhere the user controls, such as their Documents folder accessed via a picker, or in a cloud backend. App-managed local storage is best treated as semi-persistent infrastructure data, not as the primary home for user content.
