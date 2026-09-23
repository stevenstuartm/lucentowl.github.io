---
title: "C# Console and Environment"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "Writing a console application that behaves correctly in a shell, a pipeline, and a container: stdout versus stderr, detecting redirection, reading input to the end, exit codes and what overrides them, argument parsing with System.CommandLine, environment variables and their scope, and shutting down cleanly on Ctrl+C and SIGTERM."
tags: [console, exit-codes, environment-variables, system-commandline, posix-signals, cli, practical]
---

## The Process Contract

A console application rarely runs alone. A shell starts it, a script checks its result, another program reads its output through a pipe, or a container runtime starts it and later tells it to stop. All of those callers talk to the program through the same small set of channels, and a program that treats them correctly works everywhere those tools do:

| Channel | Direction | What callers expect |
|---|---|---|
| Arguments | In | Options and inputs for this run |
| Environment variables | In | Settings inherited from the parent process |
| Standard input (stdin) | In | Data to process, often piped from another program |
| Standard output (stdout) | Out | The program's result, often piped to another program |
| Standard error (stderr) | Out | Diagnostics, progress, and error messages for a human |
| Exit code | Out | Whether the run succeeded |
| Signals | In | A request to stop, from Ctrl+C or from a supervisor |

## The Standard Streams

### stdout Is for Data, stderr Is for People

`Console.WriteLine` writes to stdout and `Console.Error.WriteLine` writes to stderr. In a terminal the two look identical, which hides why the split matters until someone redirects one of them:

```bash
orders-export > orders.csv          # stdout to a file, stderr still on screen
orders-export | grep 'EU-'          # stdout into another program
orders-export 2> errors.log         # stderr to a file
```

If the program writes "Exporting 1,200 orders..." to stdout, that line ends up as the first row of `orders.csv` or gets fed to `grep`. The rule is that stdout carries only the result, in the format callers expect, and everything else goes to stderr, including progress, warnings, errors, prompts, and summaries. A program following this can be dropped into a pipeline without changes.

### Detecting Redirection

`Console.IsOutputRedirected`, `Console.IsErrorRedirected`, and `Console.IsInputRedirected` report whether each stream is attached to a file or pipe rather than a terminal. Use them to switch off output that only makes sense to a human watching a screen:

```csharp
if (!Console.IsErrorRedirected)
{
    // A \r progress line rewrites itself in a terminal but becomes
    // hundreds of lines in a log file
    Console.Error.Write($"\rProcessed {count} of {total}");
}
```

Colors, spinners, cursor movement, and `\r` progress lines all fall into this category. A program can also choose a default output format this way, printing a table when stdout is a terminal and plain lines when it's piped.

### Reading Input to the End

When input is piped, `Console.ReadLine()` returns each line and then `null` once the input ends. A loop that reads until `null` processes piped data correctly, and the same loop in a terminal ends when the user types the end-of-input key (Ctrl+D on Linux and macOS, Ctrl+Z then Enter on Windows):

```csharp
string? line;
while ((line = Console.ReadLine()) is not null)
{
    Console.WriteLine(Transform(line));
}
```

`Console.ReadKey()` doesn't work on redirected input. It throws `InvalidOperationException` ("Cannot read keys when ... console input has been redirected"), so anything that reads individual keys, such as a password prompt or a "press any key" pause, has to check `Console.IsInputRedirected` first or accept its value another way.

### Writing a Lot of Output

`Console.Out` is a synchronized writer that flushes after every write, which keeps output from interleaving across threads and makes each line appear immediately. For a program writing hundreds of thousands of lines, that per-write flush is most of the cost. Wrap the raw stream in a buffered writer and flush once at the end:

```csharp
using var stdout = new StreamWriter(Console.OpenStandardOutput(), bufferSize: 64 * 1024);
foreach (var record in records)
    stdout.WriteLine(record.ToCsv());
// Disposing the writer flushes the remaining buffer
```

## Exit Codes

The exit code is how a script, a CI step, a scheduler, or a container orchestrator knows whether the run worked. Zero means success, and anything else means failure. A program that catches an error, prints a message, and exits with 0 tells every caller that nothing went wrong. A `set -e` shell script continues, a CI step goes green, and a retry policy never retries.

### Setting the Code

There are three ways to set the exit code, and when more than one is used, the order matters:

```csharp
// 1. Return it from Main (or from top-level statements)
static async Task<int> Main(string[] args)
{
    try
    {
        await RunAsync(args);
        return 0;
    }
    catch (ValidationException ex)
    {
        Console.Error.WriteLine(ex.Message);
        return 2;
    }
}

// 2. Set Environment.ExitCode and let Main finish
Environment.ExitCode = 1;

// 3. Terminate immediately
Environment.Exit(1);
```

A value returned from `Main` replaces whatever `Environment.ExitCode` holds, so a program that sets `ExitCode = 4` and then returns 5 exits with 5. `Environment.ExitCode` matters in a `void Main`, or for code deep in the program that wants to record failure without unwinding to `Main`.

`Environment.Exit` ends the process on the spot. Called inside a `try` block, it skips that block's `finally`, so files aren't flushed, `using` blocks don't dispose, and the cleanup the rest of the code relies on doesn't run. Prefer returning from `Main` and reserve `Environment.Exit` for places that genuinely can't unwind.

An exception that escapes `Main` prints its details to stderr and exits with a nonzero code chosen by the runtime and platform. That signals failure correctly, but callers can't tell one kind of failure from another, and the output is a stack trace rather than a message.

### Choosing Values

There's no universal table of exit codes, but a few conventions are widely followed:

| Code | Conventional meaning |
|---|---|
| 0 | Success |
| 1 | General failure |
| 2 | Incorrect usage: bad arguments or options |
| 130 | Terminated by Ctrl+C (128 + the signal number 2) |

Beyond those, a program can assign its own codes to failures a caller might handle differently, such as "input file not found" versus "remote service unavailable, retry later", and document them. On Linux and macOS the exit status is a single byte, so only 0 to 255 survive. Returning 300 from `Main` reaches the shell as 44.

## Arguments

`Main(string[] args)`, and the implicit `args` in top-level statements, holds the arguments after the program name. By the time the program sees them, the shell has already split them on spaces, removed quotes, and on Linux and macOS expanded wildcards, so `*.csv` arrives as a list of file names. `Environment.GetCommandLineArgs()` returns the same arguments with the program's own path first. For a framework-dependent app that path is the `.dll`, even when the user ran the `.exe`.

Hand-parsing works for one or two positional arguments. Beyond that, the edge cases add up quickly, including `--name value` versus `--name=value`, flags that take no value, required options, repeated options, type conversion, and help text. [System.CommandLine](https://learn.microsoft.com/dotnet/standard/commandline/){:target="_blank" rel="noopener noreferrer"} is Microsoft's parser, and stable since version 2.0:

```csharp
using System.CommandLine;

var inputOption = new Option<FileInfo>("--input")
{
    Description = "CSV file to import",
    Required = true
};
var dryRunOption = new Option<bool>("--dry-run")
{
    Description = "Report what would change without writing"
};

var root = new RootCommand("Imports orders from a CSV file") { inputOption, dryRunOption };

root.SetAction(async (parseResult, cancellationToken) =>
{
    FileInfo input = parseResult.GetValue(inputOption)!;
    bool dryRun = parseResult.GetValue(dryRunOption);
    await ImportAsync(input, dryRun, cancellationToken);
    return 0;
});

return await root.Parse(args).InvokeAsync();
```

The parser generates `--help` output from the descriptions, reports a missing or unknown option on stderr, and returns exit code 1 for a usage error without running the action. The `cancellationToken` it passes in is cancelled when the process is asked to stop, which the last section of this guide covers.

## Environment Variables

A process gets a copy of its parent's environment variables when it starts. Changing a variable affects only the current process and any child processes it starts afterward. It never reaches the parent, which is why a program can't set a variable "for the shell" that launched it.

```csharp
string? region = Environment.GetEnvironmentVariable("APP_REGION");   // null if not set
Environment.SetEnvironmentVariable("APP_TRACE", "1");                // this process and its future children
Environment.SetEnvironmentVariable("APP_TRACE", null);               // removes it
```

A few rules catch people moving between platforms:

- **Names are case-sensitive on Linux and macOS** and case-insensitive on Windows. `App_Region` and `APP_REGION` are the same variable on one and different variables on the other, so pick one spelling, conventionally upper case.
- **The `User` and `Machine` targets are Windows-only.** The overloads taking `EnvironmentVariableTarget` read and write the persistent per-user and machine-wide stores in the Windows registry, and writing `Machine` needs elevation. Linux and macOS have no such stores, so only the process's own environment is available there.
- **Missing and empty are different.** A variable set to an empty string returns `""`, not `null`.

Environment variables are how containers, CI systems, and deployment platforms pass configuration, and they're also visible to anything that can inspect the process, so they're a weak place for secrets. In an application built on the .NET configuration system, read them through configuration rather than calling `GetEnvironmentVariable` throughout the code, so they layer with files and other sources in one place. The configuration system maps a double underscore to its section separator, so `Database__Host` becomes `Database:Host`.

## Stopping Cleanly

A long-running console program eventually gets asked to stop, either by a user pressing Ctrl+C or by a supervisor such as `docker stop`, Kubernetes, or systemd sending `SIGTERM`. By default .NET ends the process in both cases without letting the main code finish what it was doing. The result can be a half-written file, an uncommitted batch, or a message taken off a queue but never processed.

### Two Signals, Two Sources

Ctrl+C in a terminal sends `SIGINT`. Container runtimes and service managers send `SIGTERM`. Handling only one is a common gap. A program tested by pressing Ctrl+C can still be killed mid-write in production, because `docker stop` sends `SIGTERM`, waits a grace period (10 seconds by default), and then sends `SIGKILL`, which can't be caught at all.

`Console.CancelKeyPress` handles Ctrl+C. `PosixSignalRegistration` (.NET 6) handles both, along with `SIGQUIT` and `SIGHUP`, and on Windows it maps them to the equivalent console control events. Either way, the handler shouldn't do the cleanup itself. It should cancel the default termination and signal the main code through a `CancellationToken`, so the work stops at a safe point and unwinds normally:

```csharp
using var shutdown = new CancellationTokenSource();

void RequestStop(PosixSignalContext context)
{
    context.Cancel = true;      // don't terminate yet
    shutdown.Cancel();          // tell the work loop to finish up
}

using var sigint = PosixSignalRegistration.Create(PosixSignal.SIGINT, RequestStop);
using var sigterm = PosixSignalRegistration.Create(PosixSignal.SIGTERM, RequestStop);

try
{
    await foreach (var message in queue.ReadAllAsync(shutdown.Token))
    {
        await ProcessAsync(message);    // finishes the current message, then stops
    }
    return 0;
}
catch (OperationCanceledException) when (shutdown.IsCancellationRequested)
{
    Console.Error.WriteLine("Stopped before finishing.");
    return 130;
}
```

The shutdown has to finish within the supervisor's grace period, or `SIGKILL` ends it anyway. Keep the work between cancellation checks short, and raise the grace period in the deployment configuration if a unit of work legitimately takes longer. A common convenience is to treat a second Ctrl+C as "stop now" by letting it through without setting `Cancel`.

### When Something Else Owns Shutdown

Frameworks handle this for you. System.CommandLine cancels the token it passes to the action when the process receives `SIGINT` or `SIGTERM`. An application built on the .NET generic host (`Host.CreateApplicationBuilder`) turns both signals into its own graceful shutdown and cancels the tokens passed to hosted services. When one of these is in charge, use its token instead of registering signal handlers alongside it.

## Interactive Output

When a human is at the terminal, and only then, a program can use color and cursor control.

```csharp
if (!Console.IsErrorRedirected)
{
    var previous = Console.ForegroundColor;
    try
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.Error.WriteLine("3 orders failed validation");
    }
    finally
    {
        Console.ForegroundColor = previous;   // an exception must not leave the terminal red
    }
}
```

`Console.ResetColor()` restores the terminal's defaults rather than the previous color, which is usually the same thing. `Console.SetCursorPosition`, `Console.CursorVisible`, and `Console.Clear` support redrawing a region of the screen. Setting the window or buffer size, and `Console.Beep` with a frequency and duration, are Windows-only and throw `PlatformNotSupportedException` elsewhere.

For a masked password prompt, read keys with `Console.ReadKey(intercept: true)` so they aren't echoed, which again requires input that isn't redirected. For anything beyond simple color and prompts, such as tables, trees, live progress bars, and selection menus, a library like [Spectre.Console](https://spectreconsole.net/){:target="_blank" rel="noopener noreferrer"} handles terminal capability detection that hand-written escape handling usually gets wrong.

## Process and Platform Information

`Environment` and related types answer questions about where the program is running:

| Question | API |
|---|---|
| Which operating system? | `OperatingSystem.IsWindows()`, `IsLinux()`, `IsMacOS()` (.NET 5) |
| Which runtime version? | `Environment.Version`, or `RuntimeInformation.FrameworkDescription` for a display string |
| How many cores can it use? | `Environment.ProcessorCount`, which respects a container's CPU limit |
| What is this process? | `Environment.ProcessId`, `Environment.ProcessPath` (.NET 6) |
| Where are the user's folders? | `Environment.GetFolderPath(Environment.SpecialFolder.X)` |
| Where should temporary files go? | `Path.GetTempPath()` |

Prefer the `OperatingSystem.Is...` methods over parsing `Environment.OSVersion`, whose version numbers aren't comparable across platforms. `GetFolderPath` maps a special folder to its platform's location where one exists and returns an empty string where none does. Many Windows-specific folders, such as `ProgramFiles` or `Windows`, have no equivalent on Linux, so check for an empty result before building a path from it.

## Key Takeaways

**stdout carries the result, stderr carries everything else.** Anything a pipeline or redirected file shouldn't receive, including progress, prompts, and errors, goes to stderr.

**Check redirection before decorating output.** Colors, `\r` progress, and `ReadKey` belong only in a terminal, and `ReadKey` throws on redirected input.

**The exit code is the result callers check.** Return it from `Main`, which overrides `Environment.ExitCode`. Use nonzero for every failure, and avoid `Environment.Exit` inside code that has `finally` blocks to run.

**Use a parser for anything beyond trivial arguments.** System.CommandLine is stable and provides help, validation, usage-error exit codes, and a cancellation token.

**Environment variables flow down, never up.** They're inherited at start, case-sensitive outside Windows, and the persistent `User` and `Machine` targets exist only on Windows.

**Handle SIGTERM, not just Ctrl+C.** Cancel the default termination, stop through a `CancellationToken`, and finish within the supervisor's grace period.
