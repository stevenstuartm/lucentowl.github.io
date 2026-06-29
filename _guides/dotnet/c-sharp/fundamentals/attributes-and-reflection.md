---
title: "C# Attributes and Reflection"
layout: guide
category: ".NET & C#"
subcategory: "Language Fundamentals"
description: "Attributes for metadata, reflection for runtime type inspection, and practical patterns for metaprogramming."
tags: [c-sharp, dotnet, fundamentals, attributes, reflection, metadata, advanced]
---

## Attributes Overview

Attributes add declarative metadata to code elements. They're used by compilers, frameworks, and runtime code to modify behavior.

```csharp
// Built-in attributes
[Obsolete("Use NewMethod instead", error: true)]
public void OldMethod() { }

[Serializable]
public class DataTransfer { }

[DebuggerDisplay("Name = {Name}, Age = {Age}")]
public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
}
```

## Common Built-in Attributes

### Compiler Attributes

```csharp
// Obsolete - deprecation warning or error
[Obsolete]  // Warning
[Obsolete("Use NewMethod")]  // Warning with message
[Obsolete("Use NewMethod", true)]  // Compile error

// Conditional - method only called in certain build configs
[Conditional("DEBUG")]
public void DebugLog(string message) => Console.WriteLine(message);

// CallerInfo - get info about caller
public void Log(
    string message,
    [CallerMemberName] string member = "",
    [CallerFilePath] string file = "",
    [CallerLineNumber] int line = 0)
{
    Console.WriteLine($"[{member}:{line}] {message}");
}

// Usage
Log("Something happened");
// Output: [MethodName:42] Something happened

// CallerArgumentExpression (C# 10)
public void Assert(
    bool condition,
    [CallerArgumentExpression(nameof(condition))] string? expression = null)
{
    if (!condition)
        throw new InvalidOperationException($"Assertion failed: {expression}");
}

// Usage
Assert(x > 0);  // Throws: "Assertion failed: x > 0"
```

### Serialization Attributes

```csharp
using System.Text.Json.Serialization;

public class Product
{
    [JsonPropertyName("product_id")]
    public int Id { get; set; }

    [JsonIgnore]
    public string InternalCode { get; set; }

    [JsonInclude]
    private string _secret;  // Include private member

    [JsonConverter(typeof(DateTimeConverter))]
    public DateTime Created { get; set; }
}

// XML Serialization
using System.Xml.Serialization;

[XmlRoot("Order")]
public class OrderDto
{
    [XmlElement("OrderNumber")]
    public string Id { get; set; }

    [XmlAttribute("version")]
    public int Version { get; set; }

    [XmlArray("Items")]
    [XmlArrayItem("Item")]
    public List<ItemDto> Items { get; set; }

    [XmlIgnore]
    public string Computed { get; set; }
}
```

### Validation Attributes

```csharp
using System.ComponentModel.DataAnnotations;

public class UserInput
{
    [Required(ErrorMessage = "Name is required")]
    [StringLength(100, MinimumLength = 2)]
    public string Name { get; set; }

    [EmailAddress]
    public string Email { get; set; }

    [Range(1, 120)]
    public int Age { get; set; }

    [RegularExpression(@"^\d{5}(-\d{4})?$")]
    public string ZipCode { get; set; }

    [Compare(nameof(Password))]
    public string ConfirmPassword { get; set; }

    [Required]
    [MinLength(8)]
    public string Password { get; set; }
}

// Validate
var context = new ValidationContext(userInput);
var results = new List<ValidationResult>();
bool isValid = Validator.TryValidateObject(userInput, context, results, validateAllProperties: true);

foreach (var result in results)
{
    Console.WriteLine($"{string.Join(", ", result.MemberNames)}: {result.ErrorMessage}");
}
```

## Creating Custom Attributes

### Basic Custom Attribute

```csharp
// Attribute class - must inherit from Attribute
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public class CacheAttribute : Attribute
{
    public int DurationSeconds { get; }
    public string? CacheKey { get; set; }

    public CacheAttribute(int durationSeconds)
    {
        DurationSeconds = durationSeconds;
    }
}

// Usage
public class ProductService
{
    [Cache(300, CacheKey = "products")]
    public List<Product> GetProducts() { }

    [Cache(60)]
    public Product GetProduct(int id) { }
}
```

### AttributeUsage Options

```csharp
[AttributeUsage(
    // What can be decorated
    AttributeTargets.Class | AttributeTargets.Method,
    // Can apply multiple times
    AllowMultiple = true,
    // Inherited by derived classes
    Inherited = true)]
public class AuditAttribute : Attribute
{
    public string Action { get; }
    public AuditAttribute(string action) => Action = action;
}

// Usage
[Audit("Create")]
[Audit("Modify")]  // AllowMultiple = true
public class Order { }
```

### Generic Attributes (C# 11)

Generic attributes allow type parameters directly on attribute definitions, eliminating the need for `typeof()` expressions.

```csharp
// Before C# 11 - requires typeof()
public class TypeAttribute : Attribute
{
    public Type TargetType { get; }
    public TypeAttribute(Type type) => TargetType = type;
}

[Type(typeof(string))]
public class OldStyle { }

// C# 11 - generic attribute
public class TypeAttribute<T> : Attribute { }

[Type<string>]
public class NewStyle { }

// Practical examples
public class ValidatorAttribute<TValidator> : Attribute
    where TValidator : IValidator, new() { }

[Validator<EmailValidator>]
public string Email { get; set; }

public class ConverterAttribute<TConverter> : Attribute
    where TConverter : IValueConverter { }

[Converter<DateTimeConverter>]
public DateTime Created { get; set; }
```

Generic attributes provide better type safety and cleaner syntax when the attribute needs to reference a type.

### Attribute Targets

```csharp
// All targets
AttributeTargets.All

// Specific targets
AttributeTargets.Assembly
AttributeTargets.Module
AttributeTargets.Class
AttributeTargets.Struct
AttributeTargets.Enum
AttributeTargets.Constructor
AttributeTargets.Method
AttributeTargets.Property
AttributeTargets.Field
AttributeTargets.Event
AttributeTargets.Interface
AttributeTargets.Parameter
AttributeTargets.Delegate
AttributeTargets.ReturnValue
AttributeTargets.GenericParameter

// Assembly-level attributes (in AssemblyInfo.cs or any file)
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: InternalsVisibleTo("MyProject.Tests")]

// Return value attribute
[return: MaybeNull]
public string? FindName(int id) { }

// Parameter attribute
public void Process([NotNull] string input) { }
```

## Reflection Basics

Reflection enables inspecting and manipulating types at runtime.

### Getting Type Information

```csharp
// From instance
object obj = new Person();
Type type1 = obj.GetType();

// From type directly
Type type2 = typeof(Person);

// From string (fully qualified name)
Type? type3 = Type.GetType("MyNamespace.Person, MyAssembly");

// Type information
Console.WriteLine(type1.Name);           // "Person"
Console.WriteLine(type1.FullName);       // "MyNamespace.Person"
Console.WriteLine(type1.Namespace);      // "MyNamespace"
Console.WriteLine(type1.Assembly.FullName);
Console.WriteLine(type1.BaseType?.Name); // Base class
Console.WriteLine(type1.IsClass);        // true
Console.WriteLine(type1.IsValueType);    // false
Console.WriteLine(type1.IsInterface);    // false
Console.WriteLine(type1.IsAbstract);     // false
Console.WriteLine(type1.IsSealed);       // false
Console.WriteLine(type1.IsGenericType);  // false
```

### Inspecting Members

```csharp
Type type = typeof(Person);

// Get all public members
MemberInfo[] members = type.GetMembers();

// Get specific member types
PropertyInfo[] properties = type.GetProperties();
MethodInfo[] methods = type.GetMethods();
FieldInfo[] fields = type.GetFields();
ConstructorInfo[] constructors = type.GetConstructors();
EventInfo[] events = type.GetEvents();

// Include non-public members
BindingFlags flags = BindingFlags.Public | BindingFlags.NonPublic |
                     BindingFlags.Instance | BindingFlags.Static;
PropertyInfo[] allProperties = type.GetProperties(flags);

// Get specific member by name
PropertyInfo? nameProp = type.GetProperty("Name");
MethodInfo? method = type.GetMethod("ToString");

// Check if method exists with specific signature
MethodInfo? specific = type.GetMethod("Process",
    new[] { typeof(string), typeof(int) });
```

### Working with Properties

```csharp
Type type = typeof(Person);
PropertyInfo? prop = type.GetProperty("Name");

if (prop != null)
{
    // Property info
    Console.WriteLine(prop.PropertyType);  // String
    Console.WriteLine(prop.CanRead);       // true
    Console.WriteLine(prop.CanWrite);      // true

    // Get value
    var person = new Person { Name = "Alice" };
    object? value = prop.GetValue(person);

    // Set value
    prop.SetValue(person, "Bob");
}

// Get all property values
foreach (var property in type.GetProperties())
{
    Console.WriteLine($"{property.Name}: {property.GetValue(person)}");
}
```

### Working with Methods

```csharp
Type type = typeof(Calculator);
MethodInfo? method = type.GetMethod("Add");

if (method != null)
{
    // Method info
    Console.WriteLine(method.ReturnType);  // Int32
    ParameterInfo[] parameters = method.GetParameters();
    foreach (var param in parameters)
    {
        Console.WriteLine($"{param.Name}: {param.ParameterType}");
    }

    // Invoke method
    var calc = new Calculator();
    object? result = method.Invoke(calc, new object[] { 5, 3 });
    Console.WriteLine(result);  // 8

    // Static method
    MethodInfo? staticMethod = type.GetMethod("StaticAdd");
    object? staticResult = staticMethod?.Invoke(null, new object[] { 5, 3 });
}
```

### Creating Instances

```csharp
// Using Activator
object? instance1 = Activator.CreateInstance(typeof(Person));
object? instance2 = Activator.CreateInstance(typeof(Person),
    new object[] { "Alice", 30 });  // Constructor args

// Generic version
Person? person = Activator.CreateInstance<Person>();

// From type name string
Type? type = Type.GetType("MyNamespace.Person, MyAssembly");
object? instance3 = type != null ? Activator.CreateInstance(type) : null;

// Using ConstructorInfo
ConstructorInfo? ctor = typeof(Person).GetConstructor(
    new[] { typeof(string), typeof(int) });
object? instance4 = ctor?.Invoke(new object[] { "Bob", 25 });
```

## Reading Attributes via Reflection

### Getting Attributes

```csharp
// Check if attribute exists
bool hasCache = method.IsDefined(typeof(CacheAttribute), inherit: false);

// Get single attribute
CacheAttribute? cache = method.GetCustomAttribute<CacheAttribute>();
if (cache != null)
{
    Console.WriteLine($"Cache duration: {cache.DurationSeconds}");
}

// Get all attributes of a type
IEnumerable<CacheAttribute> caches = method.GetCustomAttributes<CacheAttribute>();

// Get all attributes
object[] allAttributes = method.GetCustomAttributes(inherit: true);

// From property
var property = typeof(UserInput).GetProperty("Name");
var required = property?.GetCustomAttribute<RequiredAttribute>();
```

### Practical Example: Attribute-Based Validation

```csharp
[AttributeUsage(AttributeTargets.Property)]
public class ValidateRangeAttribute : Attribute
{
    public int Min { get; }
    public int Max { get; }
    public string? ErrorMessage { get; set; }

    public ValidateRangeAttribute(int min, int max)
    {
        Min = min;
        Max = max;
    }
}

public class Validator
{
    public static List<string> Validate(object obj)
    {
        var errors = new List<string>();
        var type = obj.GetType();

        foreach (var prop in type.GetProperties())
        {
            var rangeAttr = prop.GetCustomAttribute<ValidateRangeAttribute>();
            if (rangeAttr != null && prop.PropertyType == typeof(int))
            {
                int value = (int)prop.GetValue(obj)!;
                if (value < rangeAttr.Min || value > rangeAttr.Max)
                {
                    errors.Add(rangeAttr.ErrorMessage ??
                        $"{prop.Name} must be between {rangeAttr.Min} and {rangeAttr.Max}");
                }
            }
        }

        return errors;
    }
}

// Usage
public class Order
{
    [ValidateRange(1, 1000, ErrorMessage = "Quantity must be 1-1000")]
    public int Quantity { get; set; }
}

var errors = Validator.Validate(new Order { Quantity = 5000 });
```

## Generic Types and Reflection

```csharp
// Check if type is generic
Type listType = typeof(List<int>);
Console.WriteLine(listType.IsGenericType);        // true
Console.WriteLine(listType.IsConstructedGenericType);  // true (has type argument)

// Get generic type definition
Type openList = listType.GetGenericTypeDefinition();  // List<>

// Get type arguments
Type[] typeArgs = listType.GetGenericArguments();  // [Int32]

// Create closed generic type
Type closedType = typeof(List<>).MakeGenericType(typeof(string));
object? list = Activator.CreateInstance(closedType);

// Work with generic methods
public static T? Create<T>() where T : new() => new T();

MethodInfo createMethod = typeof(Factory).GetMethod("Create")!;
MethodInfo closedMethod = createMethod.MakeGenericMethod(typeof(Person));
object? result = closedMethod.Invoke(null, null);
```

## Assembly Reflection

```csharp
// Current assembly
Assembly current = Assembly.GetExecutingAssembly();

// Assembly from type
Assembly typeAssembly = typeof(Person).Assembly;

// Load assembly
Assembly loaded = Assembly.Load("MyAssembly");
Assembly fromFile = Assembly.LoadFrom(@"C:\path\to\assembly.dll");

// Get all types
Type[] types = current.GetTypes();

// Find types with attribute
var controllers = current.GetTypes()
    .Where(t => t.GetCustomAttribute<ControllerAttribute>() != null);

// Find types implementing interface
var services = current.GetTypes()
    .Where(t => typeof(IService).IsAssignableFrom(t) && !t.IsInterface);

// Assembly metadata
Console.WriteLine(current.FullName);
Console.WriteLine(current.Location);
AssemblyName name = current.GetName();
Console.WriteLine(name.Version);
```

<div class="callout callout--warning">
<p class="callout__title">Performance Considerations</p>
<p>Reflection is slow compared to direct calls. Cache reflection results when used repeatedly to avoid repeated lookups.</p>
</div>

## Performance Considerations

Reflection is slow compared to direct calls. Cache reflection results when used repeatedly.

```csharp
// Slow - reflects every call
public object SlowGetValue(object obj, string propertyName)
{
    return obj.GetType().GetProperty(propertyName)?.GetValue(obj);
}

// Better - cache PropertyInfo
private static readonly ConcurrentDictionary<(Type, string), PropertyInfo?> _propertyCache = new();

public object? FastGetValue(object obj, string propertyName)
{
    var type = obj.GetType();
    var prop = _propertyCache.GetOrAdd((type, propertyName),
        key => key.Item1.GetProperty(key.Item2));
    return prop?.GetValue(obj);
}

// Best for hot paths - compiled delegate
private static readonly ConcurrentDictionary<(Type, string), Func<object, object?>> _getterCache = new();

public object? FastestGetValue(object obj, string propertyName)
{
    var type = obj.GetType();
    var getter = _getterCache.GetOrAdd((type, propertyName), key =>
    {
        var prop = key.Item1.GetProperty(key.Item2);
        if (prop == null) return _ => null;

        var param = Expression.Parameter(typeof(object));
        var body = Expression.Convert(
            Expression.Property(
                Expression.Convert(param, key.Item1),
                prop),
            typeof(object));
        return Expression.Lambda<Func<object, object?>>(body, param).Compile();
    });
    return getter(obj);
}
```

### Source Generators (Compile-Time Alternative)

For hot paths, consider source generators (C# 9+) which generate code at compile time.

```csharp
// Instead of runtime reflection for serialization,
// System.Text.Json uses source generation
[JsonSerializable(typeof(Person))]
public partial class PersonJsonContext : JsonSerializerContext { }

// Use the generated serializer
string json = JsonSerializer.Serialize(person, PersonJsonContext.Default.Person);
```

## Practical Patterns

### Plugin Discovery

```csharp
public interface IPlugin
{
    string Name { get; }
    void Execute();
}

public class PluginLoader
{
    public IEnumerable<IPlugin> LoadPlugins(string directory)
    {
        foreach (var dll in Directory.GetFiles(directory, "*.dll"))
        {
            Assembly assembly;
            try
            {
                assembly = Assembly.LoadFrom(dll);
            }
            catch
            {
                continue;
            }

            foreach (var type in assembly.GetTypes())
            {
                if (typeof(IPlugin).IsAssignableFrom(type) &&
                    !type.IsInterface &&
                    !type.IsAbstract)
                {
                    if (Activator.CreateInstance(type) is IPlugin plugin)
                    {
                        yield return plugin;
                    }
                }
            }
        }
    }
}
```

### Automatic Mapping

```csharp
public static class SimpleMapper
{
    public static TDest Map<TSource, TDest>(TSource source)
        where TDest : new()
    {
        var dest = new TDest();
        var sourceProps = typeof(TSource).GetProperties();
        var destProps = typeof(TDest).GetProperties()
            .ToDictionary(p => p.Name);

        foreach (var sourceProp in sourceProps)
        {
            if (destProps.TryGetValue(sourceProp.Name, out var destProp) &&
                destProp.CanWrite &&
                destProp.PropertyType.IsAssignableFrom(sourceProp.PropertyType))
            {
                destProp.SetValue(dest, sourceProp.GetValue(source));
            }
        }

        return dest;
    }
}

// Usage
var dto = SimpleMapper.Map<Person, PersonDto>(person);
```

## Key Takeaways

**Attributes for metadata**: Use attributes to add declarative information that tools and frameworks can read.

**Reflection for runtime inspection**: Use reflection when you need to examine or manipulate types dynamically.

**Cache reflection results**: PropertyInfo, MethodInfo, etc. should be cached when used repeatedly.

**Prefer source generators**: For performance-critical code, source generators provide compile-time reflection without runtime cost.

**Use built-in attributes**: .NET provides many attributes for validation, serialization, debugging, and compiler hints.

**AttributeUsage controls application**: Specify where your custom attributes can be applied and whether they're inheritable.
