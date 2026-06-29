---
title: "C# JSON Serialization"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "JSON serialization with System.Text.Json including configuration, custom converters, and source generation."
tags: [c-sharp, dotnet, json, serialization, web, practical]
---

## System.Text.Json Overview

System.Text.Json is the built-in, high-performance JSON library in .NET. It's the default for ASP.NET Core and recommended for most scenarios.

```csharp
using System.Text.Json;

// Serialize
var person = new Person { Name = "Alice", Age = 30 };
string json = JsonSerializer.Serialize(person);
// {"Name":"Alice","Age":30}

// Deserialize
Person? restored = JsonSerializer.Deserialize<Person>(json);
```

## Serialization Options

```csharp
var options = new JsonSerializerOptions
{
    // Naming
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,  // name, age
    DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,

    // Formatting
    WriteIndented = true,

    // Null handling
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,

    // Property matching
    PropertyNameCaseInsensitive = true,

    // Number handling
    NumberHandling = JsonNumberHandling.AllowReadingFromString,

    // Encoder (allow non-ASCII characters)
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
};

string json = JsonSerializer.Serialize(person, options);
```

### Reuse Options

```csharp
// Options are cached internally - reuse for performance
private static readonly JsonSerializerOptions SharedOptions = new()
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = true
};

public string ToJson<T>(T obj) => JsonSerializer.Serialize(obj, SharedOptions);
```

## Attributes

```csharp
public class Product
{
    [JsonPropertyName("product_id")]
    public int Id { get; set; }

    [JsonIgnore]
    public string InternalCode { get; set; } = "";

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; set; }

    [JsonInclude]
    private string _secretField = "";  // Include private member

    [JsonPropertyOrder(1)]  // Control order
    public string Name { get; set; } = "";

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ProductStatus Status { get; set; }

    [JsonNumberHandling(JsonNumberHandling.WriteAsString)]
    public decimal Price { get; set; }
}

public enum ProductStatus { Active, Discontinued }
```

## Common Scenarios

### Working with Streams

```csharp
// Async serialization to stream
await using var stream = File.Create("data.json");
await JsonSerializer.SerializeAsync(stream, data, options);

// Async deserialization from stream
await using var readStream = File.OpenRead("data.json");
var result = await JsonSerializer.DeserializeAsync<List<Product>>(readStream);

// From HttpClient
var response = await httpClient.GetAsync(url);
var data = await response.Content.ReadFromJsonAsync<Product>();
```

### Choosing How to Work with JSON

<div class="comparison">
<div class="content-card content-card--accent">
<h4>JsonDocument (Read-Only)</h4>
<ul>
<li>Pooled and highly efficient</li>
<li>Extract specific values</li>
<li>No object allocation for full tree</li>
<li>Disposed after use</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>JsonNode (Mutable)</h4>
<ul>
<li>In-memory representation</li>
<li>Modify JSON dynamically</li>
<li>Build JSON programmatically</li>
<li>Stays in memory</li>
</ul>
</div>
</div>

System.Text.Json offers multiple approaches depending on your needs.

| Approach | Use When |
|----------|----------|
| `JsonSerializer.Deserialize<T>` | You have a known type that matches the JSON structure |
| `JsonDocument` | Read-only access, extracting specific values, validation |
| `JsonNode` | Need to modify JSON or build JSON dynamically |
| Source generation | Production code needing performance and AOT support |

**JsonDocument** is a read-only, pooled, and highly efficient way to navigate JSON. Use it when you only need to read values and don't want to allocate objects for the entire structure.

**JsonNode** creates a mutable in-memory representation. Use it when you need to modify JSON (add/remove properties, change values) or build JSON programmatically.

**Typed deserialization** is best when your JSON structure is known and stable. It provides compile-time safety and IntelliSense.

### Dynamic JSON with JsonDocument

```csharp
// Parse without deserializing to specific type
using JsonDocument doc = JsonDocument.Parse(json);
JsonElement root = doc.RootElement;

// Navigate properties
string name = root.GetProperty("name").GetString()!;
int age = root.GetProperty("age").GetInt32();

// Check if property exists
if (root.TryGetProperty("email", out JsonElement email))
{
    Console.WriteLine(email.GetString());
}

// Iterate arrays
foreach (JsonElement item in root.GetProperty("items").EnumerateArray())
{
    Console.WriteLine(item.GetProperty("id").GetInt32());
}

// Iterate object properties
foreach (JsonProperty prop in root.EnumerateObject())
{
    Console.WriteLine($"{prop.Name}: {prop.Value}");
}
```

### JsonNode for Modification

```csharp
using System.Text.Json.Nodes;

// Parse to mutable structure
JsonNode? node = JsonNode.Parse(json);

// Read values
string? name = node?["name"]?.GetValue<string>();

// Modify
node!["name"] = "Bob";
node["newProperty"] = 42;

// Build from scratch
var obj = new JsonObject
{
    ["name"] = "Alice",
    ["age"] = 30,
    ["tags"] = new JsonArray("developer", "reader")
};

string result = obj.ToJsonString();
```

## Custom Converters

```csharp
// Custom DateTime format
public class DateOnlyConverter : JsonConverter<DateOnly>
{
    private const string Format = "yyyy-MM-dd";

    public override DateOnly Read(ref Utf8JsonReader reader, Type typeToConvert,
        JsonSerializerOptions options)
    {
        return DateOnly.ParseExact(reader.GetString()!, Format);
    }

    public override void Write(Utf8JsonWriter writer, DateOnly value,
        JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString(Format));
    }
}

// Register converter
var options = new JsonSerializerOptions
{
    Converters = { new DateOnlyConverter() }
};

// Or use attribute
public class Event
{
    [JsonConverter(typeof(DateOnlyConverter))]
    public DateOnly Date { get; set; }
}
```

### Polymorphic Serialization

```csharp
[JsonDerivedType(typeof(Student), "student")]
[JsonDerivedType(typeof(Teacher), "teacher")]
public class Person
{
    public string Name { get; set; } = "";
}

public class Student : Person
{
    public string Major { get; set; } = "";
}

public class Teacher : Person
{
    public string Subject { get; set; } = "";
}

// Serializes with $type discriminator
// {"$type":"student","Name":"Alice","Major":"CS"}
```

## Source Generation

<div class="callout callout--tip">
<p class="callout__title">Source Generation for Production</p>
<p>Eliminates reflection overhead, enables AOT compilation, and makes trimming work correctly. Use it for production applications where startup time and deployment size matter.</p>
</div>

Compile-time generated serialization for better performance and AOT support.

```csharp
[JsonSerializable(typeof(Person))]
[JsonSerializable(typeof(List<Person>))]
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    WriteIndented = true)]
public partial class AppJsonContext : JsonSerializerContext { }

// Usage - no reflection at runtime
string json = JsonSerializer.Serialize(person, AppJsonContext.Default.Person);
Person? p = JsonSerializer.Deserialize(json, AppJsonContext.Default.Person);

// With HttpClient
var response = await httpClient.GetFromJsonAsync(url,
    AppJsonContext.Default.Person);
```

## Error Handling

```csharp
try
{
    var result = JsonSerializer.Deserialize<Product>(json);
}
catch (JsonException ex)
{
    Console.WriteLine($"JSON error at {ex.Path}: {ex.Message}");
    Console.WriteLine($"Line: {ex.LineNumber}, Position: {ex.BytePositionInLine}");
}
```

## Key Takeaways

**Use source generation for production**: Eliminates reflection overhead and enables AOT compilation.

**Reuse JsonSerializerOptions**: Create once and reuse to benefit from internal caching.

**JsonDocument for read-only access**: Efficient for extracting values without full deserialization.

**JsonNode for modifications**: When you need to read, modify, and write JSON dynamically.

**Configure naming policy**: CamelCase is standard for web APIs.
