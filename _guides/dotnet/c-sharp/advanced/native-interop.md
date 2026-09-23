---
title: "C# Native Interop (P/Invoke and COM)"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "How managed code calls native libraries and COM components: LibraryImport versus DllImport, marshalling and blittable types, matching native types including C long, strings and bool, pinning and callbacks, SafeHandle, error codes, COM lifetime and RCWs, and cross-platform library loading."
tags: [pinvoke, libraryimport, marshalling, com, safehandle, interop, advanced]
---

## The Boundary Between Managed and Native Code

C# code runs under the .NET runtime, which manages memory, moves objects during garbage collection, and checks types. That's the **managed** world. The operating system, device SDKs, and most system libraries are written in C or C++ and know nothing about any of it. That's the **native** world.

Most of the time the base class library crosses the boundary for you. `File.Open` calls `CreateFileW` on Windows and `open` on Linux, and `Socket` wraps the OS networking calls. You cross it yourself when:

- **An OS API has no managed wrapper.** Windows exposes thousands of functions the BCL never wraps, and Linux has system calls and libraries in the same position.
- **A vendor ships only a C SDK.** Hardware, sensors, cameras, and industrial devices commonly come with a C library and a header file.
- **A native library already does the job well.** A mature compression, imaging, or numerical library can be cheaper to call than to rewrite.
- **A framework is built on COM.** WinUI, the Windows Shell, DirectX, and Office are COM-based. A WinUI desktop app that opens a file picker has to hand the picker its window handle through a COM interface, which is the first interop many developers write without meaning to.

Every crossing costs something, and every mistake at it is unforgiving. A wrong declaration doesn't produce an exception with a helpful message. It produces corrupted memory, a crash in native code, or values that are silently wrong.

## P/Invoke: Calling Native Functions

**P/Invoke** (platform invoke) calls a function exported from a native library. You declare a C# method whose signature matches the native function, and the runtime loads the library, finds the export, converts the arguments, and makes the call.

### LibraryImport and DllImport

There are two ways to declare one:

```csharp
// Source-generated (.NET 7). Preferred
[LibraryImport("kernel32.dll", SetLastError = true)]
[return: MarshalAs(UnmanagedType.Bool)]
internal static partial bool CloseHandle(IntPtr handle);

// Runtime-generated. The original mechanism
[DllImport("kernel32.dll", SetLastError = true)]
internal static extern bool CloseHandle(IntPtr handle);
```

With `DllImport`, the runtime generates an **IL stub** the first time the method is called, a small piece of code that converts arguments, and JIT-compiles it. That stub is generated at run time, so trimmed and Native AOT applications can't depend on it. `LibraryImport` has a source generator write the same conversion code at build time, as ordinary C# you can read and step through. The declaration is `static partial` rather than `extern`, and the project needs `AllowUnsafeBlocks` (error SYSLIB1062 otherwise).

`LibraryImport` also refuses to guess. A `bool` or `string` parameter without explicit marshalling information is error SYSLIB1051, because the defaults `DllImport` applied to them caused a long history of bugs. Microsoft's guidance is to use `LibraryImport` on .NET 7 and later wherever possible. Analyzer SYSLIB1054 identifies `DllImport` declarations that can be converted. A few `DllImport` settings have different spellings: `CharSet` becomes `StringMarshalling` (with UTF-8 available directly and ANSI removed), and `CallingConvention` becomes the `[UnmanagedCallConv]` attribute.

### Finding the Library

The library name is resolved at the first call, and a failure throws `DllNotFoundException` then, not at startup. The runtime tries platform variations of the name, so `[LibraryImport("sensor_sdk")]` finds `sensor_sdk.dll` on Windows, `libsensor_sdk.so` on Linux, and `libsensor_sdk.dylib` on macOS. That lets one declaration serve every platform when the native library follows the naming convention.

When it doesn't, or the library lives somewhere unusual, `NativeLibrary.SetDllImportResolver` lets you choose the path per platform, and `NativeLibrary.TryLoad` checks whether a library can be loaded before relying on it. A missing export throws `EntryPointNotFoundException`. For a C++ library, the usual cause is a function declared without `extern "C"`, so its exported name is mangled.

## Marshalling: Matching Native Types

**Marshalling** converts arguments between managed and native representations. Its cost and its correctness both depend on whether a type needs converting at all.

**Blittable** types have the same bit layout on both sides and pass through unchanged: `byte`, `short`, `int`, `long`, their unsigned forms, `float`, `double`, `nint`, `nuint`, pointers, and structs made only of those. A one-dimensional array of them, like `int[]`, is passed by pinning it and handing native code a pointer to the elements, with no copy. `bool` is never blittable, `char` only sometimes, and `string` is copied unless it's passed as UTF-16.

### Types That Don't Mean What They Say

Most interop bugs come from a C type whose size differs from the C# type with the same name:

| Native type | C# type | Trap |
|---|---|---|
| `int`, `int32_t` | `int` | None; 32-bit everywhere |
| `long long`, `int64_t` | `long` | None; 64-bit everywhere |
| C `long`, `unsigned long` | `CLong`, `CULong` (.NET 6) | C `long` is **32-bit on Windows and 64-bit on 64-bit Linux and macOS**. C# `long` is always 64-bit |
| Windows `LONG`, `DWORD`, `ULONG` | `int`, `uint` | 32-bit on 64-bit Windows despite the names |
| Pointers, handles, `size_t`, `HWND` | `nint`/`IntPtr`, `nuint`, or a `SafeHandle` | Change size between 32-bit and 64-bit processes |
| Windows `BOOL` | `int`, or `bool` with `MarshalAs(UnmanagedType.Bool)` | 4 bytes |
| C `bool`, `_Bool` | `bool` with `MarshalAs(UnmanagedType.U1)` | 1 byte. Marshalled as a 4-byte `BOOL`, three bytes of whatever follows are read too |
| `wchar_t*` on Windows, `char16_t*` | `string` with `StringMarshalling.Utf16` | Passed without copying |
| `char*` holding UTF-8 | `string` with `StringMarshalling.Utf8` | Copied to a temporary native buffer |

C `long` is the one that survives testing. A declaration using C# `long` works on Linux and reads the wrong bits on Windows, or the reverse if it uses `int`. `CLong` has the right size on each platform. When C# and native types don't match in size, what goes wrong depends on the calling convention: arguments can arrive with garbage in their upper bytes, or later arguments can be read from the wrong place. Either way, nothing checks it.

### Structs

A struct passed to native code must have the native struct's fields in the same order, with the same sizes and alignment:

```csharp
// C header:
// typedef struct { int32_t sensor_id; float temperature; int64_t timestamp; } SensorReading;

[StructLayout(LayoutKind.Sequential)]   // The default for structs; stated here for readers
public struct SensorReading
{
    public int SensorId;
    public float Temperature;
    public long Timestamp;
}

[LibraryImport("sensor_sdk")]
internal static partial int ReadSensor(int deviceId, out SensorReading reading);

[LibraryImport("sensor_sdk")]
internal static partial int ProcessReadings([In] SensorReading[] data, int count);
```

C# structs are laid out sequentially by default, and the runtime inserts the same alignment padding a C compiler would. So the struct above is 16 bytes on both sides, and moving `Timestamp` to the front would add padding on both sides alike. Swap two fields, or use a type of a different size, and native code reads the wrong bytes with no error. Native code also has no array length, so an array always travels with a separate count.

Check the layout rather than trusting it. Compare `Marshal.SizeOf<SensorReading>()` against the native `sizeof`, since a size mismatch is the quickest sign of a wrong field. And keep structs blittable, which in practice means avoiding `bool` and `char` fields. A blittable struct is passed directly, while a non-blittable one is copied field by field on every call.

### Buffers From Native Code

Many C functions fill a caller-supplied buffer. With `LibraryImport`, a `Span<T>` is the natural type, and a stack buffer avoids allocating:

```csharp
[LibraryImport("kernel32.dll", StringMarshalling = StringMarshalling.Utf16)]
internal static partial uint GetSystemDirectoryW(Span<char> buffer, uint size);

Span<char> buffer = stackalloc char[260];
uint length = GetSystemDirectoryW(buffer, (uint)buffer.Length);
string systemDirectory = buffer[..(int)length].ToString();   // C:\WINDOWS\system32
```

Avoid `StringBuilder` parameters, a common pattern in older code. Marshalling one allocates and copies several times per call.

## Pinning and Lifetime

The garbage collector moves objects when it compacts the heap. Native code holding a pointer into a managed object would then read or write memory that now belongs to something else.

**For the duration of a call, the marshaller handles it.** An `int[]`, a UTF-16 `string`, or a `ref` to a blittable struct is pinned while the native function runs and unpinned when it returns. You don't need `fixed` for an ordinary synchronous call.

**Beyond the call, you're responsible.** If native code keeps the pointer, for example to fill a buffer asynchronously or to call back later, the object must stay put until native code is finished with it:

- Allocate the buffer with `GC.AllocateArray<byte>(size, pinned: true)`, which places it on the Pinned Object Heap, where it never moves.
- Or pin an existing object with `GCHandle.Alloc(obj, GCHandleType.Pinned)`, and call `Free` when native code is done. A handle that's never freed pins the object forever.
- Or allocate the buffer natively with `NativeMemory.Alloc`, which the GC never touches.

**Callbacks need their delegate kept alive.** `Marshal.GetFunctionPointerForDelegate` returns a pointer that doesn't keep the delegate reachable. If native code stores the pointer and the delegate is collected, the next callback jumps into freed memory. Keep the delegate in a field for as long as native code might call it. The better option for new code is a static method marked `[UnmanagedCallersOnly]`, passed as a function pointer, which has no delegate to lose.

## SafeHandle: Native Resources Without Leaks

A native handle, like a file, device connection, or library context, is just a number to the runtime. If the object holding it is garbage-collected without closing it, the handle leaks. `SafeHandle` ties the handle's release to disposal, and to a finalizer as a backstop:

```csharp
internal sealed class SafeDeviceHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeDeviceHandle() : base(ownsHandle: true) { }

    protected override bool ReleaseHandle() => NativeMethods.CloseDevice(handle);
}

internal static partial class NativeMethods
{
    [LibraryImport("device_sdk", SetLastError = true)]
    internal static partial SafeDeviceHandle OpenDevice(int deviceId);

    [LibraryImport("device_sdk")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool CloseDevice(IntPtr handle);
}

using SafeDeviceHandle device = NativeMethods.OpenDevice(42);
if (device.IsInvalid)
    throw new Win32Exception(Marshal.GetLastPInvokeError());
```

A declaration can return and accept the `SafeHandle` subclass directly, and the marshaller wraps the raw value on the way out. `SafeHandle` also prevents a subtler bug. The runtime keeps it alive and un-released for the duration of any call it's passed to, so a handle can't be closed by a finalizer on another thread while native code is still using it. A raw `IntPtr` offers no such guarantee. The BCL provides `SafeFileHandle` and several others. Write a subclass only for handles that none of them fit.

## Errors Across the Boundary

Native APIs report failure in several ways, and none of them is an exception:

| Convention | Used by | How to read it |
|---|---|---|
| Return value plus thread-local error code | Win32 (`GetLastError`), POSIX (`errno`) | `SetLastError = true` on the declaration, then `Marshal.GetLastPInvokeError()` |
| `HRESULT` return value | COM | Negative means failure. `Marshal.ThrowExceptionForHR(hr)` converts it |
| Status code return value | Most C SDKs | Check it against the SDK's documented values |

The thread-local error code is fragile. The runtime makes native calls of its own between yours, and any of them can overwrite it. `SetLastError = true` tells the generated code to capture the value the moment the native function returns. Read it immediately after the call and before anything else, and only when the return value says the call failed, since a successful call may leave a stale code behind:

```csharp
if (!NativeMethods.CloseHandle(handle))
    throw new Win32Exception(Marshal.GetLastPInvokeError());   // 6: "The handle is invalid."
```

`Marshal.GetLastPInvokeError` (.NET 6) is the current name for `GetLastWin32Error`, which returns the same value and despite its name also carries `errno` on Unix.

## COM

COM (Component Object Model) is Windows' binary standard for objects shared across languages, compilers, and processes. It predates .NET and sits under much of modern Windows.

### How COM Works

**Everything is an interface.** A COM object is reached only through interface pointers. Each interface has a GUID, and its methods are called through a fixed table of function pointers (a vtable), which any language that can call through a pointer can use. Every COM object implements `IUnknown`, whose `QueryInterface` asks for another interface the object supports.

**Lifetime is reference-counted.** Each holder of an interface pointer calls `AddRef` when it takes a reference and `Release` when it's done, and the object destroys itself when the count reaches zero. That's deterministic, unlike garbage collection, and fragile: one missing `Release` keeps the object alive forever.

**The object can live anywhere.** A COM server can run in your process, in another process, or on another machine, and proxies make the call look the same. Office automation works this way. Excel runs as its own process, and every call crosses into it.

**WinRT is COM with metadata.** The Windows Runtime used by WinUI keeps COM's vtables and `IUnknown` and adds type metadata. C#/WinRT generates projections that make WinRT types look like .NET classes, so a WinUI app crosses the COM boundary on nearly every property access without showing it.

### Runtime Callable Wrappers

When C# code uses a COM object, the runtime wraps it in a **Runtime Callable Wrapper** (RCW): a managed object that holds one COM reference and forwards calls, converting failed `HRESULT`s into exceptions. `E_INVALIDARG` becomes `ArgumentException`, `E_OUTOFMEMORY` becomes `OutOfMemoryException`, and unrecognized codes become `COMException`, whose `HResult` holds the value.

The RCW releases its COM reference only when the garbage collector finalizes it. For objects that hold something expensive, that delay shows up. Office automation is the classic case: `EXCEL.EXE` keeps running after the program finishes with it, because RCWs that haven't been collected still hold references.

Two things cause it. One is intermediate objects that the code never names:

```csharp
Excel.Workbook workbook = app.Workbooks.Add();   // app.Workbooks created an RCW that nothing releases
```

The other is waiting on the garbage collector. The fixes are to name every COM object you touch, and to release them when you're done:

```csharp
Excel.Application app = new Excel.Application();
Excel.Workbooks workbooks = app.Workbooks;
Excel.Workbook workbook = workbooks.Add();
try
{
    // ... work with the workbook ...
    workbook.SaveAs(path);
}
finally
{
    workbook.Close(SaveChanges: false);
    app.Quit();
    Marshal.ReleaseComObject(workbook);
    Marshal.ReleaseComObject(workbooks);
    Marshal.ReleaseComObject(app);
}
```

`Marshal.ReleaseComObject` releases the RCW's reference immediately. Use it with care. Any other variable still pointing at the same RCW becomes unusable, and calling through it throws `InvalidComObjectException`. The alternative, when the COM work is contained in one method, is to let every RCW go out of scope and then call `GC.Collect()` followed by `GC.WaitForPendingFinalizers()`, so the finalizers release everything at once.

### Modern COM Interop

The built-in COM support generates its wrappers at run time and only works on Windows, so it has the same problem under Native AOT as `DllImport`. `ComWrappers` (.NET 5) lets a library control how COM objects are wrapped, and C#/WinRT is built on it. For your own COM interfaces, `[GeneratedComInterface]` and `[GeneratedComClass]` (.NET 8) generate the interop code at build time, the COM counterpart to `LibraryImport`.

## Cross-Platform Interop

P/Invoke works on every platform .NET runs on. The differences are in the details:

- **Library names and loading** vary by platform, as described above.
- **C `long` and `wchar_t` change size.** `wchar_t` is 2 bytes on Windows and 4 bytes on Linux and macOS, so a `wchar_t*` API can't take a UTF-16 `string` on Unix.
- **Calling conventions** matter only for 32-bit x86, where Windows APIs use `stdcall` and C libraries `cdecl`. On x64 and Arm64 each platform has a single convention, and the runtime picks it.
- **COM is Windows-only.** A cross-platform component boundary uses a C API with plain exported functions, or a process boundary such as gRPC.

## Common Mistakes

**Mismatched type sizes.** C `long` declared as C# `long`, C `bool` marshalled as a 4-byte `BOOL`, or `int` used for a pointer-sized handle. Check each parameter against the header, not the documentation, when they disagree.

**Reading the error code late or unconditionally.** Capture it with `SetLastError = true`, read it immediately, and only after a failure.

**Letting native code keep a pointer to a movable object,** or a function pointer to a collectable delegate.

**Freeing memory with the wrong allocator.** Memory allocated by a native library must be freed by that library's own function, not by `Marshal.FreeHGlobal` or `NativeMemory.Free`, since each allocator manages its own heap.

**Leaking handles and COM references.** Wrap handles in `SafeHandle`, and name and release every COM object.

## Key Takeaways

**Use `LibraryImport` for new P/Invoke declarations.** It generates the marshalling code at build time, works under Native AOT, and makes you state how `bool` and strings cross.

**Match native types by size, not by name.** Use `CLong` for C `long`, a 1-byte `bool` for C `bool`, and `nint` or a `SafeHandle` for pointers and handles.

**Keep structs blittable** and check their size against the native `sizeof`.

**Pinning during a call is automatic.** Anything native code keeps after the call returns needs a pinned, native, or rooted object.

**Wrap handles in `SafeHandle`** and read error codes immediately after a failed call.

**Name every COM object and release it deliberately,** and prefer the source-generated COM interop for new interfaces.
