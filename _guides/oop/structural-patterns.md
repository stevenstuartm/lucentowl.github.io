---
title: "Structural Patterns"
layout: guide
category: Programming Patterns
subcategory: GoF Patterns
description: "The seven structural patterns for composing objects into larger structures: Adapter, Bridge and the N×M class explosion it prevents, Composite for part-whole trees, Decorator and why wrapping order matters, Facade, Flyweight's intrinsic and extrinsic state, and Proxy. How the four wrapper patterns differ, with C# examples, .NET's own instances, and when not to use each."
tags: [design-patterns, adapter, bridge, composite, decorator, proxy, practical]
---

## What Structural Patterns Solve

Structural patterns are about how objects are assembled: one object wrapping another, a hierarchy split into two, or many small objects arranged into a tree. Each keeps the pieces loosely connected so they can be combined in ways the original classes didn't plan for.

Four of the seven, Adapter, Decorator, Proxy, and Facade, wrap one or more objects and look alike in code. What separates them is intent, and the interface each one shows its caller.

{% include figure.html id="oop-wrapper-patterns" %}

| Pattern | Interface it exposes | Why it wraps |
|---|---|---|
| **Adapter** | A different interface from the wrapped object's | To make an existing class fit an interface it doesn't implement |
| **Decorator** | The same interface as the wrapped object | To add behavior, and decorators can be stacked |
| **Proxy** | The same interface as the wrapped object | To control access: create it lazily, check permissions, cache, or reach it remotely |
| **Facade** | A new, simpler interface | To give one entry point to several subsystem objects |

---

## Adapter

**GoF intent:** "Convert the interface of a class into another interface clients expect. Adapter lets classes work together that couldn't otherwise because of incompatible interfaces."

The usual case is a class you can't change, such as third-party or legacy code, that does the right work behind the wrong interface.

```csharp
// The interface the application is written against
public interface IAppLogger
{
    void Info(string message);
    void Error(string message, Exception exception);
}

// A legacy logger that can't be changed
public class LegacyEventLog
{
    public void WriteEntry(int severity, string text) { /* ... */ }
}

public class LegacyEventLogAdapter : IAppLogger
{
    private readonly LegacyEventLog log;

    public LegacyEventLogAdapter(LegacyEventLog log) => this.log = log;

    public void Info(string message) => log.WriteEntry(1, message);

    public void Error(string message, Exception exception) =>
        log.WriteEntry(3, $"{message}: {exception}");
}
```

The adapter translates each call, including arguments that don't line up one to one, such as severity levels and the exception folded into the text. The GoF book also describes a class adapter that inherits from both sides, but that needs multiple inheritance of classes, so in C# adapters wrap an instance, as here.

In .NET, `StreamReader` presents a byte-oriented `Stream` through the character-oriented `TextReader` interface.

### When Not to Use It

When you own both sides, change one of them instead. An adapter between two of your own interfaces is a sign that one of the designs should be fixed.

---

## Bridge

**GoF intent:** "Decouple an abstraction from its implementation so that the two can vary independently."

Bridge applies when a class hierarchy varies along two independent dimensions. Shapes might be circles, rectangles, or triangles, and each might be drawn by a vector, raster, or PDF renderer. Modeled with inheritance alone, every combination becomes a class, from `VectorCircle` to `PdfTriangle`. Three shapes and three renderers make nine classes, and each new renderer adds a class per shape. Bridge splits the hierarchy in two and connects them with a reference, so the count is added rather than multiplied.

{% include figure.html id="oop-bridge" %}

```csharp
// Implementation side: how to draw
public interface IRenderer
{
    void DrawCircle(float x, float y, float radius);
    void DrawRectangle(float x, float y, float width, float height);
}

public class VectorRenderer : IRenderer
{
    public void DrawCircle(float x, float y, float radius) { /* emit SVG */ }
    public void DrawRectangle(float x, float y, float width, float height) { /* emit SVG */ }
}

public class RasterRenderer : IRenderer
{
    public void DrawCircle(float x, float y, float radius) { /* set pixels */ }
    public void DrawRectangle(float x, float y, float width, float height) { /* set pixels */ }
}

// Abstraction side: what to draw
public abstract class Shape
{
    protected readonly IRenderer renderer; // the bridge

    protected Shape(IRenderer renderer) => this.renderer = renderer;

    public abstract void Draw();
}

public class Circle : Shape
{
    private readonly float x, y, radius;

    public Circle(IRenderer renderer, float x, float y, float radius) : base(renderer) =>
        (this.x, this.y, this.radius) = (x, y, radius);

    public override void Draw() => renderer.DrawCircle(x, y, radius);
}

public class Rectangle : Shape
{
    private readonly float x, y, width, height;

    public Rectangle(IRenderer renderer, float x, float y, float width, float height) : base(renderer) =>
        (this.x, this.y, this.width, this.height) = (x, y, width, height);

    public override void Draw() => renderer.DrawRectangle(x, y, width, height);
}
```

A new shape doesn't touch the renderers, and a new renderer doesn't touch the shapes. Bridge looks like Adapter in code, but it's designed in from the start to keep two hierarchies apart, while Adapter is applied afterward to make existing classes fit.

### When Not to Use It

With only one dimension of variation, Bridge is an interface for no reason. It also requires the implementation interface to cover what every abstraction needs, and if new shapes keep needing new renderer methods, the two sides aren't as independent as the split assumes.

---

## Composite

**GoF intent:** "Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects uniformly."

Folders contain files and other folders, a UI panel contains controls and other panels, and an order bundle contains products and other bundles. Composite gives the single item (the leaf) and the container (the composite) one shared interface, so code can ask either for its size without checking which it has.

```csharp
public interface IFileSystemEntry
{
    string Name { get; }
    long Size();
}

// Leaf
public class FileEntry : IFileSystemEntry
{
    private readonly long bytes;

    public FileEntry(string name, long bytes) => (Name, this.bytes) = (name, bytes);

    public string Name { get; }
    public long Size() => bytes;
}

// Composite
public class FolderEntry : IFileSystemEntry
{
    private readonly List<IFileSystemEntry> children = new();

    public FolderEntry(string name) => Name = name;

    public string Name { get; }
    public void Add(IFileSystemEntry entry) => children.Add(entry);

    // Delegates to the children, each of which may be a folder itself
    public long Size() => children.Sum(c => c.Size());
}

var docs = new FolderEntry("docs");
docs.Add(new FileEntry("readme.md", 2_000));
docs.Add(new FileEntry("guide.pdf", 500_000));

var root = new FolderEntry("root");
root.Add(docs);
root.Add(new FileEntry("app.exe", 1_200_000));

Console.WriteLine(root.Size()); // 1702000
```

`root.Size()` asks each child for its size. The `docs` folder asks its own children and returns their sum, and the recursion ends at the files:

```
root.Size() = 1,702,000
├─ docs.Size() = 502,000
│   ├─ readme.md    2,000
│   └─ guide.pdf  500,000
└─ app.exe     1,200,000
```

The caller never distinguishes a file from a folder, and adding a new kind of entry, such as a symbolic link, doesn't touch the traversal.

### Where to Put Add and Remove

The GoF book discusses a real trade-off. Declaring `Add` on the shared interface makes leaves and composites fully interchangeable, but then `FileEntry.Add` has to throw or do nothing. Declaring it only on the composite, as above, keeps leaves honest, but code that builds the tree has to know which type it holds. Most C# code takes the second option.

### When Not to Use It

A flat collection doesn't need it, and neither does a hierarchy whose levels behave differently enough that treating them uniformly hides important distinctions.

---

## Decorator

**GoF intent:** "Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality."

A decorator implements the same interface as the object it wraps, forwards each call, and adds something before or after. Because the result has the same interface, decorators stack.

```csharp
public interface IMessageSender
{
    Task SendAsync(string to, string body);
}

public class SmtpSender : IMessageSender
{
    public Task SendAsync(string to, string body) { /* send */ }
}

public class LoggingSender : IMessageSender
{
    private readonly IMessageSender inner;
    private readonly ILogger logger;

    public LoggingSender(IMessageSender inner, ILogger logger) => (this.inner, this.logger) = (inner, logger);

    public async Task SendAsync(string to, string body)
    {
        logger.LogInformation("Sending to {To}", to);
        await inner.SendAsync(to, body);
    }
}

public class RetryingSender : IMessageSender
{
    private readonly IMessageSender inner;

    public RetryingSender(IMessageSender inner) => this.inner = inner;

    public async Task SendAsync(string to, string body)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await inner.SendAsync(to, body);
                return;
            }
            catch (IOException) when (attempt < 3)
            {
                await Task.Delay(TimeSpan.FromSeconds(attempt));
            }
        }
    }
}

// Log once per send, retrying underneath
IMessageSender sender = new LoggingSender(new RetryingSender(new SmtpSender()), logger);
```

Subclassing would need a class for every combination: logging, retrying, logging-and-retrying. With decorators, each behavior is written once, and the combination is chosen where the objects are built.

### Wrapping Order Changes Behavior

The outermost decorator runs first. Swap the two above, and every retry is logged instead of every send. Order matters most with .NET's streams, which are the framework's clearest decorators. `GZipStream`, `CryptoStream`, and `BufferedStream` each wrap another `Stream`:

```csharp
using var file = File.Create("backup.bin");
using var encrypt = new CryptoStream(file, aes.CreateEncryptor(), CryptoStreamMode.Write);
using var compress = new GZipStream(encrypt, CompressionLevel.Optimal);

await data.CopyToAsync(compress); // compressed first, then encrypted, then written
```

Data written to `compress` flows inward, so it's compressed, then encrypted, then written to the file. Reversing the two wrappers would encrypt first, and encrypted bytes look random, so compression would achieve almost nothing.

A C# extension method is sometimes called a lightweight decorator. It isn't one, because it wraps no object and can't change what an existing call does. It only adds a new method at compile time.

### When Not to Use It

Deep stacks are hard to debug, because the object you hold hides several layers of behavior. When the combination never changes at runtime, one class that does all of it may be clearer.

---

## Facade

**GoF intent:** "Provide a unified interface to a set of interfaces in a subsystem. Facade defines a higher-level interface that makes the subsystem easier to use."

```csharp
public class CheckoutFacade
{
    private readonly IInventoryService inventory;
    private readonly IPaymentService payments;
    private readonly IShippingService shipping;
    private readonly INotificationService notifications;

    public CheckoutFacade(IInventoryService inventory, IPaymentService payments,
        IShippingService shipping, INotificationService notifications) =>
        (this.inventory, this.payments, this.shipping, this.notifications) =
            (inventory, payments, shipping, notifications);

    public async Task<OrderConfirmation> PlaceOrderAsync(Order order)
    {
        await inventory.ReserveAsync(order.Items);
        var receipt = await payments.ChargeAsync(order.CustomerId, order.Total);
        var tracking = await shipping.ScheduleAsync(order);
        await notifications.SendConfirmationAsync(order.CustomerEmail, tracking);
        return new OrderConfirmation(receipt.Id, tracking);
    }
}
```

Callers make one call instead of learning four services and their required order. A facade doesn't hide the subsystem. Code that needs finer control can still use the services directly.

### When Not to Use It

A facade over one simple service adds a layer and nothing else. The common failure is a leaky facade, one whose methods return the subsystem's own objects, such as a `GetPaymentGateway()` method, so callers end up coupled to the subsystem anyway. A facade that keeps growing methods for every caller's special case has become a god object.

---

## Flyweight

**GoF intent:** "Use sharing to support large numbers of fine-grained objects efficiently."

When a program needs very many objects that are mostly alike, such as characters in a document, trees in a game map, or particles, storing the same data in each wastes memory. Flyweight splits an object's state in two. **Intrinsic** state is the same across many objects and is stored once in a shared flyweight. **Extrinsic** state differs per use and is passed in by the caller.

```csharp
// Intrinsic: shared by every use of the same glyph
public sealed class Glyph
{
    public char Character { get; }
    public string FontFamily { get; }
    public int FontSize { get; }

    internal Glyph(char character, string fontFamily, int fontSize) =>
        (Character, FontFamily, FontSize) = (character, fontFamily, fontSize);

    // Extrinsic: position and color come from the caller
    public void Draw(int x, int y, string color) { /* render */ }
}

public class GlyphFactory
{
    private readonly Dictionary<(char, string, int), Glyph> cache = new();

    public Glyph Get(char character, string fontFamily, int fontSize)
    {
        var key = (character, fontFamily, fontSize);
        if (!cache.TryGetValue(key, out var glyph))
        {
            glyph = new Glyph(character, fontFamily, fontSize);
            cache[key] = glyph;
        }
        return glyph;
    }

    public int Count => cache.Count;
}
```

A 100,000-character document in one font needs only as many `Glyph` objects as it has distinct characters, while each position in the document stores just a reference, coordinates, and a color. Flyweights must be immutable, since every user shares them. A factory used from several threads needs a `ConcurrentDictionary` in place of the `Dictionary`.

.NET's string interning is a flyweight. String literals with the same value share one instance, and `string.Intern` extends that to strings built at runtime.

### When Not to Use It

With few objects, or with state that is mostly unique per object, the split adds complexity and saves little. Measure memory before reaching for it.

---

## Proxy

**GoF intent:** "Provide a surrogate or placeholder for another object to control access to it."

A proxy implements the same interface as the real object and stands in for it. Callers can't tell the difference, and the proxy decides when and whether to pass each call through. The GoF book names several kinds by what the control is for:

| Kind | Controls |
|---|---|
| **Virtual proxy** | When the real object is created, deferring expensive work until first use |
| **Protection proxy** | Who may call it, checking permissions first |
| **Remote proxy** | Where it runs, making an object in another process look local |
| **Smart reference** | What happens around each access, such as counting references or loading on demand |

Caching proxies, which return stored results instead of calling through, are a common modern addition.

```csharp
public interface IReportService
{
    Task<Report> GetAsync(int id);
}

// Protection proxy
public class AuthorizedReportService : IReportService
{
    private readonly IReportService inner;
    private readonly ICurrentUser user;

    public AuthorizedReportService(IReportService inner, ICurrentUser user) => (this.inner, this.user) = (inner, user);

    public Task<Report> GetAsync(int id) =>
        user.HasPermission("reports.read")
            ? inner.GetAsync(id)
            : throw new UnauthorizedAccessException();
}

// Virtual proxy: the real service is built on first use
public class LazyReportService : IReportService
{
    private readonly Lazy<IReportService> inner;

    public LazyReportService(Func<IReportService> create) => inner = new Lazy<IReportService>(create);

    public Task<Report> GetAsync(int id) => inner.Value.GetAsync(id);
}
```

A proxy and a decorator have the same structure. A decorator adds behavior the caller wants, and a proxy manages access the caller shouldn't have to think about.

.NET has several. EF Core's lazy-loading proxies are runtime-generated subclasses of your entities that load a navigation property the first time it's read. A gRPC client is a remote proxy for a service in another process, and `Lazy<T>` is a general-purpose virtual proxy.

### When Not to Use It

Every proxy hides work behind what looks like a plain method call. A lazy-loading proxy that issues a database query from inside a loop is the classic N+1 query problem, and it's invisible in the calling code. Use a proxy when the control is needed, and make expensive access explicit where the cost matters.

---

## Choosing a Structural Pattern

```
Wrapping existing objects?
├─ The wrapped class has the wrong interface → Adapter
├─ Same interface, adding behavior the caller wants → Decorator
├─ Same interface, controlling creation, permission, location, or caching → Proxy
└─ Several objects behind one simpler entry point → Facade

Designing a new structure?
├─ A hierarchy varies along two independent dimensions → Bridge
├─ Items and groups of items should be treated alike → Composite
└─ Very many near-identical objects strain memory → Flyweight
```
