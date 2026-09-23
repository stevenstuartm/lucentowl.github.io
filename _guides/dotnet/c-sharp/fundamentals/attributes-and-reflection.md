---
title: "C# Attributes and Reflection"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Attributes as inert metadata and who reads them, attributes the compiler acts on, writing custom attributes and AttributeUsage, inspecting types and members with reflection, reading attributes at run time, what reflection costs and how to make it cheap, and why trimming and Native AOT constrain it."
tags: [attributes, reflection, custom-attributes, bindingflags, metadata, trimming, practical]
---

## Attributes Are Metadata

An attribute attaches a piece of data to a declaration such as a class, method, property, parameter, return value, or the whole assembly. The compiler stores it in the assembly's metadata alongside the type information, and **nothing happens as a result**. An attribute has no behaviour of its own. It matters only because some other code reads it.

```csharp
[Obsolete("Use CreateOrderAsync instead")]
public Order CreateOrder(Cart cart) { /* ... */ }

[JsonPropertyName("order_id")]
public int Id { get; set; }

[Required, StringLength(100)]
public string Name { get; set; } = "";
```

Those three attributes are read by three different consumers at three different times. The **compiler** reads `[Obsolete]` while compiling any caller and emits a warning. **System.Text.Json** reads `[JsonPropertyName]` at run time, or at build time when using its source generator, to decide the JSON name. **Validation code**, such as ASP.NET Core's model binding or `Validator.TryValidateObject`, reads `[Required]` and `[StringLength]` when asked to validate an object. Put `[Required]` on a property and never run a validator, and the property is exactly as optional as before.

That is the model to hold for every attribute. Ask who reads it and when. If the answer is "nothing in this program", the attribute is documentation.

## Attributes the Compiler Acts On

A few attributes change what the compiler itself does.

```csharp
[Obsolete("Use NewMethod")]            // warning at every call site
[Obsolete("Use NewMethod", error: true)]  // compile error at every call site
public void OldMethod() { }

[Conditional("DEBUG")]
public static void Trace(string message) => Console.WriteLine(message);
```

`[Conditional("DEBUG")]` on a `void` method makes the compiler **delete every call to it**, arguments included, when the `DEBUG` symbol isn't defined. `Trace($"state: {Expensive()}")` in a Release build doesn't call `Expensive()` at all. The method itself still exists in the assembly.

The caller-information attributes make the compiler fill in optional parameters at each call site:

```csharp
public static void Log(
    string message,
    [CallerMemberName] string member = "",
    [CallerFilePath] string file = "",
    [CallerLineNumber] int line = 0)
{
    Console.WriteLine($"[{member}:{line}] {message}");
}

public static void Require(
    bool condition,
    [CallerArgumentExpression(nameof(condition))] string? expression = null)   // C# 10
{
    if (!condition)
        throw new InvalidOperationException($"Requirement failed: {expression}");
}

Require(order.Total > 0);   // message: "Requirement failed: order.Total > 0"
```

The values are compile-time constants substituted where the call is written, so they cost nothing at run time. `[CallerArgumentExpression]` is how `ArgumentNullException.ThrowIfNull` knows the parameter's name.

Assembly-level attributes use the `assembly:` target and can go in any source file:

```csharp
[assembly: InternalsVisibleTo("MyProject.Tests")]
```

SDK-style projects generate the version and company attributes (`AssemblyVersion`, `AssemblyFileVersion`, and others) from project properties. Declaring `[assembly: AssemblyVersion(...)]` by hand in such a project is a duplicate-attribute compile error (CS0579). Set `<Version>` in the project file instead.

## Writing a Custom Attribute

A custom attribute is a class deriving from `Attribute`, named with the `Attribute` suffix, which C# lets you omit where it is applied. Constructor parameters become required positional arguments, and public settable properties become optional named ones:

```csharp
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class CacheAttribute : Attribute
{
    public CacheAttribute(int durationSeconds) => DurationSeconds = durationSeconds;

    public int DurationSeconds { get; }
    public string? Key { get; set; }
}

public class ProductService
{
    [Cache(300, Key = "products")]
    public IReadOnlyList<Product> GetProducts() { /* ... */ }
}
```

`[AttributeUsage]` controls three things:

| Setting | Meaning | Default when omitted |
|---------|---------|----------------------|
| `validOn` (the targets) | Which declarations may carry the attribute, such as `Class`, `Method`, `Property`, `Parameter`, or `ReturnValue`, combined with `\|` | `All` |
| `AllowMultiple` | Whether the same attribute can appear more than once on one declaration | `false` |
| `Inherited` | Whether a derived class or overriding method is treated as carrying the base's attribute when read with `inherit: true` | `true` |

Because arguments are stored in metadata, they must be **compile-time constants**: numbers, strings, `bool`, enum values, `typeof(...)`, `null`, and one-dimensional arrays of those. `new DateTime(2026, 1, 1)` or a `TimeSpan` can't be an attribute argument, which is why attributes take `int durationSeconds` rather than a `TimeSpan`.

### Generic Attributes (C# 11)

Before C# 11, an attribute that refers to a type took a `Type` argument, and nothing checked what type was passed. A generic attribute takes the type as a type argument, so constraints apply:

```csharp
public sealed class ValidatorAttribute<TValidator> : Attribute
    where TValidator : IValidator, new() { }

[Validator<EmailValidator>]              // compile error if EmailValidator isn't an IValidator
public string Email { get; set; } = "";

// Before C# 11:  [Validator(typeof(EmailValidator))], checked only when something reads it
```

The type argument must be fully known at compile time, so an attribute can't be applied as `[Validator<T>]` inside a generic class, and it can't use `dynamic` or a nullable reference type annotation.

## Reflection

Reflection is the API for reading that metadata at run time. It can describe any type, enumerate its members, read and write their values, call methods, create instances, and read attributes, all for types the calling code wasn't compiled against.

### Types and Members

```csharp
Type t1 = typeof(Person);                 // known at compile time
Type t2 = person.GetType();               // the run-time type of an instance
Type? t3 = Type.GetType("MyApp.Person, MyApp");   // by assembly-qualified name, null if not found

PropertyInfo[] props = t1.GetProperties();        // public instance and static properties
MethodInfo? toString = t1.GetMethod("ToString");
ConstructorInfo? ctor = t1.GetConstructor([typeof(string), typeof(int)]);
```

The member lookups return **public members only** by default. Other members need `BindingFlags`, and once any flags are passed, both a visibility flag and an instance-or-static flag must be included or nothing matches:

```csharp
var all = t1.GetProperties(
    BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static);

var none = t1.GetProperties(BindingFlags.NonPublic);   // empty: Instance or Static is missing
```

`GetMethod(name)` throws `AmbiguousMatchException` when the name is overloaded. Pass the parameter types to choose one.

### Reading and Invoking

```csharp
PropertyInfo name = typeof(Person).GetProperty("Name")!;
object? value = name.GetValue(person);
name.SetValue(person, "Bob");

MethodInfo add = typeof(Calculator).GetMethod("Add")!;
object? sum = add.Invoke(new Calculator(), [5, 3]);   // boxes the arguments and the result

object? created = Activator.CreateInstance(typeof(Person), "Alice", 30);
```

Generic types and methods are closed at run time with `MakeGenericType` and `MakeGenericMethod`:

```csharp
Type listOfString = typeof(List<>).MakeGenericType(typeof(string));
Type definition = typeof(List<int>).GetGenericTypeDefinition();    // List<>
Type[] arguments = typeof(List<int>).GetGenericArguments();         // [int]
```

### Reading Attributes

```csharp
MethodInfo method = typeof(ProductService).GetMethod(nameof(ProductService.GetProducts))!;

bool cached = method.IsDefined(typeof(CacheAttribute), inherit: true);
CacheAttribute? cache = method.GetCustomAttribute<CacheAttribute>();
IEnumerable<CacheAttribute> all = method.GetCustomAttributes<CacheAttribute>();
```

The attribute's constructor runs **when it is read**, not when the class loads, and each call to `GetCustomAttribute` constructs a new instance. Code that reads attributes in a loop, such as a validator examining every property of every object, should read them once per type and cache the result.

A small attribute-driven validator shows the whole round trip of declaring, finding, and acting:

```csharp
[AttributeUsage(AttributeTargets.Property)]
public sealed class InRangeAttribute(int min, int max) : Attribute
{
    public int Min { get; } = min;
    public int Max { get; } = max;
}

public static class RangeValidator
{
    public static IEnumerable<string> Validate(object obj)
    {
        foreach (var prop in obj.GetType().GetProperties())
        {
            if (prop.GetCustomAttribute<InRangeAttribute>() is { } range &&
                prop.GetValue(obj) is int value &&
                (value < range.Min || value > range.Max))
            {
                yield return $"{prop.Name} must be between {range.Min} and {range.Max}";
            }
        }
    }
}

public class Order
{
    [InRange(1, 1000)]
    public int Quantity { get; set; }
}
```

## What Reflection Costs

Every reflective call repeats work that a direct call settles once at compile time. It finds the member by name, checks accessibility, and converts arguments to and from `object`, which boxes value types. A `PropertyInfo.GetValue` call is many times slower than reading the property directly. That rarely matters for code that runs once at startup. It matters a great deal in serialization, mapping, or validation that runs per object.

The costs are addressed in increasing order of effort:

1. **Cache the lookups.** Resolve each `PropertyInfo` or `MethodInfo` once per type, keeping them in a static dictionary keyed by type. Searching by name is often the larger part of the cost.
2. **Turn members into delegates.** When the types are known, `CreateDelegate` produces a delegate that calls the member directly, with no boxing and no per-call checks:

   ```csharp
   var getName = typeof(Person).GetProperty("Name")!.GetMethod!
       .CreateDelegate<Func<Person, string>>();
   string n = getName(person);   // a plain delegate call, with no lookup or boxing
   ```

   When the types are only known as `object`, .NET 8's `MethodInvoker` and `ConstructorInvoker` precompute the invocation for repeated calls. Compiling an expression tree to a delegate is the older technique for the same job.
3. **Move the work to compile time.** A source generator reads the same attributes during the build and emits ordinary code, so nothing reflective runs at all. `System.Text.Json`'s `[JsonSerializable]` context, `[GeneratedRegex]`, and `[LoggerMessage]` all follow this pattern.

## Reflection, Trimming, and Native AOT

Trimming removes code the build can prove is unused, and Native AOT compiles an application ahead of time and trims it as part of that. Both decide what's used by following references in the code. Reflection defeats that analysis: `Type.GetType("MyApp.Plugin")` or `GetProperties()` on an arbitrary type refers to members only by name or at run time, so the trimmer may remove exactly the members the reflection code needs, and the failure appears only in the published app.

The build reports these risks as trim-analysis warnings, starting with `IL2`, and they shouldn't be suppressed without understanding them. Code can state its reflection needs so the trimmer keeps what's required:

```csharp
public static object Create(
    [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicParameterlessConstructor)] Type type)
    => Activator.CreateInstance(type)!;
```

Calling a method through reflection still works under Native AOT, but generating code at run time doesn't, and expression trees compiled with `Compile()` fall back to a slower interpreter. For applications that will be trimmed or AOT-compiled, the source-generated alternatives above are usually the only practical path for serialization and similar per-object work.

## Key Takeaways

**An attribute does nothing until something reads it.** Know which consumer reads each attribute you apply, whether that is the compiler, a framework at run time, or a source generator at build time.

**Attribute arguments are compile-time constants,** and each read constructs a new attribute instance, so cache what you read.

**`BindingFlags` needs both a visibility and an instance-or-static flag,** and `GetMethod` by name throws when the name is overloaded.

**Reflection is slow per call and cheap once cached.** Resolve members once, convert them to delegates where the types are known, and prefer source generators for per-object work.

**Trimming and Native AOT can't see reflection.** Annotate reflective code with `[DynamicallyAccessedMembers]`, treat `IL2xxx` warnings as real, and use source-generated alternatives where they exist.
