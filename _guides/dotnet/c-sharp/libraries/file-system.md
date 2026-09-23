---
title: "C# File System Operations"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "System.IO in practice: whole-file and streaming reads and writes, encodings, paths and the Path.Combine traversal trap, FileStream modes and sharing, crash-safe writes, directory enumeration, FileSystemWatcher's limits, the I/O exception hierarchy, and custom binary formats with BinaryWriter and BinaryReader."
tags: [file-io, filestream, path, filesystemwatcher, binarywriter, streams, practical]
---

## Whole-File Operations

The static `File` methods open a file, do one thing, and close it. For files that comfortably fit in memory, they're all you need:

```csharp
string text = File.ReadAllText("config.json");
File.WriteAllText("output.txt", "Hello, World!");

string[] lines = File.ReadAllLines("data.csv");
File.WriteAllLines("output.csv", lines);

byte[] bytes = File.ReadAllBytes("image.png");
File.WriteAllBytes("copy.png", bytes);

File.AppendAllText("log.txt", "New entry" + Environment.NewLine);
```

Each has an `Async` counterpart (`ReadAllTextAsync`, `WriteAllLinesAsync`, and so on) taking a `CancellationToken`. Async file I/O is worth it where a thread must not block, like a UI thread or a server's request path. In a console tool or a batch job, the synchronous calls are simpler and give up nothing.

### Encodings

Reading detects a byte order mark and otherwise assumes UTF-8. Writing uses UTF-8 **without** a BOM. Passing `Encoding.UTF8` explicitly does the opposite of what most people expect: it writes the three BOM bytes `EF BB BF`, because that static instance is configured to emit one.

```csharp
File.WriteAllText("a.txt", "héllo");                 // 68 C3 A9 ...  no BOM
File.WriteAllText("b.txt", "héllo", Encoding.UTF8);  // EF BB BF 68 ...  BOM
File.WriteAllText("c.txt", "héllo", new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));  // no BOM
```

Most tools on Linux, and many parsers, treat a BOM as content, so a file written with `Encoding.UTF8` can fail to parse as JSON or break a shell script's first line. Leave the encoding off, or pass a `UTF8Encoding` with the BOM disabled, unless the consumer requires one.

## Streaming Large Files

`ReadAllText` and `ReadAllLines` hold the whole file in memory. For a large file, read it a line or a chunk at a time:

```csharp
foreach (string line in File.ReadLines("large.log"))
{
    Process(line);
}

await foreach (string line in File.ReadLinesAsync("large.log", cancellationToken))   // .NET 7
{
    Process(line);
}
```

`File.ReadLines` is lazy. It opens the file when enumeration starts and keeps it open until the enumeration finishes or is disposed, so a `foreach` that's still running, or an enumerator that's been abandoned undisposed, blocks other processes from deleting or replacing the file.

For binary data, read into a reused buffer:

```csharp
await using FileStream stream = File.OpenRead("large.bin");
byte[] buffer = new byte[81920];
int read;
while ((read = await stream.ReadAsync(buffer, cancellationToken)) > 0)
{
    ProcessChunk(buffer.AsMemory(0, read));
}
```

`ReadAsync` returns however many bytes are available, which can be fewer than the buffer holds before the end of the file. Always use the returned count, never `buffer.Length`. To copy one stream to another, `source.CopyToAsync(destination)` runs the same loop for you.

`StreamReader` and `StreamWriter` sit over a stream and handle encoding, buffering, and line splitting:

```csharp
await using var writer = new StreamWriter("report.txt", append: false);
await writer.WriteLineAsync("Header");

using var reader = new StreamReader("report.txt");
string? line;
while ((line = await reader.ReadLineAsync(cancellationToken)) is not null)
{
    Process(line);
}
```

A `StreamWriter` buffers, and what's in the buffer reaches the file only on `Flush` or `Dispose`. A writer that's never disposed loses its last few kilobytes.

## Paths

The `Path` class manipulates path strings without touching the disk:

```csharp
string fullPath = Path.Combine("folder", "subfolder", "file.txt");

Path.GetDirectoryName(fullPath);             // folder\subfolder on Windows, folder/subfolder elsewhere
Path.GetFileName(fullPath);                  // file.txt
Path.GetFileNameWithoutExtension(fullPath);  // file
Path.GetExtension(fullPath);                 // .txt
Path.ChangeExtension(fullPath, ".json");     // The same path ending in file.json
Path.GetFullPath("relative/path");           // Resolved against the current directory
```

Build paths with `Path.Combine` or `Path.Join` rather than string concatenation, so the separator is right on every platform.

### Combine Discards Everything Before an Absolute Segment

`Path.Combine` treats a rooted argument as a fresh start and drops everything before it:

```csharp
Path.Combine("uploads", @"C:\Windows\win.ini");   // C:\Windows\win.ini
Path.Combine("uploads", "/etc/passwd");            // /etc/passwd
Path.Join("uploads", @"C:\Windows\win.ini");      // uploads\C:\Windows\win.ini
```

When any segment comes from a user, such as an uploaded file's name, `Combine` turns it into a path traversal. `Path.Join` (.NET Core 3.0) concatenates with a separator and never discards, but neither method resolves `..`, so a name like `..\..\secret.txt` escapes the directory either way. Treat user input as a file *name*, and confirm the resolved path stays inside the intended directory:

```csharp
string SafePathFor(string baseDirectory, string userFileName)
{
    string root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(baseDirectory));
    string candidate = Path.GetFullPath(Path.Join(root, Path.GetFileName(userFileName)));

    if (!candidate.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        throw new ArgumentException("Invalid file name.", nameof(userFileName));

    return candidate;
}
```

`Path.GetFileName` strips any directory part the user supplied, `GetFullPath` resolves what remains, and the prefix check rejects anything that still lands outside `root`. Better still, store uploads under a name you generate and keep the user's name only as metadata.

### Temporary Files

`Path.GetTempFileName()` creates an empty file with a predictable name pattern in the shared temp directory, and on Windows it fails once 65,535 of them accumulate. `Directory.CreateTempSubdirectory()` (.NET 7) creates a uniquely named directory for the process's scratch files, and `Path.GetRandomFileName()` returns a random name without creating anything.

## FileStream: Modes, Access, and Sharing

`File.OpenRead`, `File.Create`, and friends are shortcuts for a `FileStream` with particular settings. Three enums define what an open does:

| Setting | Controls | Values that matter |
|---|---|---|
| `FileMode` | What happens if the file does or doesn't exist | `CreateNew` fails if it exists. `Create` truncates it. `Open` fails if it's missing. `OpenOrCreate` does neither and **doesn't truncate**. `Append` seeks to the end |
| `FileAccess` | What this handle may do | `Read`, `Write`, `ReadWrite` |
| `FileShare` | What **other** handles may do while this one is open | `None`, `Read`, `Write`, `ReadWrite`, `Delete` |

`File.OpenWrite` uses `OpenOrCreate`, so writing `abc` over a file containing `0123456789` leaves `abc3456789`. Use `File.Create` or `FileMode.Create` to replace contents.

Sharing is negotiated both ways. An open succeeds only if its requested access is allowed by every existing handle's `FileShare`, and its own `FileShare` allows every existing handle's access. `File.ReadAllText` opens with `FileShare.Read`, which refuses a file another handle has open for writing, so reading a log that another process is still writing throws `IOException`. Open it with `FileShare.ReadWrite` instead:

```csharp
using var stream = new FileStream("app.log", FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
using var reader = new StreamReader(stream);
```

`FileStreamOptions` (.NET 6) collects these settings with the buffer size, a preallocation size, and `FileOptions` such as `Asynchronous`:

```csharp
await using var stream = new FileStream("data.bin", new FileStreamOptions
{
    Mode = FileMode.Create,
    Access = FileAccess.Write,
    Share = FileShare.None,
    Options = FileOptions.Asynchronous,
    PreallocationSize = expectedLength
});
```

## Writing Without Corrupting the File

Overwriting a file in place is not safe against a crash. `File.WriteAllText` truncates the file first and then writes, so a crash or power loss in between leaves it empty or half-written. A reader opening it at the wrong moment sees the same partial contents.

Write to a temporary file in the same directory, force it to disk, and then rename it over the original:

```csharp
public static async Task WriteAtomicallyAsync(string path, string content, CancellationToken ct = default)
{
    string tempPath = Path.Join(Path.GetDirectoryName(Path.GetFullPath(path)), Path.GetRandomFileName());

    await using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None,
        bufferSize: 4096, FileOptions.Asynchronous))
    await using (var writer = new StreamWriter(stream))
    {
        await writer.WriteAsync(content.AsMemory(), ct);
        await writer.FlushAsync(ct);
        stream.Flush(flushToDisk: true);
    }

    File.Move(tempPath, path, overwrite: true);
}
```

The rename is what makes this work. Within one volume it replaces the directory entry rather than copying data, so readers see either the whole old file or the whole new one, and a crash before the rename leaves the original intact beside a stray temp file. The temp file must be in the same directory for that to hold. A rename across volumes becomes a copy and loses the guarantee. `Flush(flushToDisk: true)` matters because a rename can reach the disk before the data it points to, which after a power loss leaves a new name pointing at empty contents.

`File.Replace(source, destination, backup)` does the same swap and also keeps a backup of the old file. It throws `FileNotFoundException` if the destination doesn't exist yet, so first-time writes need `File.Move`.

## Directories

```csharp
Directory.CreateDirectory("path/to/new/folder");   // Creates missing parents; no error if it exists

foreach (string file in Directory.EnumerateFiles("src", "*.cs", SearchOption.AllDirectories))
{
    Console.WriteLine(file);
}

Directory.Delete("folder");                   // Throws IOException unless empty
Directory.Delete("folder", recursive: true);  // Deletes the contents too
Directory.Move("old/path", "new/path");
```

`EnumerateFiles` yields results as it walks the tree, while `GetFiles` builds the whole array before returning. Prefer the former for large trees, and whenever you might stop early.

A recursive search with `SearchOption.AllDirectories` throws `UnauthorizedAccessException` at the first directory it can't read, which on a real disk usually aborts the whole walk. `EnumerationOptions` changes that, and its `IgnoreInaccessible` defaults to `true`:

```csharp
var options = new EnumerationOptions
{
    RecurseSubdirectories = true,
    IgnoreInaccessible = true,
    MatchCasing = MatchCasing.CaseInsensitive    // Default follows the platform: insensitive on Windows, sensitive on Linux
};

foreach (string file in Directory.EnumerateFiles("/data", "*.csv", options))
    Console.WriteLine(file);
```

The casing default is a portability trap. `*.CSV` finds `report.csv` on Windows and nothing on Linux unless `MatchCasing` is set.

### FileInfo and DirectoryInfo

The `FileInfo` and `DirectoryInfo` classes wrap one path and expose its metadata as properties. They read that metadata once and cache it. A `FileInfo` created before the file exists keeps reporting `Exists == false` after the file is created, until you call `Refresh()`:

```csharp
DateTimeOffset cutoff = timeProvider.GetUtcNow().AddDays(-30);

foreach (FileInfo f in new DirectoryInfo("logs").EnumerateFiles("*.log"))
{
    if (f.LastWriteTimeUtc < cutoff.UtcDateTime)
        f.Delete();
}
```

Compare with the `Utc` variants of the time properties. `LastWriteTime` is local time and shifts by an hour across a daylight-saving change.

## Copy, Move, Delete

```csharp
File.Copy("source.txt", "dest.txt");                    // Throws IOException if dest exists
File.Copy("source.txt", "dest.txt", overwrite: true);

File.Move("old.txt", "new.txt");                        // Throws IOException if new.txt exists
File.Move("file.txt", "archive/file.txt", overwrite: true);   // .NET Core 3.0

File.Delete("file.txt");   // No error if the file is missing; DirectoryNotFoundException if the directory is
```

## Check-Then-Act Is a Race

`File.Exists` followed by an open, or `Directory.Exists` followed by a delete, is a race with every other process on the machine. The file can appear, vanish, or be locked between the check and the call, so the call must handle failure anyway. Attempt the operation and handle the exception, and use the check only where the answer changes what you'd do, not as a guard. `FileMode.CreateNew` is the race-free "create only if it doesn't exist": it fails with `IOException` if another process got there first.

`Path.Exists` (.NET 7) answers whether a path exists as either a file or a directory.

## Exceptions

| Exception | Derives from | Typical cause |
|---|---|---|
| `FileNotFoundException` | `IOException` | The file doesn't exist |
| `DirectoryNotFoundException` | `IOException` | A directory in the path doesn't exist |
| `PathTooLongException` | `IOException` | The path exceeds a platform limit |
| `IOException` | `SystemException` | Sharing violation, file exists, directory not empty, disk full |
| `UnauthorizedAccessException` | `SystemException`, **not** `IOException` | Permissions, a read-only file, or a path that's actually a directory |

Because `UnauthorizedAccessException` isn't an `IOException`, `catch (IOException)` alone lets permission failures escape. Catch the specific types you can act on, and order them from most to least derived:

```csharp
try
{
    string content = File.ReadAllText(path);
}
catch (FileNotFoundException)
{
    // Use defaults
}
catch (UnauthorizedAccessException ex)
{
    logger.LogError(ex, "No permission to read {Path}", path);
    throw;
}
catch (IOException ex)
{
    // Often transient: locked by another process. A short retry can succeed
    logger.LogWarning(ex, "Could not read {Path}", path);
}
```

## FileSystemWatcher

`FileSystemWatcher` raises events when files in a directory change:

```csharp
using var watcher = new FileSystemWatcher("inbox")
{
    Filter = "*.csv",
    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite,
    InternalBufferSize = 64 * 1024
};

watcher.Created += (_, e) => queue.Writer.TryWrite(e.FullPath);
watcher.Changed += (_, e) => queue.Writer.TryWrite(e.FullPath);
watcher.Renamed += (_, e) => queue.Writer.TryWrite(e.FullPath);
watcher.Error += (_, e) => logger.LogError(e.GetException(), "Watcher failed; rescanning");

watcher.EnableRaisingEvents = true;
```

It's a notification that something probably changed, not a reliable change log:

- **One save raises several events.** Editors write, truncate, rename, and set attributes, so a single save commonly produces multiple `Changed` events. Debounce per path before acting.
- **A `Created` event can arrive before the writer has finished.** Opening the file at once may fail with a sharing violation or read partial content. Retry the open, or have writers use the temp-and-rename pattern so the file appears complete.
- **Events can be lost.** Changes are queued in a buffer (8 KB by default, 64 KB maximum on Windows), and a burst that overflows it raises `Error` with an `InternalBufferOverflowException` and drops the events. Handle `Error` by rescanning the directory.
- **Handlers run on thread-pool threads**, possibly concurrently. Hand the path to a queue or channel rather than doing slow work in the handler.

A system that must not miss a file should rescan the directory on startup and periodically, and use the watcher only to react sooner.

## Custom Binary Formats

`BinaryWriter` and `BinaryReader` write and read primitive values as raw bytes. They suit compact formats you control, such as a cache file, a save file, or a simple wire protocol:

```csharp
public sealed record Player(int Id, string Name, float Health, Vector3 Position)
{
    private const int FormatVersion = 1;

    public void WriteTo(BinaryWriter writer)
    {
        writer.Write(FormatVersion);
        writer.Write(Id);
        writer.Write(Name);
        writer.Write(Health);
        writer.Write(Position.X);
        writer.Write(Position.Y);
        writer.Write(Position.Z);
    }

    public static Player ReadFrom(BinaryReader reader)
    {
        int version = reader.ReadInt32();
        if (version != FormatVersion)
            throw new InvalidDataException($"Unsupported player format version {version}");

        return new Player(
            reader.ReadInt32(),
            reader.ReadString(),
            reader.ReadSingle(),
            new Vector3(reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle()));
    }
}

await using (FileStream output = File.Create("player.dat"))
using (var writer = new BinaryWriter(output))
    player.WriteTo(writer);

using FileStream input = File.OpenRead("player.dat");
using var reader = new BinaryReader(input);
Player loaded = Player.ReadFrom(reader);
```

The format is exactly the sequence of calls. Nothing in the file names a field or its type, so the reader must call the matching `Read` methods in the same order. Reading past the end throws `EndOfStreamException`. A few details decide whether the bytes are what another program expects:

- **Integers and floats are always little-endian**, on every platform. For a protocol that specifies big-endian, use `BinaryPrimitives.WriteInt32BigEndian` and its siblings on a span instead.
- **Strings are length-prefixed.** `Write(string)` writes the UTF-8 byte count as a 7-bit-encoded integer, then the bytes. Only another `BinaryReader` understands that prefix.
- **A version number comes first.** Without one, adding a field makes every existing file unreadable, with no way to tell old files from corrupt ones.

`BinaryFormatter`, which serialized whole object graphs by type name, is removed. Its methods throw `PlatformNotSupportedException` on current .NET, and it was never safe for untrusted data, since the payload chose which types to instantiate.

| | `BinaryWriter` format | JSON |
|---|---|---|
| Size | Compact, no field names | Larger, text with field names |
| Readable by people and other tools | No | Yes |
| Adding or reordering fields | Needs explicit versioning | Unknown fields are ignored and missing ones default |
| Suits | Formats you own end to end, where size or parsing cost matters | Configuration, data exchange, anything another system reads |

Prefer JSON unless size or parsing cost has been measured to matter, or the format is dictated by something else.

## Key Takeaways

**Never pass user input to `Path.Combine`.** A rooted segment discards the base directory. Take the file name only and check the resolved path stays inside the base.

**Replace files by writing a temp file in the same directory and renaming it,** so a crash never leaves a half-written file.

**Mind the defaults.** `File.OpenWrite` doesn't truncate, `Encoding.UTF8` writes a BOM, and `FileShare.Read` refuses files another process is writing.

**Attempt and handle, don't check then act.** Existence checks race with other processes.

**Catch `UnauthorizedAccessException` separately.** It isn't an `IOException`.

**Treat `FileSystemWatcher` as a hint.** Debounce its events, handle `Error`, and rescan.

**Version binary formats from the first byte,** and remember `BinaryWriter` is little-endian with its own string prefix.
