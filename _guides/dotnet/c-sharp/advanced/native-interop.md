---
title: "C# Native Interop (P/Invoke and COM)"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "Understanding why managed code needs to talk to native code, how P/Invoke and COM bridging works, and when you'll encounter it in modern development like WinUI and IoT."
tags: [c-sharp, dotnet, interop, pinvoke, com, native-code, advanced]
---

## The Two Worlds Your Code Lives In

When you write C#, the runtime manages memory, handles garbage collection, and provides type safety. This is the "managed" world. But your application runs on an operating system written in C and C++, and it interacts with hardware through drivers that speak a completely different language. The "unmanaged" or "native" world is everything outside the .NET runtime's control.

Most of the time you never think about this boundary because the .NET Base Class Library wraps native calls for you. When you open a file with `File.Open()`, the BCL is calling the Windows `CreateFile` API (or the Linux equivalent) on your behalf. When you create a `Socket`, native system calls handle the actual network operations. The abstraction is so thorough that many developers work for years without realizing there's a native layer underneath.

That abstraction breaks down in a few specific situations, and when it does, you need to understand what's happening at the boundary between these two worlds.

## When the Abstraction Falls Away

### System APIs Without Managed Wrappers

The .NET BCL covers the most common operating system capabilities, but Windows alone exposes thousands of APIs that have no managed equivalent. If you need to query specific hardware information, manipulate windows at the OS level, or access newer platform features before the .NET team wraps them, you're calling native APIs directly.

### Hardware and IoT

Working with embedded devices, sensors, or specialized hardware almost always involves native interop. Device manufacturers provide C/C++ SDKs, and your C# code needs to call into those libraries. IoT scenarios on platforms like Raspberry Pi frequently require calling into native GPIO libraries or device-specific drivers that only expose C interfaces.

### WinUI and Modern Windows Development

This is where most .NET developers first encounter native interop without expecting it. WinUI 3 is built on top of WinRT, which is itself built on COM. When you build a WinUI desktop application, you're constantly crossing the managed-to-native boundary without realizing it because the tooling hides it well.

Consider what happens when you need to open a file picker in a WinUI desktop app. Unlike UWP (where the app model handled window ownership automatically), desktop apps must explicitly tell the system dialog which window owns it. That means getting the native window handle (an `HWND`) from your managed `Window` object and passing it to the picker before it can display:

```csharp
// Get the native window handle from the managed WinUI Window
IntPtr hwnd = WindowNative.GetWindowHandle(window);

// Tell the file picker which window it belongs to
var picker = new FileOpenPicker();
InitializeWithWindow.Initialize(picker, hwnd);
```

That `WindowNative.GetWindowHandle` call is reaching through the WinRT/COM layer to get a native pointer. The `InitializeWithWindow.Initialize` call passes that pointer to a COM interface (`IInitializeWithWindow`) that the picker implements. This same pattern appears whenever a WinUI desktop app interacts with system dialogs, camera capture, or any UI component that needs window ownership.

The `WinRT.Interop` namespace exists specifically to bridge these gaps. Every time you see code importing from that namespace, native interop is happening.

### Performance-Critical Code

Sometimes managed overhead matters. If you have an optimized C++ math library, a native image processing pipeline, or a compression algorithm tuned for specific hardware, calling into that native code directly avoids the cost of reimplementing it in C# and potentially losing performance characteristics.

## P/Invoke: Calling Native Functions

Platform Invocation Services (P/Invoke) is the mechanism for calling functions that live in native DLLs. The concept is straightforward: you declare a C# method signature that matches a function exported by a native library, and the runtime handles the rest.

### How It Works

When you call a P/Invoke method, the runtime performs several steps. It locates and loads the native DLL, finds the function by name (or by an explicit entry point you specify), converts your managed parameters into their native equivalents (a process called marshaling), switches from the managed execution context to native execution, runs the function, converts return values back to managed types, and returns control to your code.

The declaration looks like this:

```csharp
[DllImport("user32.dll", SetLastError = true)]
public static extern bool MessageBox(IntPtr hWnd, string text, string caption, uint type);
```

The `DllImport` attribute tells the runtime which DLL contains the function. `SetLastError = true` tells the runtime to capture the native error code before returning (important because other managed operations could overwrite it). The parameter types need to match what the native function expects, or the marshaling will produce incorrect results or crashes.

### LibraryImport: The Modern Approach

.NET 7 introduced `LibraryImport` as the successor to `DllImport`. The difference matters for practical reasons. `DllImport` generates marshaling code at runtime using reflection, which means it's incompatible with Ahead-of-Time (AOT) compilation and harder for the compiler to optimize. `LibraryImport` uses source generators to create the marshaling code at compile time, so you can inspect what it produces, it works with AOT, and it performs better.

```csharp
[LibraryImport("user32.dll", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
public static partial int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
```

The trade-off is that `LibraryImport` requires explicit marshaling annotations. With `DllImport`, the runtime made implicit decisions about how to convert types like `bool` (which has different sizes in different native conventions). With `LibraryImport`, you must be explicit, which eliminates an entire category of subtle bugs. For any new interop code, prefer `LibraryImport`.

## Marshaling: Translating Between Worlds

Marshaling is the process of converting data between managed and native representations. Some types are "blittable," meaning their managed and native memory layouts are identical. Types like `int`, `float`, `double`, and `IntPtr` can be passed directly without any conversion because they have the same byte representation on both sides.

Non-blittable types require actual translation. Strings are the most common example. A C# `string` is a managed object on the garbage-collected heap, stored as UTF-16. A native function might expect a null-terminated ANSI string, a UTF-8 string, or a wide (UTF-16) string. The marshaler copies the string data into a native-compatible format, passes a pointer to the native function, and cleans up afterward.

Structures need matching memory layouts. If your C# struct has fields in a different order than the native struct, or if the compiler inserts padding differently, the native function reads garbage data. The `StructLayout` attribute with `LayoutKind.Sequential` tells the C# compiler to lay out fields in declaration order without rearranging them, matching C struct conventions:

```csharp
// This C struct from a device SDK:
// struct SensorReading { int sensor_id; float temperature; long timestamp; };

// Must be matched exactly in C#, field by field, in the same order
[StructLayout(LayoutKind.Sequential)]
public struct SensorReading
{
    public int SensorId;
    public float Temperature;
    public long Timestamp;
}

// Now you can pass it directly to the native function
[LibraryImport("sensor_sdk")]
public static partial int ReadSensor(int deviceId, out SensorReading reading);
```

If you swapped `Temperature` and `SensorId` in the C# struct, the native function would write the sensor ID into the temperature field and vice versa. The code would compile and run without errors, but the values would be wrong. This is the kind of bug that can survive testing if you don't know to look for it.

Arrays require the native side to know the length (since native code has no built-in array length tracking), so you'll almost always pass the array alongside its length as a separate parameter:

```csharp
// Native function: int process_readings(SensorReading* data, int count);
[LibraryImport("sensor_sdk")]
public static partial int ProcessReadings(
    [MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 1)]
    SensorReading[] data,
    int count);

// The SizeParamIndex = 1 tells the marshaler that parameter at index 1 (count)
// specifies how many array elements to marshal
```

### Why Marshaling Bugs Are Dangerous

Marshaling errors don't throw friendly exceptions. They produce memory corruption, access violations, or subtly wrong behavior. If you declare a parameter as `int` but the native function expects a `long`, you've shifted every subsequent parameter by 4 bytes. The function reads the wrong memory for every argument after that point. The result could be a crash, corrupted data, or a security vulnerability.

This is why `LibraryImport`'s explicit marshaling is valuable. Making the conversion rules visible in the source code means code reviews can catch mismatches before they become runtime mysteries.

## COM: The Component Object Model

COM is often treated as an arcane legacy technology, but it's the foundation of a surprising amount of modern Windows development. Understanding what COM actually is and why it exists makes the "magic" in frameworks like WinUI and Office automation much less mysterious.

### The Problem COM Solves

In the early 1990s, Microsoft faced a fundamental problem: how do you let software components written in different languages, compiled by different compilers, and potentially running in different processes communicate with each other? C++ classes can't be shared across compiler boundaries because different compilers use different memory layouts, name mangling, and calling conventions. DLL functions work but only support simple function calls without the richness of object-oriented interfaces.

COM's answer was to define a binary standard for component interaction. Instead of sharing source code or class definitions, COM components expose functionality through interface pointers with a fixed memory layout (a virtual function table, or "vtable"). Any language that can work with pointers and follow the vtable convention can consume COM components. This is why you can use COM objects from C#, C++, Python, VBScript, and dozens of other languages.

### The Three Pillars of COM

**Interfaces, not classes.** COM components are accessed exclusively through interfaces. You never directly instantiate a COM class; you ask the COM runtime to create an instance and give you an interface pointer. This is why COM code always involves GUIDs (globally unique identifiers) that identify specific interfaces and classes. The most fundamental interface is `IUnknown`, which every COM object must implement. It provides three methods: `QueryInterface` (to ask for other interfaces the object supports), `AddRef` (to increment the reference count), and `Release` (to decrement it).

**Reference counting for lifetime management.** Unlike .NET's garbage collector, COM objects track their own lifetime through reference counting. Every time code obtains a reference to a COM object, it calls `AddRef`. When it's done, it calls `Release`. When the count reaches zero, the object destroys itself. This is deterministic (the object is freed immediately when the last reference is released), but it puts the burden on the caller to balance every `AddRef` with a `Release`. Forgetting to release creates memory leaks; releasing too early creates dangling pointers.

**Location transparency.** A COM object can live in your process, in another process on the same machine, or on a remote machine entirely. The client code doesn't change because COM's proxy/stub mechanism handles the communication. When you automate Excel from C#, Excel runs as a separate process, and COM marshals your method calls across the process boundary transparently.

### Where You Encounter COM Today

**WinUI and WinRT.** Windows Runtime (WinRT) is a modernized version of COM. It uses the same binary interface convention (vtables and `IUnknown`) but adds metadata, modern type support, and a cleaner activation model. When you write a WinUI application, the XAML framework, input handling, composition engine, and window management are all WinRT (COM) components. The C#/WinRT tooling generates projection code that makes these COM components look like regular .NET classes, but underneath, every property access and method call crosses the COM boundary.

**Office automation.** Controlling Word, Excel, Outlook, or any Office application from C# means working through COM interfaces. The Office applications expose their object models as COM type libraries, and your C# code communicates through Runtime Callable Wrappers (RCWs) that the .NET runtime generates to bridge the managed/COM boundary.

**Windows Shell and system components.** File dialogs, taskbar integration, notification icons, and many other Windows Shell features are COM-based. The file picker example from the WinUI section is a COM component implementing `IFileOpenDialog` behind the scenes.

**DirectX and media.** Graphics, audio, and video APIs on Windows are COM-based. Direct3D, DirectSound, Media Foundation, and related APIs all use COM interfaces.

### COM in .NET: The Runtime Callable Wrapper

When you use a COM object from C#, the .NET runtime creates a Runtime Callable Wrapper (RCW) around it. The RCW is a managed object that holds a reference to the underlying COM object and forwards your method calls across the boundary. It handles the marshaling, calling convention differences, and error translation (converting COM `HRESULT` error codes to .NET exceptions).

The RCW also participates in the .NET garbage collector, but here's where things get tricky: the GC is non-deterministic. It might not collect the RCW (and therefore release the COM object) for a long time. If the COM object holds expensive resources like file handles, database connections, or an entire Excel process, waiting for the GC is wasteful or even harmful.

This is why COM interop code often calls `Marshal.ReleaseComObject` explicitly. It tells the RCW to release its COM reference immediately rather than waiting for garbage collection. Forgetting this call is one of the most common COM interop bugs, and it's why Office automation code sometimes leaves phantom Excel processes running in the background.

Here's what proper COM cleanup looks like in practice with Excel automation:

```csharp
Excel.Application? app = null;
Excel.Workbook? workbook = null;
Excel.Worksheet? sheet = null;

try
{
    app = new Excel.Application();
    workbook = app.Workbooks.Add();
    sheet = (Excel.Worksheet)workbook.Sheets[1];
    sheet.Cells[1, 1] = "Hello from C#";
    workbook.SaveAs("report.xlsx");
}
finally
{
    // Release in reverse order of acquisition.
    // Each ReleaseComObject call decrements the COM reference count,
    // allowing Excel to shut down cleanly.
    if (sheet != null) Marshal.ReleaseComObject(sheet);
    if (workbook != null) Marshal.ReleaseComObject(workbook);
    if (app != null)
    {
        app.Quit();
        Marshal.ReleaseComObject(app);
    }
}
```

Without the explicit `ReleaseComObject` calls, the RCWs keep COM references alive until the garbage collector runs. Excel can't shut down because something still holds references to its objects. Open Task Manager after running automation code without cleanup and you'll likely see `EXCEL.EXE` still running with no visible window.

### ComWrappers: The Modern COM Approach

.NET 5 introduced the `ComWrappers` API as a replacement for the built-in COM interop infrastructure. The older approach relied heavily on runtime code generation, which doesn't work with AOT compilation and is difficult to optimize. `ComWrappers` gives you explicit control over how COM objects are wrapped and unwrapped, making it compatible with AOT and source generators.

WinRT projections (the code that makes WinRT/COM objects look like .NET classes in WinUI) use `ComWrappers` internally. When you see the `CsWinRT` source generator producing code in your WinUI project's `obj` folder, it's generating `ComWrappers`-based interop code.

## Resource Management Across the Boundary

Native resources like file handles, socket handles, device contexts, and COM object references exist outside the garbage collector's awareness. If a managed object holding a native handle gets collected without releasing that handle, the resource leaks. The .NET `SafeHandle` class solves this by tying native handle cleanup to the finalizer, ensuring the handle is released even if your code forgets or an exception interrupts normal cleanup.

The practical rule is straightforward: any time you obtain a native handle or COM reference, wrap it in either a `SafeHandle` subclass or a `using` pattern that guarantees cleanup. The `SafeHandle` approach is preferred because it's resilient to thread aborts and other edge cases that `try/finally` blocks can miss.

```csharp
// A SafeHandle subclass for a hypothetical device connection
public class SafeDeviceHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeDeviceHandle() : base(ownsHandle: true) { }

    // This runs when the handle needs cleanup, even if your code
    // threw an exception or forgot to call Dispose
    protected override bool ReleaseHandle()
    {
        return NativeMethods.CloseDevice(handle);
    }
}

// The P/Invoke declaration returns SafeDeviceHandle instead of raw IntPtr
[LibraryImport("device_sdk", SetLastError = true)]
public static partial SafeDeviceHandle OpenDevice(int deviceId);

// Usage: the using statement guarantees ReleaseHandle runs
using SafeDeviceHandle device = NativeMethods.OpenDevice(42);
if (device.IsInvalid)
{
    int error = Marshal.GetLastWin32Error();
    throw new Win32Exception(error);
}
// Use the device... handle is released automatically when scope ends
```

Compare this to using raw `IntPtr`, where an exception between opening and closing the handle leaks the native resource permanently. `SafeHandle` eliminates that entire class of bugs.

## Error Handling Across the Boundary

Managed and native code use different error reporting mechanisms. .NET uses exceptions. Windows APIs typically use boolean return values with a thread-local error code (`GetLastError`). COM uses `HRESULT` return codes where negative values indicate failure.

The danger is that the error information is ephemeral. Between a failed native call and your code checking the error, the runtime might make other native calls internally (for garbage collection, thread management, or other housekeeping). Those internal calls can overwrite the error code. The `SetLastError = true` attribute on P/Invoke declarations tells the runtime to capture the error code immediately after the native call returns, before anything else can overwrite it.

```csharp
[LibraryImport("kernel32.dll", SetLastError = true)]
[return: MarshalAs(UnmanagedType.Bool)]
public static partial bool CloseHandle(IntPtr handle);

// After a P/Invoke call, check the return value FIRST,
// then retrieve the error code IMMEDIATELY
bool success = NativeMethods.CloseHandle(handle);
if (!success)
{
    // GetLastWin32Error returns the value captured by SetLastError = true.
    // Without that attribute, this could return a stale error from an
    // unrelated internal call.
    int errorCode = Marshal.GetLastWin32Error();
    throw new Win32Exception(errorCode);
}
```

For COM, the .NET runtime translates `HRESULT` failures into managed exceptions automatically when using RCWs. A failed COM call throws a `COMException` with the `HRESULT` value, which you can inspect to determine the specific failure. Common values like `E_OUTOFMEMORY`, `E_INVALIDARG`, and `E_FAIL` map to recognizable exception types.

## Memory Pinning: Keeping Things in Place

The .NET garbage collector periodically moves objects in memory to compact the heap and improve allocation performance. This is normally invisible to managed code because the runtime updates all references automatically. But native code doesn't know about the GC. If you pass a pointer to a managed array into a native function and the GC moves that array while the native function is still using it, the native code reads or writes to memory that no longer belongs to that array.

Pinning tells the GC not to move a specific object for the duration of the native call. The `fixed` statement in C# pins an object for the scope of its block. For longer-lived scenarios, `GCHandle.Alloc` with `GCHandleType.Pinned` pins an object until you explicitly free the handle.

```csharp
byte[] sensorBuffer = new byte[4096];

// fixed pins the array in memory for the duration of the block.
// The GC will not move sensorBuffer while this scope is active,
// so the native function's pointer remains valid.
unsafe
{
    fixed (byte* ptr = sensorBuffer)
    {
        int bytesRead = NativeMethods.ReadSensorData(ptr, sensorBuffer.Length);
        // Process the data...
    }
}
// After the fixed block ends, the GC is free to move the array again
```

Pinning has a performance cost because it creates holes in the managed heap that the GC must work around. For short-duration native calls, the cost is negligible. For long-lived pinned buffers, consider allocating from the Pinned Object Heap (POH) introduced in .NET 5, which is designed for objects that need to stay in place.

## Cross-Platform Considerations

P/Invoke isn't Windows-specific. .NET on Linux and macOS can call into `.so` and `.dylib` native libraries using the same `DllImport` or `LibraryImport` attributes with different library names. The `NativeLibrary` class provides runtime resolution when you need to load platform-specific libraries dynamically.

COM, however, is a Windows technology. While there are limited COM-like mechanisms on other platforms (and Mono had some COM support), COM interop in the way described here is a Windows concern. Cross-platform applications that need component interop typically use approaches like gRPC, shared libraries with C-style exports, or platform-specific abstraction layers.

## Common Pitfalls

**Forgetting to release COM objects.** The garbage collector will eventually clean up RCWs, but "eventually" might mean phantom Office processes, locked files, or exhausted system resources. Release COM objects explicitly when you're done with them.

**Mismatched calling conventions.** Windows APIs use `StdCall` (callee cleans the stack), C libraries use `Cdecl` (caller cleans the stack). Using the wrong convention corrupts the stack, which might not crash immediately but will produce bizarre behavior later.

**String encoding mismatches.** Passing a UTF-16 string to a function expecting ANSI (or vice versa) produces garbled text or buffer overruns. Always verify what encoding the native function expects and annotate accordingly.

**32-bit vs 64-bit pointer sizes.** `IntPtr` changes size between 32-bit and 64-bit processes. If you use `int` where a pointer-sized value is expected, your code works on 32-bit but fails on 64-bit. Always use `IntPtr` or `nint` for handles and pointers.

**Ignoring return values.** Many native functions communicate errors through return values. Ignoring them means your code continues with invalid handles or corrupted state, turning a recoverable error into a crash or data corruption.
