---
title: "C# Generics"
layout: guide
category: ".NET & C#"
subcategory: "Collections & Data"
description: "Generic types and methods in C#: why they avoid casts and boxing, how the runtime compiles them, type inference, the full set of constraints, what T? and default mean for a type parameter, static state per closed type, covariance and contravariance and their limits, and static abstract members and generic math."
tags: [generics, constraints, variance, static-abstract-members, generic-math, type-safety, practical]
---

## Why Generics

A generic type or method takes a **type parameter**, a placeholder such as `T` that the caller fills in with a real type. The code is written once and checked by the compiler for every type it's used with.

Before generics, reusable containers stored `object`, which cost type safety and, for value types, an allocation per element:

```csharp
// Without generics: anything goes in, a cast comes out
ArrayList untyped = new ArrayList();
untyped.Add(1);          // the int is boxed onto the heap
untyped.Add("string");   // compiles
int ok = (int)untyped[0];
int boom = (int)untyped[1];   // InvalidCastException at run time

// With generics: the compiler knows the element type
List<int> typed = new List<int>();
typed.Add(1);            // stored as an int, no boxing
// typed.Add("string");  // compile error
int value = typed[0];    // no cast
```

### How the Runtime Compiles Generic Code

Generic types exist at run time, not only at compile time: `List<int>` and `List<string>` are distinct types with their own metadata. The JIT compiles generic code differently for the two kinds of type argument. All reference-type instantiations, such as `List<string>` and `List<Customer>`, share one compiled copy of each method, since every reference is the same size. Each value-type instantiation, such as `List<int>` and `List<DateTime>`, gets its own compiled copy specialized for that type.

The specialization is why generic collections of value types don't box. It also lets the JIT treat `typeof(T)` as a constant in a value-type instantiation, so a branch like `if (typeof(T) == typeof(int))` costs nothing at run time.

## Generic Types

```csharp
public class Box<T>
{
    private T content;

    public Box(T content) => this.content = content;

    public T Unpack() => content;
}

var intBox = new Box<int>(42);
Box<string> stringBox = new("hello");
```

A type can take several parameters, and constraints on each go in separate `where` clauses:

```csharp
public class Repository<TKey, TEntity>
    where TKey : notnull
    where TEntity : class
{
    private readonly Dictionary<TKey, TEntity> store = new();

    public void Add(TKey key, TEntity entity) => store[key] = entity;
    public TEntity? Get(TKey key) => store.GetValueOrDefault(key);
}
```

## Generic Methods

A method can have its own type parameters, whether or not its class is generic. When only one method needs a type parameter, make the method generic rather than the class.

```csharp
public static class Utilities
{
    public static T Max<T>(T a, T b) where T : IComparable<T> =>
        a.CompareTo(b) >= 0 ? a : b;

    public static void Swap<T>(ref T a, ref T b) => (a, b) = (b, a);
}

int larger = Utilities.Max(10, 20);           // T inferred as int
string later = Utilities.Max("apple", "pear");
```

**Type inference works from arguments only.** The compiler infers `T` from the types of the arguments passed. It never infers from the return type or from what the result is assigned to, so a type parameter that appears only in the return type has to be written out:

```csharp
public static TResult Average<T, TResult>(IEnumerable<T> values) { /* ... */ }

// Average(numbers);                 // error CS0411: TResult can't be inferred
double mean = Average<int, double>(numbers);
```

## Constraints

Without constraints, the compiler lets code do only what every possible type supports: assign it, compare it to `default`, and call `object`'s members. A constraint narrows the allowed type arguments, and in exchange the code can use what the constraint guarantees.

| Constraint | Type argument must be | Which lets the code |
| --- | --- | --- |
| `where T : class` | A non-nullable reference type | Assign `null` to a `T?`, compare against `null` |
| `where T : class?` | Any reference type | Same, allowing nullable arguments |
| `where T : struct` | A non-nullable value type | Use `T?` as `Nullable<T>` |
| `where T : notnull` | Any non-nullable type, value or reference | Get nullable warnings if callers pass a nullable type |
| `where T : unmanaged` | A value type with no references anywhere inside | Use `stackalloc T[]`, pointers, and `sizeof(T)` |
| `where T : new()` | A type with a public parameterless constructor | Call `new T()` |
| `where T : SomeBase` | `SomeBase` or a type derived from it | Call `SomeBase`'s members |
| `where T : ISomething` | A type implementing the interface | Call the interface's members, including static abstract ones |
| `where T : Enum` / `Delegate` | An enum / a delegate type (C# 7.3) | Use `Enum` / `Delegate` APIs on `T` |
| `where T : allows ref struct` | Also permits `ref struct` types (C# 13) | Accept `Span<T>` and similar, under ref-safety rules |

```csharp
// Interface constraint: CompareTo is available on T
public class Ranking<T> where T : IComparable<T>
{
    private readonly List<T> items = new();
    public T Best() => items.Max()!;
}

// Several constraints together: class first, new() last
public class Cache<TKey, TEntity>
    where TKey : notnull, IComparable<TKey>
    where TEntity : class, IEntity, new()
{
    private readonly SortedDictionary<TKey, TEntity> store = new();

    public TEntity GetOrCreate(TKey key)
    {
        if (!store.TryGetValue(key, out var entity))
            store[key] = entity = new TEntity();
        return entity;
    }
}

// unmanaged: a stack buffer of any blittable type
public static void Process<T>(int count) where T : unmanaged
{
    Span<T> buffer = stackalloc T[count];
    // ...
}

// Enum constraint: combine with struct to exclude the Enum base class itself
public static string NameOf<T>(T value) where T : struct, Enum => Enum.GetName(value)!;
```

Constraints are part of the contract, not an implementation detail. Adding one to a published generic type or method breaks every caller that used a type argument the new constraint excludes.

## default and T?

`default(T)`, or plain `default` where the type is known, is the zero value of any type: `null` for reference types, `0` for numbers, and an all-zero struct for other value types. It is the only value that can be written for an unconstrained `T`.

What `T?` means depends on the constraint. With `where T : struct` it is `Nullable<T>`. With `where T : class` it is a nullable reference. With no constraint (C# 9) it means "`T`, or `default`," and for a value type argument that is just `T` itself, so a `T?` return with `T = int` returns `0`, not `null`. The `??` operator works on an unconstrained `T?` for the same reason:

```csharp
public static T Coalesce<T>(T? item, Func<T> fallback) => item ?? fallback();
```

## Static State Is Per Closed Type

Each constructed type, such as `Counter<int>` or `Counter<string>`, is a separate type with its own static fields:

```csharp
public class Counter<T>
{
    private static int count;
    public Counter() => count++;
    public static int Count => count;
}

_ = new Counter<int>();
_ = new Counter<int>();
_ = new Counter<string>();

Console.WriteLine(Counter<int>.Count);     // 2
Console.WriteLine(Counter<string>.Count);  // 1
```

That makes a static field in a generic class a cheap per-type cache, keyed by the type argument with no dictionary lookup. `EqualityComparer<T>.Default` works this way. It also means a static field meant to be shared across all instantiations won't be.

## Covariance and Contravariance

Variance answers whether `Something<Dog>` can be used where `Something<Animal>` is expected, given that `Dog` derives from `Animal`. For most generic types the answer is no. A `List<Dog>` is not a `List<Animal>`, because code holding it as a `List<Animal>` could add a `Cat`.

The answer becomes yes when the type parameter flows in only one direction. C# lets interfaces and delegates declare that direction:

| Modifier | `T` appears only as | Assignment allowed | Example |
| --- | --- | --- | --- |
| `out` (covariant) | Output: return values | `I<Dog>` → `I<Animal>` | `IEnumerable<out T>`, `IReadOnlyList<out T>`, `Func<out TResult>` |
| `in` (contravariant) | Input: parameters | `I<Animal>` → `I<Dog>` | `IComparer<in T>`, `IEqualityComparer<in T>`, `Action<in T>` |

```csharp
// Covariance: a sequence that produces Dogs produces Animals
IEnumerable<Animal> animals = new List<Dog>();

// Contravariance: a comparer that can compare any Animal can compare Dogs
IComparer<Animal> byName = Comparer<Animal>.Create((a, b) => string.Compare(a.Name, b.Name));
IComparer<Dog> dogsByName = byName;

// Delegates: Func is contravariant in its input and covariant in its output
Func<Animal, string> describe = a => a.Name;
Func<Dog, object> describeDog = describe;
```

The direction trips people up with contravariance. An `in` parameter lets a **more general** implementation stand in for a more specific one. A converter declared `IConverter<in TInput, out TOutput>` that accepts any `Animal` can be used as an `IConverter<Dog, object>`, but a converter that only accepts `Dog` can't be used as an `IConverter<Animal, string>`, since it might be handed a `Cat`.

Three limits apply:

- **Only interfaces and delegates can be variant.** Classes and structs can't, which is why `List<T>` isn't covariant even though `IEnumerable<T>` is.
- **Only reference-type arguments vary.** `IEnumerable<string>` converts to `IEnumerable<object>`, but `IEnumerable<int>` doesn't, because turning an `int` into an `object` requires boxing each element rather than reinterpreting a reference.
- **Arrays are covariant, unsafely.** `object[] objects = new string[1];` compiles, and storing a non-string into it throws `ArrayTypeMismatchException` at run time. This predates generics, and the generic interfaces don't repeat the mistake.

Declaring variance on your own interface is a matter of adding `out` or `in` where the type parameter really does flow only one way. The compiler rejects the modifier if the parameter appears in the wrong position.

## Static Abstract Members and Generic Math (C# 11)

An interface constraint normally gives access to instance members: `where T : IComparable<T>` lets code call `a.CompareTo(b)`. It couldn't express "`T` has a `+` operator" or "`T` has a `Zero` value", since those are static. C# 11 lets an interface declare `static abstract` members, and `static virtual` ones with a default, which every implementing type must supply as its own static members. Code constrained to the interface calls them through the type parameter:

```csharp
public interface IHasEmpty<TSelf> where TSelf : IHasEmpty<TSelf>
{
    static abstract TSelf Empty { get; }
}

public readonly record struct Money(decimal Amount, string Currency) : IHasEmpty<Money>
{
    public static Money Empty => new(0m, "");
}

public static T FirstOrEmpty<T>(IEnumerable<T> items) where T : IHasEmpty<T>
{
    foreach (var item in items) return item;
    return T.Empty;   // resolved from the type argument at compile time
}
```

The self-referencing constraint `TSelf : IHasEmpty<TSelf>` lets the interface name the implementing type in its own signatures, so `Empty` returns a `Money` rather than some interface type.

A static abstract member can only be reached through a type parameter, since there is no instance to dispatch on. A variable of the interface type is allowed but can't reach those members, and the interface itself can't be a type argument: `List<IHasEmpty<Money>>` is error CS8920, because `List<T>` could then call a static member that has no implementation.

The BCL's **generic math** interfaces in `System.Numerics` (.NET 7) are the main use. Every built-in numeric type implements `INumber<T>`, which brings operators, `Zero`, `One`, parsing, and conversion, so one method works for all of them:

```csharp
public static T Sum<T>(IEnumerable<T> values) where T : INumber<T>
{
    T total = T.Zero;
    foreach (var value in values)
        total += value;
    return total;
}

Sum([1, 2, 3]);          // 6, as int
Sum([1.5, 2.5]);         // 4, as double
Sum([1.1m, 2.2m]);       // 3.3, as decimal

// Converting between numeric types generically
public static TResult Average<T, TResult>(IEnumerable<T> values)
    where T : INumber<T>
    where TResult : INumber<TResult>
{
    TResult sum = TResult.Zero;
    int count = 0;
    foreach (var value in values)
    {
        sum += TResult.CreateChecked(value);   // throws OverflowException if it doesn't fit
        count++;
    }
    return sum / TResult.CreateChecked(count);
}
```

Smaller interfaces cover narrower needs: `IAdditionOperators<TSelf, TOther, TResult>` for types that only add, and `IParsable<TSelf>` for types with a static `Parse`, which lets a generic method turn strings into any parsable type without reflection:

```csharp
public static List<T> ParseAll<T>(IEnumerable<string> parts) where T : IParsable<T> =>
    parts.Select(p => T.Parse(p, CultureInfo.InvariantCulture)).ToList();

List<int> ids = ParseAll<int>(["1", "2", "3"]);
List<DateOnly> days = ParseAll<DateOnly>(["2026-01-01"]);
```

## Key Takeaways

**Generics give type safety without boxing.** The compiler checks every use, and value-type instantiations get specialized code with no per-element allocation.

**Inference comes from arguments only.** A type parameter used only in the return type must be written explicitly.

**Constrain for what the code needs.** Each constraint trades flexibility for the ability to call something on `T`, and adding one later is a breaking change.

**Unconstrained `T?` is `T` for value types.** "Null" for `T = int` is `0`.

**Static fields are per closed type.** Useful as a per-type cache, surprising if you expected one shared field.

**Variance is for interfaces and delegates over reference types.** `out` lets a producer of `Dog` serve as a producer of `Animal`, and `in` lets a consumer of `Animal` serve as a consumer of `Dog`.

**Use generic math instead of per-type overloads.** Constrain to `INumber<T>` or a narrower operator interface and write the algorithm once.
