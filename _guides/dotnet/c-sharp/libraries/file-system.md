---
title: "C# File System Operations"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "File and directory operations with System.IO including reading, writing, paths, and async file handling."
tags: [c-sharp, dotnet, file-io, streams, async, practical]
---

## File Operations Overview

System.IO provides classes for file system operations. Most operations have both synchronous and async variants.

```csharp
using System.IO;

// Check existence
bool exists = File.Exists("data.txt");
bool dirExists = Directory.Exists("logs");

// Simple read/write
string content = File.ReadAllText("config.json");
File.WriteAllText("output.txt", "Hello, World!");

// Read/write lines
string[] lines = File.ReadAllLines("data.csv");
File.WriteAllLines("output.csv", lines);

// Read/write bytes
byte[] bytes = File.ReadAllBytes("image.png");
File.WriteAllBytes("copy.png", bytes);
```

## Path Operations

<div class="callout callout--tip">
<p class="callout__title">Always Use Path.Combine</p>
<p>Never concatenate paths with string operations. <code>Path.Combine</code> handles cross-platform separators correctly.</p>
</div>

Use `Path` class for cross-platform path manipulation.

```csharp
// Combine paths (handles separators correctly)
string fullPath = Path.Combine("folder", "subfolder", "file.txt");

// Get path components
string dir = Path.GetDirectoryName(fullPath);      // folder/subfolder
string file = Path.GetFileName(fullPath);           // file.txt
string name = Path.GetFileNameWithoutExtension(fullPath);  // file
string ext = Path.GetExtension(fullPath);           // .txt

// Change extension
string newPath = Path.ChangeExtension(fullPath, ".json");

// Get absolute path
string absolute = Path.GetFullPath("relative/path");

// Special folders
string temp = Path.GetTempPath();
string tempFile = Path.GetTempFileName();  // Creates empty temp file

// .NET 6+ - Path.Exists checks both files and directories
bool exists = Path.Exists("something");
```

## Reading Files

### Text Files

```csharp
// Read all at once (small files)
string content = File.ReadAllText("file.txt");
string[] lines = File.ReadAllLines("file.txt");

// Read line by line (memory efficient)
foreach (string line in File.ReadLines("large.txt"))
{
    ProcessLine(line);
}

// Async reading
string content = await File.ReadAllTextAsync("file.txt");
string[] lines = await File.ReadAllLinesAsync("file.txt");

// With specific encoding
string content = File.ReadAllText("file.txt", Encoding.UTF8);
```

### Binary Files

```csharp
byte[] data = File.ReadAllBytes("file.bin");
byte[] data = await File.ReadAllBytesAsync("file.bin");

// Using FileStream for large files
await using var stream = File.OpenRead("large.bin");
var buffer = new byte[4096];
int bytesRead;
while ((bytesRead = await stream.ReadAsync(buffer)) > 0)
{
    ProcessChunk(buffer.AsSpan(0, bytesRead));
}
```

### StreamReader

<div class="callout callout--note">
<p class="callout__title">StreamReader vs ReadAllText</p>
<p>Use <code>StreamReader</code> for line-by-line processing of large files (memory efficient). Use <code>File.ReadAllText</code> for small files where you need all content at once.</p>
</div>

```csharp
using var reader = new StreamReader("file.txt");

// Read line by line
string? line;
while ((line = await reader.ReadLineAsync()) != null)
{
    Console.WriteLine(line);
}

// Read to end
string all = await reader.ReadToEndAsync();

// With encoding
using var reader = new StreamReader("file.txt", Encoding.UTF8);
```

## Writing Files

### Text Files

```csharp
// Write all at once
File.WriteAllText("file.txt", content);
File.WriteAllLines("file.txt", lines);

// Async writing
await File.WriteAllTextAsync("file.txt", content);
await File.WriteAllLinesAsync("file.txt", lines);

// Append
File.AppendAllText("log.txt", "New entry\n");
await File.AppendAllTextAsync("log.txt", "New entry\n");
File.AppendAllLines("log.txt", newLines);
```

### Binary Files

```csharp
File.WriteAllBytes("file.bin", data);
await File.WriteAllBytesAsync("file.bin", data);

// Using FileStream
await using var stream = File.Create("file.bin");
await stream.WriteAsync(data);
```

### StreamWriter

```csharp
// Create/overwrite
await using var writer = new StreamWriter("file.txt");
await writer.WriteLineAsync("First line");
await writer.WriteAsync("More text");

// Append
await using var writer = new StreamWriter("file.txt", append: true);

// With encoding and buffer
await using var writer = new StreamWriter("file.txt", Encoding.UTF8,
    new FileStreamOptions { BufferSize = 4096 });
```

## Directory Operations

```csharp
// Create directory (creates parent directories too)
Directory.CreateDirectory("path/to/new/folder");

// List contents
string[] files = Directory.GetFiles("folder");
string[] dirs = Directory.GetDirectories("folder");

// Recursive search
string[] allCsFiles = Directory.GetFiles("src", "*.cs", SearchOption.AllDirectories);

// Enumerate (memory efficient for large directories)
foreach (string file in Directory.EnumerateFiles("folder", "*.txt"))
{
    Console.WriteLine(file);
}

// Delete
Directory.Delete("folder");                    // Must be empty
Directory.Delete("folder", recursive: true);   // Delete all contents

// Move/rename
Directory.Move("old/path", "new/path");
```

## FileInfo and DirectoryInfo

Object-oriented alternative with cached metadata.

```csharp
// FileInfo
var file = new FileInfo("document.pdf");
if (file.Exists)
{
    Console.WriteLine($"Size: {file.Length} bytes");
    Console.WriteLine($"Created: {file.CreationTime}");
    Console.WriteLine($"Modified: {file.LastWriteTime}");

    file.CopyTo("backup.pdf", overwrite: true);
    file.MoveTo("new/location.pdf");
    // file.Delete();
}

// DirectoryInfo
var dir = new DirectoryInfo("logs");
foreach (FileInfo f in dir.EnumerateFiles("*.log"))
{
    if (f.LastWriteTime < DateTime.Now.AddDays(-30))
    {
        f.Delete();
    }
}
```

## File Copy, Move, Delete

```csharp
// Copy
File.Copy("source.txt", "dest.txt");
File.Copy("source.txt", "dest.txt", overwrite: true);

// Move (rename)
File.Move("old.txt", "new.txt");
File.Move("file.txt", "archive/file.txt", overwrite: true);  // .NET 5+

// Delete
File.Delete("file.txt");  // No error if doesn't exist

// Replace (atomic on same volume)
File.Replace("new.txt", "target.txt", "backup.txt");
```

## File Streams

```csharp
// FileMode: Create, CreateNew, Open, OpenOrCreate, Append, Truncate
// FileAccess: Read, Write, ReadWrite
// FileShare: None, Read, Write, ReadWrite

await using var stream = new FileStream(
    "file.bin",
    FileMode.OpenOrCreate,
    FileAccess.ReadWrite,
    FileShare.Read,
    bufferSize: 4096,
    useAsync: true);

// Or simpler
await using var read = File.OpenRead("file.bin");
await using var write = File.OpenWrite("file.bin");
await using var create = File.Create("new.bin");
```

### Copy Stream to Stream

```csharp
await using var source = File.OpenRead("source.bin");
await using var dest = File.Create("dest.bin");
await source.CopyToAsync(dest);
```

## Common Patterns

### Safe File Writing

```csharp
public async Task WriteFileSafelyAsync(string path, string content)
{
    var tempPath = path + ".tmp";
    var backupPath = path + ".bak";

    await File.WriteAllTextAsync(tempPath, content);

    if (File.Exists(path))
    {
        File.Replace(tempPath, path, backupPath);
    }
    else
    {
        File.Move(tempPath, path);
    }
}
```

### Watch for Changes

```csharp
using var watcher = new FileSystemWatcher("folder")
{
    Filter = "*.txt",
    NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
    EnableRaisingEvents = true
};

watcher.Changed += (s, e) => Console.WriteLine($"Changed: {e.FullPath}");
watcher.Created += (s, e) => Console.WriteLine($"Created: {e.FullPath}");
watcher.Deleted += (s, e) => Console.WriteLine($"Deleted: {e.FullPath}");
watcher.Renamed += (s, e) => Console.WriteLine($"Renamed: {e.OldFullPath} -> {e.FullPath}");
```

### Read Lines with Index

```csharp
var numberedLines = File.ReadLines("file.txt")
    .Select((line, index) => (Number: index + 1, Text: line));

foreach (var (number, text) in numberedLines)
{
    Console.WriteLine($"{number}: {text}");
}
```

## Error Handling

```csharp
try
{
    string content = File.ReadAllText(path);
}
catch (FileNotFoundException)
{
    // File doesn't exist
}
catch (DirectoryNotFoundException)
{
    // Directory doesn't exist
}
catch (UnauthorizedAccessException)
{
    // Permission denied
}
catch (IOException ex)
{
    // Other I/O error (file in use, disk full, etc.)
}
```

## Key Takeaways

**Use Path.Combine**: Never concatenate paths with string operations. Path.Combine handles cross-platform separators.

**Prefer async for I/O**: Use `ReadAllTextAsync`, `WriteAllTextAsync`, etc. for better scalability.

**Use ReadLines for large files**: It enumerates lazily instead of loading the entire file into memory.

**Handle I/O exceptions**: File operations can fail for many reasons. Always handle IOException and related exceptions.

**Dispose streams**: Always use `using` or `await using` with streams to ensure proper cleanup.

**Consider file locking**: Be aware of FileShare options when multiple processes might access the same file.
