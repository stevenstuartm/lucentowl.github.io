---
title: "C# Unsafe Code and Pointers"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "What unsafe code gives up and when it's still needed: pointers and pointer arithmetic, pinning with fixed, fixed-size buffers, struct size and layout, function pointers, native memory exposed as Span, the Unsafe and MemoryMarshal APIs that bypass safety without the keyword, and SkipLocalsInit."
tags: [unsafe, pointers, fixed, function-pointers, nativememory, memory-management, advanced]
---

## What Unsafe Code Gives Up

Safe C# guarantees three things about memory. Every array and span access is bounds-checked. Every reference points at a live object of the right type. And the garbage collector knows where every reference is, so it can move objects and update the references to them. An `unsafe` context lets code use pointers, which carry none of these guarantees:

```csharp
int[] numbers = { 1, 2, 3 };

numbers.AsSpan()[3];            // IndexOutOfRangeException

fixed (int* p = numbers)
{
    int value = p[3];           // Reads whatever follows the array. No error
}
```

Measured on .NET 10, the pointer read returned 0, which was simply the next thing in memory. A write would have silently corrupted it. That is the whole trade: pointers skip the checks, and every mistake becomes memory corruption that surfaces later somewhere unrelated.

Most code that once needed pointers no longer does. `Span<T>`, `ref` locals and returns, `stackalloc` into a span, and the vectorized BCL methods cover buffer slicing, stack allocation, and fast copying safely, and the JIT removes many of their bounds checks. The remaining reasons to write `unsafe` are:

- **Native interop** that passes or receives raw pointers, especially to memory owned by native code.
- **Native memory** allocated outside the GC heap, before it's wrapped in a `Span<T>`.
- **Function pointers** for native callbacks or allocation-free dispatch.
- **Measured hot paths** where a profiler shows bounds checks or pinning costs that the safe form can't eliminate.

## Enabling Unsafe Code

The project must opt in, and code must mark where pointers are used:

```xml
<PropertyGroup>
  <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
</PropertyGroup>
```

```csharp
public unsafe void Method() { /* pointers allowed in the whole method */ }

public void Mixed()
{
    unsafe
    {
        int x = 42;
        int* p = &x;    // Pointers allowed only inside this block
    }
}

public unsafe struct Header { /* pointers allowed in every member */ }
```

Keep the `unsafe` region as small as possible. Reviewers search for the keyword, and a narrow block tells them exactly which lines to check.

## Pointers

A pointer holds a memory address. `&` takes the address of a variable, `*` reads or writes the value at an address, and `->` accesses a member of the struct a pointer points to:

```csharp
int value = 42;
int* p = &value;
*p = 100;                        // value is now 100

Point point = new(10, 20);
Point* pp = &point;
int x = pp->X;                   // Same as (*pp).X

void* untyped = p;
int back = *(int*)untyped;       // void* must be cast before dereferencing
```

Arithmetic on a typed pointer moves in whole elements, not bytes. `p + 1` on an `int*` advances four bytes, and `p[i]` means `*(p + i)`. Subtracting two pointers gives the number of elements between them as a `long`.

Pointers work only on **unmanaged types**: the numeric types, `char`, `bool`, enums, pointers, and structs containing only those. Taking the address of a managed type such as `string`, or of a struct containing a reference, compiles with warning CS8500 and is almost always a bug, since the GC can't see a reference held through a pointer.

### The Compiler Doesn't Track Pointer Lifetime

`ref` locals and `Span<T>` are checked by the compiler so they can't outlive what they point to. Pointers aren't:

```csharp
static unsafe int* Dangle()
{
    int x = 42;
    return &x;      // Compiles. The stack slot is reused after the method returns
}
```

Reading through the returned pointer printed 42 in testing, because nothing had overwritten the slot yet. It will print something else once another call reuses that stack space, which is what makes these bugs hard to find.

## Pinning with fixed

A local variable sits in a stack slot and never moves. An object on the heap does move, whenever the GC compacts. So taking the address of anything inside a heap object, like an array element, a string's characters, or a class's field, requires **pinning** it for the duration:

```csharp
int[] numbers = { 1, 2, 3, 4, 5 };
fixed (int* p = numbers)                // Pins the array; p points at element 0
{
    Sum(p, numbers.Length);
}

fixed (char* c = "text") { /* the string's characters, read-only in practice */ }

fixed (int* v = &holder.Value) { *v = 42; }   // A field of a class instance

Span<byte> span = GetBuffer();
fixed (byte* b = span) { /* works on anything with GetPinnableReference */ }
```

Taking a heap field's address outside `fixed` is error CS0212. Taking the address of a local inside `fixed` is error CS0213, since a local is already fixed.

A `fixed` pin is cheap. It costs nothing unless a GC runs while it's active, and then that object can't move, which fragments the heap around it. So keep `fixed` blocks short. Never let the pointer escape the block, because the object is free to move as soon as the block ends. For a buffer that must stay at one address for a long time, such as one handed to native code for asynchronous I/O, allocate it on the Pinned Object Heap instead: `GC.AllocateArray<byte>(size, pinned: true)` (.NET 5) returns an array that never moves and doesn't fragment the ordinary heap.

## Fixed-Size Buffers and Inline Arrays

A **fixed-size buffer** embeds an array of primitives directly inside a struct, for matching a native struct's layout:

```csharp
public unsafe struct DeviceHeader
{
    public int Version;
    public fixed byte Name[32];     // 32 bytes inline, not a reference to an array
}

DeviceHeader header = default;
header.Name[0] = (byte)'A';         // No bounds check
```

Fixed-size buffers have existed since C# 2, need an `unsafe` context, and hold only primitive element types. C# 12 added **inline arrays**, which do the same without `unsafe`, for any element type, and with bounds checks through a span:

```csharp
[InlineArray(32)]
public struct NameBuffer
{
    private byte _element0;
}

public struct DeviceHeader
{
    public int Version;
    public NameBuffer Name;
}
```

Use an inline array for new code. Keep fixed-size buffers for existing interop definitions.

## Size and Layout

`sizeof` gives an unmanaged type's size in bytes. For built-in types it's a constant usable anywhere. For a struct it needs an `unsafe` context, or use `Unsafe.SizeOf<T>()`. Field alignment padding counts toward the size:

```csharp
struct Unpacked { public byte A; public int B; public byte C; }   // sizeof = 12

[StructLayout(LayoutKind.Sequential, Pack = 1)]
struct Packed { public byte A; public int B; public byte C; }     // sizeof = 6
```

`B` in `Unpacked` is aligned to a 4-byte boundary, so three padding bytes follow `A`, and the struct is padded to a multiple of 4. `Pack = 1` removes the padding to match a packed native or file format, and costs a misaligned `int`. Ordinary reads handle that on x64 and Arm64, but `Interlocked` operations need aligned data. `LayoutKind.Explicit` with `[FieldOffset]` places each field by hand, which can also overlap fields like a C union.

`Marshal.SizeOf<T>()` answers a different question, the size of the type's *marshalled* native representation, and throws `ArgumentException` for types with no such layout, like `string`.

## Function Pointers

A function pointer (C# 9) calls a static method through its address, without the allocation and indirection of a delegate:

```csharp
static int Add(int a, int b) => a + b;
static int Subtract(int a, int b) => a - b;

delegate*<int, int, int> op = useAdd ? &Add : &Subtract;
int result = op(10, 5);
```

`delegate* unmanaged[Cdecl]<int, int>` declares a pointer with a native calling convention, which is how a native callback or a function looked up with `NativeLibrary.GetExport` is called. A C# method passed to native code as a callback is marked `[UnmanagedCallersOnly]`, and its address taken with `&`.

Function pointers can't point to instance methods or lambdas, and nothing checks that the pointer is valid. Outside interop, a delegate is simpler, and measure before assuming the function pointer is faster, since the JIT can devirtualize delegate calls when it knows the target.

## Native Memory Behind a Span

`NativeMemory` (.NET 6) allocates outside the GC heap. The memory never moves and isn't counted in GC heap size, and it's your job to free it exactly once. The safest shape keeps the pointer private and hands out a `Span<T>`, so callers get bounds checks and the only unsafe lines are in one class:

```csharp
public sealed unsafe class NativeBuffer : IDisposable
{
    private byte* _pointer;
    private readonly int _length;

    public NativeBuffer(int length)
    {
        _pointer = (byte*)NativeMemory.AllocZeroed((nuint)length);
        _length = length;
    }

    public Span<byte> Span => _pointer is null
        ? throw new ObjectDisposedException(nameof(NativeBuffer))
        : new Span<byte>(_pointer, _length);

    public void Dispose()
    {
        if (_pointer is not null)
        {
            NativeMemory.Free(_pointer);
            _pointer = null;
        }
    }
}
```

The class isn't thread-safe, and a span obtained before `Dispose` still points at freed memory afterwards. That remaining hazard is the price of native memory, and why it belongs behind a narrow API. If a buffer that forgets to be disposed must still be freed, add a finalizer or wrap the pointer in a `SafeHandle`.

## Unsafe Without the Keyword

Several BCL APIs are just as unsafe as pointers but compile without `unsafe` or `AllowUnsafeBlocks`:

| API | What it skips |
|---|---|
| `Unsafe.As<TFrom, TTo>(ref x)` | Type safety: reinterprets a reference as another type |
| `Unsafe.Add(ref r, n)`, `Unsafe.ReadUnaligned<T>(ref b)` | Bounds checks on reference arithmetic |
| `MemoryMarshal.GetReference(span)`, `GetArrayDataReference(array)` | Bounds checks, by starting reference arithmetic at element 0 |
| `MemoryMarshal.Cast<TFrom, TTo>(span)` | Type safety, reinterpreting a span's element type; the length is still checked |
| `CollectionsMarshal.AsSpan(list)` | The list's version check: an add that grows the list moves it to a new array and leaves the span on the old one |

A search for `unsafe` misses these, so they need the same review. When the safe version exists, prefer it: `BitConverter.SingleToInt32Bits(f)` over `Unsafe.As<float, int>(ref f)`, and `MemoryMarshal.Read<T>(span)`, which checks the span is long enough, over reinterpreting a byte reference.

## Skipping Zero-Initialization

The runtime zeroes every local variable and every `stackalloc` buffer before use. For a large `stackalloc` in a hot path, that zeroing is measurable. `[SkipLocalsInit]` on a method, type, or module turns it off:

```csharp
[SkipLocalsInit]
static int Checksum(ReadOnlySpan<byte> data)
{
    Span<byte> scratch = stackalloc byte[512];   // Not zeroed: contains leftover stack contents
    ...
}
```

It requires `AllowUnsafeBlocks` (error CS0227 otherwise), because reading a slot before writing it now returns whatever was left on the stack. Apply it only where a benchmark shows the zeroing matters, and only to code that writes every element before reading it.

## Key Takeaways

**Unsafe code turns every mistake into memory corruption.** Pointer reads and writes aren't bounds-checked, typed, or lifetime-checked.

**Reach for `Span<T>`, `ref`, and inline arrays first.** Keep `unsafe` for interop, native memory, function pointers, and measured hot spots.

**Pin only inside `fixed`, briefly, and never let the pointer escape.** Use the Pinned Object Heap for long-lived pinned buffers.

**Wrap native memory in a class that exposes `Span<T>`,** so the pointer arithmetic lives in one reviewed place.

**Review `Unsafe`, `MemoryMarshal`, and `CollectionsMarshal` like `unsafe` blocks.** They bypass the same checks without the keyword.

**Keep `unsafe` regions small and explain their invariants,** since the compiler no longer checks them.
