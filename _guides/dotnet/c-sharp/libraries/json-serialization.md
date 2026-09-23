---
title: "C# JSON Serialization"
layout: guide
category: ".NET & C#"
subcategory: "Core Libraries"
description: "System.Text.Json in practice: what the serializer reads and writes by default, options and the web defaults, stricter deserialization, attributes, JsonDocument and JsonNode, custom converters, safe polymorphism with $type, reference cycles, and source generation for trimming and Native AOT."
tags: [system-text-json, json, serialization, jsonserializercontext, polymorphism, source-generators, practical]
---

## Serializing and Deserializing

`System.Text.Json` is the JSON library built into .NET, and the one ASP.NET Core, `HttpClient`'s JSON extension methods, and the configuration system use. `JsonSerializer` converts between objects and UTF-8 JSON:

```csharp
using System.Text.Json;

var person = new Person { Name = "Alice", Age = 30 };

string json = JsonSerializer.Serialize(person);
// {"Name":"Alice","Age":30}

Person? restored = JsonSerializer.Deserialize<Person>(json);
```

By default the serializer writes every public property that has a public getter, and reads into every public property with a setter. It can also construct objects through a constructor, so records and types with `init`-only or get-only properties deserialize without extra work:

```csharp
public record Order(int Id, string Customer, decimal Total);

Order? order = JsonSerializer.Deserialize<Order>("""{"Id":7,"Customer":"Alice","Total":19.99}""");
```

JSON names are matched to constructor parameters under the same rules as properties, so with default options `{"id":7}` doesn't bind to `Id`. A parameter left unmatched receives its type's default value.

### Defaults That Surprise

Most of the defaults favour speed and strictness in some places and leniency in others:

| Situation | Default behavior |
|---|---|
| JSON property name differs in case (`name` vs `Name`) | **Not matched.** Reading is case-sensitive, and the property keeps its default value |
| JSON has a property the type doesn't | Ignored |
| Type has a property the JSON doesn't | Left at its default value |
| Public fields | Ignored, in both directions |
| Enums | Written and read as numbers |
| A number in quotes (`"5"` for an `int`) | `JsonException` |
| Comments and trailing commas | `JsonException` |
| `null` for a non-nullable reference property | Accepted. Nullable annotations are ignored |
| An object graph with a cycle | `JsonException` |
| Non-ASCII characters and `<`, `>`, `&`, `'` | Escaped as `\uXXXX` |

The first row catches almost everyone who moves from Newtonsoft.Json, which matches case-insensitively. A JavaScript client sends `{"name":"Alice"}`, and `Name` comes out empty with no error.

## Configuring JsonSerializerOptions

```csharp
var options = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
    NumberHandling = JsonNumberHandling.AllowReadingFromString,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = true
};

string json = JsonSerializer.Serialize(person, options);
```

**Web defaults.** ASP.NET Core and the `HttpClient` JSON methods use `JsonSerializerDefaults.Web`, which sets camelCase names, case-insensitive matching, and numbers read from strings. `new JsonSerializerOptions(JsonSerializerDefaults.Web)` starts from the same place, and `JsonSerializerOptions.Web` (.NET 9) is a shared read-only instance of it. Code that calls `JsonSerializer` directly without options gets the stricter general defaults, so the same type can round-trip through a web endpoint and fail when read from a file.

**Reuse one instance.** The first time an options instance meets a type, it builds and caches that type's serialization metadata, which is the slow part. A new `JsonSerializerOptions` per call throws that cache away every time. Keep instances in static fields or in DI. Once an instance has been used it becomes read-only, and changing a property afterward throws `InvalidOperationException`.

**Escaping.** The default encoder escapes everything outside Basic Latin, plus the HTML-sensitive characters, so `café <b>` becomes `café <b>`. The output is valid JSON either way. To keep readable non-ASCII text while still escaping HTML characters, use `Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)`. `JavaScriptEncoder.UnsafeRelaxedJsonEscaping` also stops escaping `<` and `>`, which is only safe when the JSON will never be embedded in an HTML page.

### Stricter Deserialization

Several options turn the lenient defaults into errors:

| Option | Rejects | Since |
|---|---|---|
| `UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow` | JSON properties that match no member | .NET 8 |
| `RespectNullableAnnotations = true` | `null` for a non-nullable reference property | .NET 9 |
| `RespectRequiredConstructorParameters = true` | A missing JSON property for a non-optional constructor parameter | .NET 9 |

Separately, a property declared with the C# `required` modifier (.NET 7) must be present in the JSON, and deserialization throws `JsonException` when it's missing. Strictness is worth it at trust boundaries, such as data from another team's service or from a file an operator edits, where an ignored misspelling otherwise becomes a silent default.

## Shaping the JSON with Attributes

Attributes on a type override the options for that type or member:

```csharp
public class Product
{
    [JsonPropertyName("product_id")]
    public int Id { get; set; }

    public string Name { get; set; } = "";

    [JsonIgnore]
    public string InternalCode { get; set; } = "";

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; set; }

    [JsonNumberHandling(JsonNumberHandling.WriteAsString)]
    public decimal Price { get; set; }

    [JsonPropertyOrder(-1)]   // Default order is 0, so this is written first
    public string Sku { get; set; } = "";

    [JsonInclude]             // Serializes a member the serializer would otherwise skip
    private int _version;

    public ProductStatus Status { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter<ProductStatus>))]
public enum ProductStatus
{
    Active,
    [JsonStringEnumMemberName("discontinued")] Discontinued
}
```

`JsonStringEnumConverter<T>` (.NET 8) writes enum names instead of numbers. Unlike the older non-generic `JsonStringEnumConverter`, it works under Native AOT. `[JsonStringEnumMemberName]` (.NET 9) renames an individual value. To write every enum as a string, add `new JsonStringEnumConverter()` to `options.Converters`, or set `UseStringEnumConverter` on a source-generated context.

## Reading JSON Without a Matching Type

Deserializing to a class works when the JSON has a known shape. For extracting a few values from a large document, or editing JSON whose shape varies, the library has two document models.

### JsonDocument for Reading

`JsonDocument` parses into a read-only structure backed by pooled buffers, without creating an object per value:

```csharp
using JsonDocument doc = JsonDocument.Parse(json);
JsonElement root = doc.RootElement;

string name = root.GetProperty("name").GetString()!;

if (root.TryGetProperty("email", out JsonElement email))
    Console.WriteLine(email.GetString());

foreach (JsonElement item in root.GetProperty("items").EnumerateArray())
    Console.WriteLine(item.GetProperty("id").GetInt32());
```

The document owns the memory every `JsonElement` points into. Dispose it, or those pooled buffers are never returned. And don't let an element outlive the document, because reading an element after its document is disposed throws `ObjectDisposedException`. `element.Clone()` copies an element into memory the document doesn't own, which is what a method returning a `JsonElement` needs.

### JsonNode for Editing

`JsonNode` builds a mutable tree of ordinary objects, which costs more memory and lets you change it:

```csharp
using System.Text.Json.Nodes;

JsonNode node = JsonNode.Parse(json)!;
node["name"] = "Bob";
node["tags"]!.AsArray().Add("reviewed");

var created = new JsonObject
{
    ["name"] = "Alice",
    ["age"] = 30,
    ["tags"] = new JsonArray("developer", "reader")
};

string result = created.ToJsonString();
```

| Need | Use |
|---|---|
| The JSON has a known, stable shape | `JsonSerializer.Deserialize<T>` |
| Read a few values from a large or variable document | `JsonDocument` |
| Modify JSON, or build it without a class | `JsonNode` |
| Process a document too large to hold in memory | `Utf8JsonReader`, which reads tokens forward-only |

## Custom Converters

A converter takes over reading and writing for one type. Many types that needed one in older versions no longer do. `DateOnly`, `TimeOnly`, `Half`, `Int128`, and records are all handled natively now. A custom converter still makes sense when the wire format differs from anything the serializer produces, such as a timestamp sent as Unix seconds:

```csharp
public class UnixSecondsConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.Number)
            throw new JsonException($"Expected a number of seconds, got {reader.TokenType}");

        return DateTimeOffset.FromUnixTimeSeconds(reader.GetInt64());
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteNumberValue(value.ToUnixTimeSeconds());
}

public class Event
{
    [JsonConverter(typeof(UnixSecondsConverter))]
    public DateTimeOffset OccurredAt { get; set; }
}
```

`Read` receives the reader positioned on the value's first token and must consume exactly that value. Check the token type and throw `JsonException` for anything unexpected, so a bad payload surfaces as a deserialization error with a path rather than an `InvalidOperationException` from deep inside the reader. A converter registered in `options.Converters` applies to every property of that type. The attribute applies to one property.

## Polymorphism

Serializing through a base type writes only the base type's properties by default. Since .NET 7, `[JsonDerivedType]` declares the derived types allowed and a discriminator for each:

```csharp
[JsonDerivedType(typeof(CardPayment), "card")]
[JsonDerivedType(typeof(BankTransfer), "bank")]
public abstract class Payment
{
    public decimal Amount { get; set; }
}

public class CardPayment : Payment { public string Last4 { get; set; } = ""; }
public class BankTransfer : Payment { public string Iban { get; set; } = ""; }

string json = JsonSerializer.Serialize<Payment>(new CardPayment { Amount = 10, Last4 = "4242" });
// {"$type":"card","Last4":"4242","Amount":10}

Payment? payment = JsonSerializer.Deserialize<Payment>(json);   // A CardPayment
```

Four behaviors decide whether this works in practice:

- **The declared type matters.** `Serialize(new CardPayment(...))` infers `T` as `CardPayment`, which has no derived-type attributes, so no `$type` is written. Serialize through the base type, as above.
- **`$type` must come first when reading.** A payload with `$type` after other properties throws `JsonException`, which bites when another system builds the JSON. `AllowOutOfOrderMetadataProperties = true` (.NET 9) accepts it anywhere, at some cost in buffering.
- **A missing `$type` produces the base type.** For an abstract base type, deserialization throws `NotSupportedException` instead.
- **Unlisted derived types are rejected.** Serializing a derived type with no `[JsonDerivedType]` throws `NotSupportedException`.

The last rule is a security property. The discriminator selects only from types the base type lists. Newtonsoft.Json's `TypeNameHandling` reads an assembly-qualified type name from the payload, which has let attackers make a deserializer instantiate types that run code, and `System.Text.Json` has no equivalent.

## Object Graphs and Cycles

The serializer walks references and writes each object in full wherever it appears. An object that references itself, directly or through a chain, throws `JsonException` for a possible cycle. Entity graphs with navigation properties in both directions, like an `Order` whose `Customer` lists its `Orders`, hit this immediately.

`ReferenceHandler.IgnoreCycles` writes `null` where a cycle would repeat. `ReferenceHandler.Preserve` writes `$id` and `$ref` metadata so the graph round-trips, in a format only a reader that understands that metadata can consume. Serializing a DTO shaped for the response usually beats both, since the entity graph rarely matches what a client should see.

## Source Generation and Native AOT

By default the serializer inspects types with reflection the first time it meets them, and generates code at run time to read and write their members. A source-generated **context** does that work at compile time:

```csharp
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Order))]
[JsonSerializable(typeof(List<Order>))]
internal partial class AppJsonContext : JsonSerializerContext { }

string json = JsonSerializer.Serialize(order, AppJsonContext.Default.Order);
Order? copy = JsonSerializer.Deserialize(json, AppJsonContext.Default.Order);

Order? fetched = await httpClient.GetFromJsonAsync(url, AppJsonContext.Default.Order);
```

Each `[JsonSerializable]` type gets a property on the context holding its `JsonTypeInfo<T>`, and types reachable from it through properties are included automatically. A property declared as `object` is the exception, because the generator can't know what it will hold at run time, so list those runtime types explicitly.

The generator can produce two kinds of code. **Metadata** mode describes each type so the serializer needs no reflection. **Serialization** mode, or fast path, also generates code that writes the type directly to a `Utf8JsonWriter`. Both are generated by default, and the fast path is used for synchronous serialization when the options allow it.

### Why Trimmed and AOT Apps Need It

Native AOT compiles the whole application ahead of time and can't generate code at run time, and trimming removes members that static analysis doesn't see used. Reflection itself still works under both, but the serializer's reflection path depends on metadata that trimming may have removed and on run-time code generation that AOT can't do. So a trimmed or AOT app can serialize a type correctly in development and fail after publishing.

To make that failure predictable, reflection-based serialization is off by default whenever `PublishTrimmed` is set, which Native AOT implies. A `JsonSerializer` call without a `JsonTypeInfo`, a context, or options whose `TypeInfoResolver` is a context then throws `InvalidOperationException` telling you which type needs one. Setting `<JsonSerializerIsReflectionEnabledByDefault>false</JsonSerializerIsReflectionEnabledByDefault>` in a normal build surfaces those calls while you're still debugging under the regular runtime.

Frameworks that serialize on your behalf take the context through their options:

```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));
```

Resolvers in the chain are asked in order, so a context inserted first handles its types, and later resolvers handle the rest.

Outside trimmed and AOT apps, source generation mostly helps startup. It removes the first-use cost of building metadata for each type, which matters for serverless functions and short-lived processes. Steady-state throughput for a warmed-up reflection-based serializer is already fast.

## Streams and Errors

Serializing to and from a `Stream` avoids building the whole JSON as a string first:

```csharp
await using FileStream output = File.Create("orders.json");
await JsonSerializer.SerializeAsync(output, orders, options, cancellationToken);

await using FileStream input = File.OpenRead("orders.json");
List<Order>? loaded = await JsonSerializer.DeserializeAsync<List<Order>>(input, options, cancellationToken);
```

`DeserializeAsync` reads the stream incrementally but returns only once the whole object graph is built, so the result still has to fit in memory. For a large top-level array, `JsonSerializer.DeserializeAsyncEnumerable<T>` yields one element at a time as the stream arrives.

Malformed JSON, a value of the wrong type, or a missing required property throws `JsonException`:

```csharp
try
{
    Order? order = JsonSerializer.Deserialize<Order>(json, options);
}
catch (JsonException ex)
{
    logger.LogWarning(ex, "Invalid order JSON at {Path}, line {Line}", ex.Path, ex.LineNumber + 1);
}
```

`Path` names the property that failed, like `$.Items[3].Quantity`. `LineNumber` and `BytePositionInLine` are zero-based and can be `null`, so add one to the line number before showing it to a person.

## Key Takeaways

**Know the defaults.** Reading is case-sensitive, unknown properties and fields are ignored, and enums are numbers, unless you opt into the web defaults.

**Reuse `JsonSerializerOptions` instances.** Each one caches per-type metadata, and each becomes read-only after first use.

**Turn on strictness at trust boundaries** with `UnmappedMemberHandling`, `RespectNullableAnnotations`, and `required`.

**Dispose `JsonDocument` and don't let its elements escape,** or `Clone` the ones that must.

**Use `[JsonDerivedType]` for polymorphism,** serialize through the base type, and expect `$type` first.

**Use a source-generated context for trimmed and AOT apps,** where reflection-based serialization is off by default, and for startup-sensitive processes.
