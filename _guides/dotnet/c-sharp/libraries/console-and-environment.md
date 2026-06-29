---
title: "C# Console and Environment"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Console input/output, formatting, colors, environment variables, and binary serialization."
tags: [c-sharp, dotnet, console, environment, io, practical]
---

## Console Operations

### Basic Input/Output

```csharp
// Output
Console.WriteLine("Hello, World!");     // With newline
Console.Write("No newline");            // Without newline
Console.WriteLine($"Value: {value}");   // String interpolation

// Input
string? input = Console.ReadLine();     // Read line (nullable)
ConsoleKeyInfo key = Console.ReadKey(); // Read single key
Console.ReadKey(true);                  // Suppress key echo

// Error output (separate stream)
Console.Error.WriteLine("Error message");

// Standard streams
TextWriter stdout = Console.Out;
TextWriter stderr = Console.Error;
TextReader stdin = Console.In;
```

### Formatting Output

```csharp
// Numeric format strings
Console.WriteLine("Currency: {0:C}", 1234.56);      // $1,234.56
Console.WriteLine("Decimal: {0:D8}", 42);           // 00000042
Console.WriteLine("Scientific: {0:E2}", 12345.67); // 1.23E+004
Console.WriteLine("Fixed: {0:F2}", 3.14159);        // 3.14
Console.WriteLine("Percent: {0:P1}", 0.1234);       // 12.3%
Console.WriteLine("Hex: {0:X}", 255);               // FF
Console.WriteLine("Number: {0:N0}", 1234567);       // 1,234,567

// Alignment
Console.WriteLine("{0,-10} {1,10}", "Left", "Right");
Console.WriteLine("{0,10:C}", 42.5);  // Right-aligned currency

// Date/time formatting
Console.WriteLine("{0:D} at {1:HH:mm}", DateTime.Now, DateTime.Now);
Console.WriteLine($"ISO: {DateTime.Now:yyyy-MM-ddTHH:mm:ss}");

// String interpolation with format
Console.WriteLine($"Price: {price:C2}");
Console.WriteLine($"Date: {date:yyyy-MM-dd}");
Console.WriteLine($"Aligned: {name,-20} {value,10:N2}");
```

### Console Colors

```csharp
// Set colors
Console.ForegroundColor = ConsoleColor.Green;
Console.BackgroundColor = ConsoleColor.Black;
Console.WriteLine("Colored text");
Console.ResetColor();

// Available colors
// Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta,
// DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta,
// Yellow, White

// Pattern: save and restore
var originalFg = Console.ForegroundColor;
var originalBg = Console.BackgroundColor;
try
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine("Error!");
}
finally
{
    Console.ForegroundColor = originalFg;
    Console.BackgroundColor = originalBg;
}
```

### Cursor and Window

```csharp
// Cursor positioning
Console.SetCursorPosition(10, 5);  // Column, Row
(int left, int top) = Console.GetCursorPosition();

// Cursor visibility
Console.CursorVisible = false;  // Hide cursor

// Clear operations
Console.Clear();  // Clear entire screen

// Window size (platform-dependent)
try
{
    Console.WindowWidth = 120;
    Console.WindowHeight = 30;
    Console.BufferWidth = 120;
    Console.BufferHeight = 300;
}
catch (PlatformNotSupportedException)
{
    // Not supported on all platforms
}

// Beep (Windows)
Console.Beep();
Console.Beep(frequency: 800, duration: 200);
```

### Interactive Console Patterns

```csharp
// Simple menu
Console.WriteLine("1. Option A");
Console.WriteLine("2. Option B");
Console.WriteLine("3. Exit");
Console.Write("Choice: ");

string? choice = Console.ReadLine();
switch (choice)
{
    case "1": HandleOptionA(); break;
    case "2": HandleOptionB(); break;
    case "3": return;
    default: Console.WriteLine("Invalid choice"); break;
}

// Password input (no echo)
Console.Write("Password: ");
var password = new StringBuilder();
ConsoleKeyInfo key;
while ((key = Console.ReadKey(true)).Key != ConsoleKey.Enter)
{
    if (key.Key == ConsoleKey.Backspace && password.Length > 0)
    {
        password.Length--;
        Console.Write("\b \b");
    }
    else if (!char.IsControl(key.KeyChar))
    {
        password.Append(key.KeyChar);
        Console.Write("*");
    }
}
Console.WriteLine();
string pwd = password.ToString();

// Progress indicator
for (int i = 0; i <= 100; i++)
{
    Console.Write($"\rProgress: {i}%");
    Thread.Sleep(50);
}
Console.WriteLine();
```

## Environment

### Environment Variables

```csharp
// Read
string? value = Environment.GetEnvironmentVariable("MY_VAR");
string? pathValue = Environment.GetEnvironmentVariable("PATH");

// Read with target (Windows)
string? userVar = Environment.GetEnvironmentVariable(
    "MY_VAR", EnvironmentVariableTarget.User);
string? machineVar = Environment.GetEnvironmentVariable(
    "MY_VAR", EnvironmentVariableTarget.Machine);

// Set (process scope by default)
Environment.SetEnvironmentVariable("MY_VAR", "value");

// Set with target (Windows, requires elevation for Machine)
Environment.SetEnvironmentVariable(
    "MY_VAR", "value", EnvironmentVariableTarget.User);

// Delete (set to null)
Environment.SetEnvironmentVariable("MY_VAR", null);

// Get all environment variables
foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
{
    Console.WriteLine($"{entry.Key}={entry.Value}");
}
```

### Command Line Arguments

```csharp
// In Main method
static void Main(string[] args)
{
    foreach (string arg in args)
    {
        Console.WriteLine(arg);
    }
}

// Anywhere in the application
string[] allArgs = Environment.GetCommandLineArgs();
// Note: allArgs[0] is the executable path

// Simple argument parsing
var arguments = new Dictionary<string, string?>();
for (int i = 0; i < args.Length; i++)
{
    if (args[i].StartsWith("--"))
    {
        string key = args[i][2..];
        string? value = i + 1 < args.Length && !args[i + 1].StartsWith("--")
            ? args[++i]
            : null;
        arguments[key] = value;
    }
}
```

### Special Folders

```csharp
// User folders
string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
string documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
string downloads = Path.Combine(home, "Downloads");  // No built-in constant

// Application data
string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
string commonAppData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);

// System folders
string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
string system = Environment.GetFolderPath(Environment.SpecialFolder.System);
string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);

// Temp folder
string temp = Path.GetTempPath();

// Current directory
string current = Environment.CurrentDirectory;
// or: Directory.GetCurrentDirectory()
```

### System Information

```csharp
// Machine info
string machineName = Environment.MachineName;
string userName = Environment.UserName;
string userDomain = Environment.UserDomainName;

// OS info
OperatingSystem os = Environment.OSVersion;
Console.WriteLine($"Platform: {os.Platform}");
Console.WriteLine($"Version: {os.Version}");

// Runtime info
Console.WriteLine($".NET Version: {Environment.Version}");
Console.WriteLine($"64-bit OS: {Environment.Is64BitOperatingSystem}");
Console.WriteLine($"64-bit Process: {Environment.Is64BitProcess}");
Console.WriteLine($"Processor Count: {Environment.ProcessorCount}");

// Memory
long workingSet = Environment.WorkingSet;  // Bytes

// Uptime
TimeSpan uptime = TimeSpan.FromMilliseconds(Environment.TickCount64);

// Exit codes
Environment.ExitCode = 0;  // Success
Environment.Exit(1);       // Exit immediately with code
```

### Process Information

```csharp
using System.Diagnostics;

// Current process
Process current = Process.GetCurrentProcess();
Console.WriteLine($"PID: {current.Id}");
Console.WriteLine($"Name: {current.ProcessName}");
Console.WriteLine($"Memory: {current.WorkingSet64 / 1024 / 1024} MB");
Console.WriteLine($"Threads: {current.Threads.Count}");
Console.WriteLine($"Start Time: {current.StartTime}");
```

## Binary Serialization

### BinaryWriter and BinaryReader

For custom binary formats and protocol implementations.

```csharp
// Write binary data
using var ms = new MemoryStream();
using var writer = new BinaryWriter(ms);

writer.Write(42);              // Int32 (4 bytes)
writer.Write("hello");         // Length-prefixed string
writer.Write(3.14159);         // Double (8 bytes)
writer.Write(true);            // Boolean (1 byte)
writer.Write((byte)255);       // Byte
writer.Write(new byte[] { 1, 2, 3 });  // Raw bytes

// Read binary data
ms.Position = 0;
using var reader = new BinaryReader(ms);

int num = reader.ReadInt32();
string str = reader.ReadString();
double d = reader.ReadDouble();
bool b = reader.ReadBoolean();
byte by = reader.ReadByte();
byte[] bytes = reader.ReadBytes(3);
```

### Custom Binary Serialization

```csharp
public class Player
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public float Health { get; set; }
    public Vector3 Position { get; set; }

    public void WriteTo(BinaryWriter writer)
    {
        writer.Write(Id);
        writer.Write(Name);
        writer.Write(Health);
        writer.Write(Position.X);
        writer.Write(Position.Y);
        writer.Write(Position.Z);
    }

    public static Player ReadFrom(BinaryReader reader)
    {
        return new Player
        {
            Id = reader.ReadInt32(),
            Name = reader.ReadString(),
            Health = reader.ReadSingle(),
            Position = new Vector3(
                reader.ReadSingle(),
                reader.ReadSingle(),
                reader.ReadSingle())
        };
    }
}

// Usage
using var stream = File.Create("player.dat");
using var writer = new BinaryWriter(stream);
player.WriteTo(writer);

using var readStream = File.OpenRead("player.dat");
using var reader = new BinaryReader(readStream);
var loaded = Player.ReadFrom(reader);
```

### Binary vs JSON

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Binary Serialization</h4>
<ul>
<li><strong>Size:</strong> Compact</li>
<li><strong>Speed:</strong> Faster</li>
<li><strong>Readability:</strong> Not human-readable</li>
<li><strong>Debugging:</strong> Difficult</li>
<li><strong>Use case:</strong> Performance-critical, network protocols</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>JSON Serialization</h4>
<ul>
<li><strong>Size:</strong> Larger (text-based)</li>
<li><strong>Speed:</strong> Slower</li>
<li><strong>Readability:</strong> Human-readable</li>
<li><strong>Debugging:</strong> Easy</li>
<li><strong>Use case:</strong> APIs, config files, data exchange</li>
</ul>
</div>
</div>

<div class="callout callout--tip">
<p class="callout__title">When to Use Binary</p>
<p>Use binary serialization only when size/speed justify the debugging difficulty. For most cases, prefer JSON for interoperability and maintainability.</p>
</div>

| Aspect | Binary | JSON |
|--------|--------|------|
| Size | Compact | Larger (text) |
| Speed | Faster | Slower |
| Readability | Not human-readable | Human-readable |
| Debugging | Difficult | Easy |
| Schema evolution | Manual versioning | Flexible |
| Use case | Performance-critical, protocols | APIs, config, data exchange |

```csharp
// JSON alternative for most cases
byte[] jsonBytes = JsonSerializer.SerializeToUtf8Bytes(data);
var data = JsonSerializer.Deserialize<MyData>(jsonBytes);
```

## Key Takeaways

**Console.Error for diagnostics**: Separate error stream allows redirecting stdout while keeping errors visible.

**Reset colors in finally**: Always restore console colors to avoid corrupting the user's terminal.

**Environment variables are scoped**: Process-level by default; User/Machine require Windows and appropriate permissions.

**Use GetFolderPath for portability**: Special folders resolve correctly across platforms.

**Binary for performance**: Use BinaryWriter/Reader for compact, fast serialization when human readability isn't needed.

**Prefer JSON for interoperability**: Use binary only when size/speed justify the debugging difficulty.
