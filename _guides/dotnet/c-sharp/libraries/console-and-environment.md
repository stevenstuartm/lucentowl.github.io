---
title: "C# Console and Environment"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Writing a console application that behaves correctly in a shell and a container: the standard streams, exit codes, arguments, environment variables, and process information."
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

## Key Takeaways

**Console.Error for diagnostics**: Separate error stream allows redirecting stdout while keeping errors visible.

**Reset colors in finally**: Always restore console colors to avoid corrupting the user's terminal.

**Environment variables are scoped**: Process-level by default; User/Machine require Windows and appropriate permissions.

**Use GetFolderPath for portability**: Special folders resolve correctly across platforms.

**Exit codes are the shell's only signal**: Set `Environment.ExitCode` or return from `Main`; a process that fails silently with code 0 breaks every caller that checks.
