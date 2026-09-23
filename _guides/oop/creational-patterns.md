---
title: "Creational Patterns"
layout: guide
category: Programming Patterns
subcategory: GoF Patterns
description: "What a design pattern is and how the Gang of Four classified their 23, then the five creational patterns: Factory Method and how it differs from a static factory method, Abstract Factory, Builder, Prototype and the deep-versus-shallow copy problem, and Singleton and why a DI container's singleton lifetime usually replaces it. Each with a C# example, its .NET counterparts, and when not to use it."
tags: [design-patterns, factory-method, abstract-factory, builder, prototype, singleton, practical]
---

## What a Design Pattern Is

A design pattern is a named, reusable solution to a problem that keeps recurring in object-oriented design. It isn't a library or a piece of code to copy. It's a description of which objects take part, what each one is responsible for, and how they collaborate, which you then implement in whatever shape your code needs.

The idea came from architecture. Christopher Alexander's *A Pattern Language* (1977) catalogued recurring solutions in building and town design. Erich Gamma, Richard Helm, Ralph Johnson, and John Vlissides, the "Gang of Four" (GoF), applied it to software in *Design Patterns: Elements of Reusable Object-Oriented Software* (1994). They described each pattern with four essential elements:

| Element | What it gives you |
|---|---|
| **Name** | A shared word for the design, so "wrap it in a decorator" says a paragraph's worth |
| **Problem** | When the pattern applies, including the conditions that must hold first |
| **Solution** | The participating classes and objects, their responsibilities, and how they collaborate |
| **Consequences** | What the pattern costs and what it buys, so you can judge whether it's worth it here |

The book catalogues 23 patterns and sorts them by purpose into three families. **Creational** patterns deal with how objects get created, **structural** patterns with how classes and objects are composed into larger structures, and **behavioral** patterns with how objects divide responsibility and communicate. It also sorts them by scope. Class patterns fix their relationships at compile time through inheritance, and object patterns set them up at runtime through composition. Most of the 23 are object patterns.

Many of the patterns predate the book. Its contribution was to name them and write down their trade-offs, and several are now built into languages and frameworks so thoroughly that using them no longer feels like applying a pattern.

---

## Why Creation Needs Patterns

Writing `new SqlConnection()` hard-codes the exact class into the caller. That's fine until the caller shouldn't know or decide which class it gets: the choice depends on configuration or platform, related objects have to match, construction takes many steps, or there must be only one instance. The creational patterns move that decision out of the caller.

---

## Factory Method

**GoF intent:** "Define an interface for creating an object, but let subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses."

A base class contains an algorithm that needs to create an object partway through, but the base class shouldn't decide which concrete type. It declares an abstract creation method, and each subclass overrides it.

```csharp
public interface IDocumentWriter
{
    void WriteHeading(string text);
    void WriteParagraph(string text);
    byte[] ToBytes();
}

public abstract class ReportExporter
{
    // The factory method
    protected abstract IDocumentWriter CreateWriter();

    // The algorithm that uses it is written once
    public byte[] Export(Report report)
    {
        var writer = CreateWriter();
        writer.WriteHeading(report.Title);
        foreach (var section in report.Sections)
            writer.WriteParagraph(section);
        return writer.ToBytes();
    }
}

public class PdfReportExporter : ReportExporter
{
    protected override IDocumentWriter CreateWriter() => new PdfWriter();
}

public class HtmlReportExporter : ReportExporter
{
    protected override IDocumentWriter CreateWriter() => new HtmlWriter();
}
```

`Export` never names `PdfWriter` or `HtmlWriter`. Adding Markdown export means one new exporter subclass and one new writer, with the export algorithm untouched.

### Static Factory Methods Are a Different Idiom

"Factory method" is also used for a static method that creates an instance of its own class, such as `TimeSpan.FromSeconds(30)` or `Guid.NewGuid()`. These are named constructors. They don't involve subclasses and aren't the GoF pattern, but they're common and useful for three reasons:

```csharp
public class Connection
{
    private Connection(string connectionString) { /* ... */ }

    // 1. A name that says what kind of instance you get
    public static Connection ForReadReplica(string host) => new($"Server={host};ApplicationIntent=ReadOnly");

    // 2. Async construction, which a constructor can't do
    public static async Task<Connection> OpenAsync(string connectionString)
    {
        var connection = new Connection(connectionString);
        await connection.InitializeAsync();
        return connection;
    }

    private Task InitializeAsync() { /* ... */ }
}
```

The third reason is freedom to return a cached instance or a subtype, which a constructor can't do either.

### When Not to Use It

Subclassing just to choose a product type creates a class per product. When nothing else varies between the subclasses, pass the writer in (dependency injection) or pass a `Func<IDocumentWriter>`. Factory Method earns its place when the subclasses already exist for other reasons and creation is one of the things they vary.

---

## Abstract Factory

**GoF intent:** "Provide an interface for creating families of related or dependent objects without specifying their concrete classes."

Factory Method creates one product. Abstract Factory creates a family of products that must be used together, and guarantees they come from the same family.

```csharp
public interface IButton { void Render(); }
public interface ICheckbox { void Render(); }

public interface IWidgetFactory
{
    IButton CreateButton();
    ICheckbox CreateCheckbox();
}

public class WindowsWidgetFactory : IWidgetFactory
{
    public IButton CreateButton() => new WindowsButton();
    public ICheckbox CreateCheckbox() => new WindowsCheckbox();
}

public class MacWidgetFactory : IWidgetFactory
{
    public IButton CreateButton() => new MacButton();
    public ICheckbox CreateCheckbox() => new MacCheckbox();
}

// The platform is decided once
IWidgetFactory factory = OperatingSystem.IsWindows()
    ? new WindowsWidgetFactory()
    : new MacWidgetFactory();

// Everything built from it matches
var button = factory.CreateButton();
var checkbox = factory.CreateCheckbox();
```

Code that receives an `IWidgetFactory` can't accidentally put a Mac checkbox next to a Windows button, because it never names a concrete class.

.NET's `DbProviderFactory` is this pattern. `SqlClientFactory.Instance` and `NpgsqlFactory.Instance` each create a matching connection, command, and parameter, so data access code written against `DbProviderFactory` works with either database.

### When Not to Use It

With only one family, the factory interface is ceremony. Adding a new product kind is also expensive, since every factory interface and implementation gains a method. Abstract Factory suits a fixed set of product kinds with a growing set of families, and it suits the opposite poorly.

---

## Builder

**GoF intent:** "Separate the construction of a complex object from its representation so that the same construction process can create different representations."

The GoF version has a *director* that runs a fixed sequence of construction steps against a builder interface, so the same steps can produce different outputs, such as one director walking a document and driving either a PDF builder or a plain-text builder. The form most C# developers meet is simpler: a fluent builder that collects settings one call at a time and produces the object at the end.

```csharp
public sealed class HttpRequestSpec
{
    public required string Url { get; init; }
    public string Method { get; init; } = "GET";
    public TimeSpan Timeout { get; init; }
    public IReadOnlyDictionary<string, string> Headers { get; init; } = new Dictionary<string, string>();
}

public class HttpRequestBuilder
{
    private string? url;
    private string method = "GET";
    private TimeSpan timeout = TimeSpan.FromSeconds(30);
    private readonly Dictionary<string, string> headers = new();

    public HttpRequestBuilder To(string url) { this.url = url; return this; }
    public HttpRequestBuilder Using(string method) { this.method = method; return this; }
    public HttpRequestBuilder WithTimeout(TimeSpan timeout) { this.timeout = timeout; return this; }
    public HttpRequestBuilder WithHeader(string name, string value) { headers[name] = value; return this; }

    public HttpRequestSpec Build()
    {
        if (url is null)
            throw new InvalidOperationException("A URL is required");

        return new HttpRequestSpec
        {
            Url = url,
            Method = method,
            Timeout = timeout,
            Headers = new Dictionary<string, string>(headers)
        };
    }
}

var request = new HttpRequestBuilder()
    .To("https://api.example.com/orders")
    .Using("POST")
    .WithHeader("Accept", "application/json")
    .Build();
```

The builder is mutable while the result is immutable, and `Build` is the one place that checks the combination is valid. That split is the builder's main value in modern C#.

.NET uses the pattern throughout. `WebApplication.CreateBuilder()` collects services and configuration before `Build()` produces the app, `UriBuilder` assembles a `Uri` from parts, and `StringBuilder` accumulates text before `ToString()`.

### Enforcing Order With a Stepwise Builder

When some steps are required and must come in order, each step can return a different interface that exposes only the next step:

```csharp
public interface INeedsUrl { INeedsMethod To(string url); }
public interface INeedsMethod { ICanBuild Using(string method); }
public interface ICanBuild { HttpRequestSpec Build(); }

// RequestBuilder.Create().To(url).Using("GET").Build() compiles.
// RequestBuilder.Create().Build() does not.
```

This moves the "URL is required" check from runtime to compile time, at the cost of an interface per step.

### When Not to Use It

For an object with a few optional properties, C# object initializers with `required` and `init` members do the same job with no extra class. The `HttpRequestSpec` above could be created directly with an initializer, and the builder pays off only when validation spans several properties, the steps are spread across different code, or the same construction has to produce different representations.

---

## Prototype

**GoF intent:** "Specify the kinds of objects to create using a prototypical instance, and create new objects by copying this prototype."

When an object is expensive to set up, or the caller only has an existing instance and doesn't know its concrete class, copying that instance is easier than constructing a new one.

```csharp
public class ReportTemplate
{
    public string Title { get; set; } = "";
    public List<string> Sections { get; set; } = new();
    public PageSettings Page { get; set; } = new();

    public ReportTemplate DeepClone() => new()
    {
        Title = Title,
        Sections = new List<string>(Sections),
        Page = Page.Clone()
    };
}

var monthly = LoadTemplateFromDatabase("monthly"); // expensive
var march = monthly.DeepClone();
march.Title = "March";
march.Sections.Add("Q1 summary"); // doesn't touch the template
```

### Deep or Shallow Is the Whole Problem

A shallow copy duplicates the object but shares everything it references. If `DeepClone` had copied the `Sections` reference instead of the list, adding a section to `march` would add it to the template too. `Object.MemberwiseClone()` and a record's `with` expression both copy shallowly.

.NET's own `ICloneable` doesn't say which kind of copy `Clone()` makes, and its documentation recommends against implementing it in public APIs for that reason. Name the method for what it does, as in `DeepClone`.

Serializing to JSON and back is a common shortcut for deep copies. It is slow, it skips anything the serializer can't see, such as private fields, and it fails on reference cycles unless configured for them, so it suits tests and tools more than hot paths.

### When Not to Use It

If construction is cheap, `new` is clearer than a copy. And for immutable objects there's nothing to protect, so a `with` expression that changes a few properties is all a "clone" needs to be.

---

## Singleton

**GoF intent:** "Ensure a class only has one instance, and provide a global point of access to it."

In C#, `Lazy<T>` makes the classic implementation short and thread-safe:

```csharp
public sealed class AppSettings
{
    private static readonly Lazy<AppSettings> instance = new(() => new AppSettings());

    public static AppSettings Instance => instance.Value;

    private AppSettings() { /* load settings */ }

    public string Get(string key) { /* ... */ }
}
```

The private constructor stops anyone else from creating one, and `Lazy<T>` creates the instance on first use. By default it guarantees that only one thread runs the factory.

### Why It Fell Out of Favor

The pattern bundles two separate ideas: "there is one instance" and "anyone can reach it through a static property". The first is often reasonable. The second causes the trouble.

- **Hidden dependencies.** A class that calls `AppSettings.Instance` inside a method depends on it without saying so in its constructor.
- **Hard to test.** Tests can't substitute a fake, and state left in the instance by one test leaks into the next.
- **Global mutable state.** Any code anywhere can change it, which makes bugs hard to trace.
- **The class controls its own lifetime.** When a second instance becomes necessary later, such as one per tenant, every caller has to change.

### The Modern Replacement

A DI container keeps the "one instance" part and drops the global access:

```csharp
builder.Services.AddSingleton<IAppSettings, AppSettings>();

public class InvoiceService
{
    private readonly IAppSettings settings;

    public InvoiceService(IAppSettings settings) => this.settings = settings;
}
```

The container creates one `AppSettings` and hands it to everyone who asks, `AppSettings` is an ordinary class with a public constructor, and tests pass in whatever they like. Keep the hand-written singleton for code with no container, such as a small library that must not impose one.

---

## Choosing a Creational Pattern

```
Is building the object the hard part?
├─ YES: many optional parts, cross-field validation, or a required order → Builder
├─ YES: an existing configured instance is cheaper to copy than to rebuild → Prototype
└─ NO: is deciding which class to create the hard part?
    ├─ YES: several related objects must come from the same family → Abstract Factory
    ├─ YES: a base class's algorithm creates one object and subclasses pick its type → Factory Method
    ├─ YES: the type depends on configuration, with no subclasses involved → inject the object or a factory delegate
    └─ NO: you only want a descriptive name or async construction → static factory method

Need exactly one shared instance?
└─ Register it as a singleton in the DI container. Hand-write Singleton only where no container exists.
```
