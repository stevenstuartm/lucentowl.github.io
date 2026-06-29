---
title: "C# Unsafe Code and Pointers"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "Direct memory manipulation with pointers, fixed buffers, and interop scenarios requiring unsafe code in C#."
tags: [c-sharp, dotnet, unsafe, pointers, memory, interop, advanced]
---

## When to Use Unsafe Code

<div class="callout callout--warning">
<p class="callout__title">Unsafe Code Is Rarely Necessary</p>
<p>Modern C# provides safe alternatives like <code>Span&lt;T&gt;</code>, <code>Memory&lt;T&gt;</code>, and <code>ref</code> that deliver nearly identical performance without sacrificing safety. Use unsafe code only when absolutely required.</p>
</div>

Unsafe code bypasses .NET's memory safety guarantees. Use it only when:

- **Interoperating with native code** that expects pointers
- **Performance-critical code** where bounds checking overhead matters
- **Working with hardware** or memory-mapped devices
- **Implementing low-level data structures** that require pointer arithmetic

Prefer safe alternatives like `Span<T>`, `Memory<T>`, and `ref` when possible. They provide similar performance without sacrificing safety.

## Enabling Unsafe Code

```xml
<!-- In .csproj -->
<PropertyGroup>
  <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
</PropertyGroup>
```

```csharp
// Mark methods, classes, or blocks as unsafe
public unsafe void UnsafeMethod()
{
    int* ptr = stackalloc int[10];
}

public void MixedMethod()
{
    // Safe code here

    unsafe
    {
        // Unsafe block within safe method
        int x = 42;
        int* ptr = &x;
    }

    // Back to safe code
}

// Entire class can be unsafe
public unsafe class UnsafeClass
{
    private int* _buffer;
}
```

## Pointer Basics

### Declaring and Using Pointers

```csharp
unsafe void PointerBasics()
{
    // Pointer declaration
    int* intPtr;        // Pointer to int
    byte* bytePtr;      // Pointer to byte
    void* voidPtr;      // Pointer to unknown type

    // Get address of variable
    int value = 42;
    intPtr = &value;    // intPtr points to value

    // Dereference pointer
    int retrieved = *intPtr;  // 42

    // Modify through pointer
    *intPtr = 100;
    Console.WriteLine(value);  // 100

    // Null pointer
    int* nullPtr = null;
    if (nullPtr == null)
        Console.WriteLine("Null pointer");
}
```

### Pointer Arithmetic

```csharp
unsafe void PointerArithmetic()
{
    int[] array = { 10, 20, 30, 40, 50 };

    fixed (int* ptr = array)
    {
        // Pointer arithmetic moves by element size
        int* p = ptr;
        Console.WriteLine(*p);       // 10

        p++;                         // Move to next int (4 bytes)
        Console.WriteLine(*p);       // 20

        p += 2;                      // Skip 2 elements
        Console.WriteLine(*p);       // 40

        // Index syntax
        Console.WriteLine(ptr[0]);   // 10
        Console.WriteLine(ptr[4]);   // 50

        // Difference between pointers
        int* start = ptr;
        int* end = ptr + 5;
        long elements = end - start; // 5 elements
    }
}
```

### Pointer Types

```csharp
unsafe void PointerTypes()
{
    // Pointers to value types
    int i = 10;
    int* pi = &i;

    double d = 3.14;
    double* pd = &d;

    // Pointer to struct
    Point point = new(10, 20);
    Point* pp = &point;
    Console.WriteLine(pp->X);  // Arrow operator for member access

    // void pointer - generic pointer
    void* vp = pi;
    // Must cast before dereferencing
    int value = *(int*)vp;

    // Pointer to pointer
    int** ppi = &pi;
    int retrieved = **ppi;  // Double dereference
}

public struct Point
{
    public int X;
    public int Y;
    public Point(int x, int y) => (X, Y) = (x, y);
}
```

## The fixed Statement

Managed objects can be moved by the GC. The `fixed` statement pins objects in memory.

```csharp
unsafe void FixedExample()
{
    string text = "Hello";
    int[] numbers = { 1, 2, 3, 4, 5 };

    // Pin string to get char*
    fixed (char* charPtr = text)
    {
        for (int i = 0; i < text.Length; i++)
            Console.Write(charPtr[i]);
    }

    // Pin array to get element pointer
    fixed (int* arrayPtr = numbers)
    {
        int sum = 0;
        for (int i = 0; i < numbers.Length; i++)
            sum += arrayPtr[i];
        Console.WriteLine($"Sum: {sum}");
    }

    // Pin multiple in one statement
    byte[] data1 = new byte[10];
    byte[] data2 = new byte[10];

    fixed (byte* p1 = data1, p2 = data2)
    {
        CopyMemory(p1, p2, 10);
    }

    // Pin object field
    var holder = new DataHolder();
    fixed (int* valuePtr = &holder.Value)
    {
        *valuePtr = 42;
    }
}

class DataHolder
{
    public int Value;
}
```

### Fixed Keyword on Fields (C# 12)

```csharp
// Fixed-size buffer in struct (older approach)
public unsafe struct FixedBuffer
{
    public fixed byte Data[256];  // Inline array
}

// Usage
unsafe void UseFixedBuffer()
{
    FixedBuffer buffer = new();
    buffer.Data[0] = 1;
    buffer.Data[255] = 255;

    // Get pointer without fixed statement
    byte* ptr = buffer.Data;
}

// Modern approach: InlineArray (C# 12) - no unsafe needed
[System.Runtime.CompilerServices.InlineArray(256)]
public struct SafeBuffer
{
    private byte _element0;
}
```

## stackalloc

<div class="callout callout--tip">
<p class="callout__title">Prefer Span&lt;T&gt; Over Raw Pointers</p>
<p>Modern C# allows <code>Span&lt;T&gt; span = stackalloc T[size]</code> without unsafe code. This gives you stack allocation with bounds checking and without pointer arithmetic risks.</p>
</div>

Allocate on the stack without GC involvement.

```csharp
unsafe void StackAllocation()
{
    // Traditional unsafe stackalloc
    int* buffer = stackalloc int[100];
    for (int i = 0; i < 100; i++)
        buffer[i] = i;

    // Modern safe stackalloc with Span (preferred)
    Span<int> safeBuffer = stackalloc int[100];
    for (int i = 0; i < 100; i++)
        safeBuffer[i] = i;

    // Conditional stackalloc (stack for small, heap for large)
    int size = GetSize();
    Span<byte> data = size <= 1024
        ? stackalloc byte[size]
        : new byte[size];
}

int GetSize() => 100;
```

### stackalloc Best Practices

- Keep allocations small (< 1KB is safe)
- Don't return stackalloc'd memory from methods
- Prefer `Span<T>` over raw pointers
- Use conditional allocation for variable sizes

## Memory Manipulation

### sizeof and Alignment

```csharp
unsafe void SizeAndAlignment()
{
    // Built-in type sizes
    int intSize = sizeof(int);       // 4
    int longSize = sizeof(long);     // 8
    int doubleSize = sizeof(double); // 8

    // Struct sizes (compile-time constant for unmanaged structs)
    int pointSize = sizeof(Point);

    // For managed types, use Marshal
    int stringSize = Marshal.SizeOf<string>();  // Platform-dependent
}

// Control struct layout for interop
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct PackedStruct
{
    public byte A;    // Offset 0
    public int B;     // Offset 1 (no padding)
    public byte C;    // Offset 5
}
// Total size: 6 bytes

[StructLayout(LayoutKind.Explicit)]
public struct ExplicitStruct
{
    [FieldOffset(0)] public int Value;
    [FieldOffset(0)] public byte Byte0;  // Union-style overlap
    [FieldOffset(1)] public byte Byte1;
    [FieldOffset(2)] public byte Byte2;
    [FieldOffset(3)] public byte Byte3;
}
```

### Memory Copy Operations

```csharp
using System.Runtime.CompilerServices;

unsafe void MemoryCopy()
{
    byte[] source = new byte[1000];
    byte[] dest = new byte[1000];

    fixed (byte* src = source, dst = dest)
    {
        // Using Unsafe.CopyBlock
        Unsafe.CopyBlock(dst, src, 1000);

        // Using Buffer.MemoryCopy (handles overlapping regions)
        Buffer.MemoryCopy(src, dst, 1000, 1000);
    }

    // Safe alternative with Span
    source.AsSpan().CopyTo(dest);
}
```

### Reinterpret Cast

```csharp
unsafe void ReinterpretCast()
{
    float f = 3.14f;

    // View float bits as int
    int* intPtr = (int*)&f;
    int bits = *intPtr;  // IEEE 754 representation

    // Using Unsafe class (preferred)
    int safeBits = Unsafe.As<float, int>(ref f);

    // Using BitConverter (safest)
    int safestBits = BitConverter.SingleToInt32Bits(f);
}
```

## Function Pointers (C# 9+)

Type-safe, high-performance function pointers for callbacks.

```csharp
unsafe void FunctionPointers()
{
    // Function pointer type
    delegate*<int, int, int> addPtr = &Add;

    int result = addPtr(5, 3);  // 8

    // With calling convention (for native interop)
    delegate* unmanaged[Cdecl]<int, int> nativeFunc;

    // Store in variable
    var operation = GetOperation(true);
    Console.WriteLine(operation(10, 5));  // 15 or 5

    static int Add(int a, int b) => a + b;
    static int Subtract(int a, int b) => a - b;

    static delegate*<int, int, int> GetOperation(bool add)
    {
        return add ? &Add : &Subtract;
    }
}
```

## Native Interop with Pointers

### P/Invoke with Pointers

```csharp
using System.Runtime.InteropServices;

public static partial class NativeMethods
{
    // Pass pointer to native code
    [DllImport("kernel32.dll")]
    public static extern unsafe bool ReadFile(
        IntPtr hFile,
        byte* lpBuffer,
        int nNumberOfBytesToRead,
        int* lpNumberOfBytesRead,
        IntPtr lpOverlapped);

    // Modern LibraryImport (source generated)
    [LibraryImport("mylib")]
    public static unsafe partial int ProcessData(
        byte* data,
        int length);
}

unsafe void UseNativeMethod()
{
    byte[] buffer = new byte[1024];
    int bytesRead;

    fixed (byte* bufferPtr = buffer)
    {
        NativeMethods.ReadFile(
            fileHandle,
            bufferPtr,
            buffer.Length,
            &bytesRead,
            IntPtr.Zero);
    }
}
```

### Working with Native Structures

```csharp
[StructLayout(LayoutKind.Sequential)]
public struct NativePoint
{
    public int X;
    public int Y;
}

unsafe void NativeStructs()
{
    NativePoint point = new() { X = 10, Y = 20 };

    // Pass struct by pointer
    ProcessPoint(&point);

    // Array of structs
    NativePoint[] points = new NativePoint[100];
    fixed (NativePoint* ptr = points)
    {
        ProcessPoints(ptr, points.Length);
    }
}
```

## Unsafe and ref Safety

### ref returns with Pointers

```csharp
public struct LargeStruct
{
    public int Value1, Value2, Value3, Value4;
}

// Return reference to avoid copy
public unsafe ref LargeStruct GetByRef(LargeStruct* array, int index)
{
    return ref array[index];
}

// Safe alternative with Span
public ref LargeStruct GetByRefSafe(Span<LargeStruct> array, int index)
{
    return ref array[index];
}
```

### Unsafe.AsRef and Related Methods

```csharp
using System.Runtime.CompilerServices;

void UnsafeHelpers()
{
    byte[] data = new byte[100];

    // Read struct from byte array
    ref MyStruct structRef = ref Unsafe.As<byte, MyStruct>(ref data[0]);

    // Read value at offset
    int value = Unsafe.ReadUnaligned<int>(ref data[4]);

    // Write value at offset
    Unsafe.WriteUnaligned(ref data[8], 42);

    // Add offset to reference
    ref byte offset10 = ref Unsafe.Add(ref data[0], 10);

    // Check if same reference
    bool same = Unsafe.AreSame(ref data[0], ref data[0]);
}

struct MyStruct
{
    public int A, B, C;
}
```

## Common Patterns

### High-Performance Buffer Processing

```csharp
public unsafe class FastBuffer
{
    private byte* _buffer;
    private int _length;

    public FastBuffer(int size)
    {
        _buffer = (byte*)NativeMemory.Alloc((nuint)size);
        _length = size;
    }

    public byte this[int index]
    {
        get => _buffer[index];
        set => _buffer[index] = value;
    }

    public void Fill(byte value)
    {
        Unsafe.InitBlock(_buffer, value, (uint)_length);
    }

    public void Dispose()
    {
        if (_buffer != null)
        {
            NativeMemory.Free(_buffer);
            _buffer = null;
        }
    }
}
```

### Image Processing

```csharp
unsafe void ProcessImageFast(byte* pixels, int width, int height)
{
    int stride = width * 4;  // RGBA

    for (int y = 0; y < height; y++)
    {
        byte* row = pixels + (y * stride);
        for (int x = 0; x < width; x++)
        {
            byte* pixel = row + (x * 4);
            // Invert colors
            pixel[0] = (byte)(255 - pixel[0]);  // R
            pixel[1] = (byte)(255 - pixel[1]);  // G
            pixel[2] = (byte)(255 - pixel[2]);  // B
            // pixel[3] is alpha, leave unchanged
        }
    }
}
```

## Safe Alternatives to Consider

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Unsafe Approach</h4>
<ul>
<li>Direct pointer manipulation</li>
<li>No bounds checking</li>
<li>Requires unsafe keyword</li>
<li>Memory corruption risks</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Safe Alternative</h4>
<ul>
<li>Span&lt;T&gt; and Memory&lt;T&gt;</li>
<li>Automatic bounds checking</li>
<li>Same performance characteristics</li>
<li>GC-safe and verifiable</li>
</ul>
</div>
</div>

| Unsafe Pattern | Safe Alternative |
|----------------|------------------|
| `int* ptr = stackalloc int[10]` | `Span<int> span = stackalloc int[10]` |
| `fixed (byte* p = array)` | `array.AsSpan()` |
| Pointer arithmetic | Span slicing and indexing |
| `sizeof(T)` | `Unsafe.SizeOf<T>()` |
| Manual memory copy | `Span<T>.CopyTo()` |
| Reinterpret cast | `MemoryMarshal.Cast<TFrom, TTo>()` |
| Function pointers | Delegates (if allocation acceptable) |

## Key Takeaways

**Prefer safe alternatives**: `Span<T>`, `Memory<T>`, and `ref` provide most benefits without the risks.

**Use fixed sparingly**: Pinning objects prevents GC compaction. Keep fixed blocks short.

**Watch for buffer overflows**: No bounds checking means bugs can corrupt memory or crash.

**Understand alignment**: Misaligned access can cause performance penalties or crashes on some architectures.

**Test thoroughly**: Unsafe bugs may not manifest immediately. Use sanitizers and code analysis tools.

**Document unsafe code**: Explain why unsafe is necessary and what invariants must be maintained.
