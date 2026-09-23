---
title: "C# Properties and Indexers"
layout: guide
category: ".NET & C#"
subcategory: "Object-Oriented Programming"
description: "Why C# exposes data through properties rather than fields, auto-properties and the C# 14 field keyword, accessor accessibility, init-only and required members, computed properties and when a method is the better choice, validation, lazy initialization, change notification, and indexers including implicit Index and Range support."
tags: [properties, indexers, init-accessors, required-members, field-keyword, encapsulation, practical]
---

## Properties

A property looks like a field to its callers and behaves like a pair of methods to the compiler. `customer.Name = "Ann"` compiles to a call to the property's `set` accessor, and reading `customer.Name` calls its `get` accessor. That indirection is the whole point: the type controls what happens on every read and write, and can change that later without changing how callers write the code.

### Why Properties, Not Public Fields

The indirection is also why public data should be a property from the start, even when the accessors do nothing yet:

- **Binary compatibility.** Callers compiled against a field access it directly, and callers compiled against a property call its accessor. Changing a public field to a property later is a binary-breaking change, so every assembly compiled against the field must be recompiled.
- **Source compatibility.** A field can be passed as a `ref` or `out` argument and a property can't, so the change can also break callers' source.
- **Contracts.** Interfaces can declare properties but not instance fields, so only a property can be part of an abstraction.
- **Tooling.** Serializers and data binding work on properties by default. System.Text.Json, for example, ignores public fields unless `IncludeFields` is set.

The usual exceptions are `const` and `static readonly` fields, which don't change after initialization and so have nothing to evolve.

### Property Syntax

A full property declares its own backing field and accessors. An auto-property lets the compiler generate the backing field when the accessors would only read and write it.

```csharp
public class Customer
{
    // Full property with an explicit backing field
    private string name = "";
    public string Name
    {
        get => name;
        set => name = value;
    }

    // Auto-properties: the compiler generates the backing field
    public int Id { get; set; }
    public string Email { get; set; } = "";         // with an initializer
    public DateTime CreatedAt { get; }              // get-only: set in a constructor or initializer
    public List<Order> Orders { get; } = new();

    public Customer(int id)
    {
        Id = id;
        CreatedAt = DateTime.UtcNow;
    }
}
```

### The field Keyword (C# 14)

Before C# 14, adding any logic to one accessor meant giving up the auto-property: declaring a backing field and writing both accessors by hand. The `field` keyword removes that step. Inside a property accessor, `field` refers to the compiler-generated backing field, so an accessor can add logic while the other stays automatic:

```csharp
public class Person
{
    public string Name
    {
        get;
        set => field = string.IsNullOrWhiteSpace(value)
            ? throw new ArgumentException("Name cannot be empty", nameof(value))
            : value.Trim();
    } = "";
}
```

The backing field is private to the property, so no other member of the class can bypass the setter's validation by writing the field directly, which an explicit backing field always allowed.

One compatibility edge: in a type that already has a member named `field`, the word inside an accessor now means the keyword. The compiler flags each such use with warning CS9258. Write `this.field` or `@field` to reach the member.

### Accessor Accessibility

Either accessor can be more restrictive than the property itself, which is how a type exposes a value for reading while keeping the writes to itself:

```csharp
public class Account
{
    public decimal Balance { get; private set; }     // anyone reads, only Account writes
    public int Version { get; protected set; }       // derived classes may write

    public void Deposit(decimal amount) => Balance += amount;
}
```

Only one of the two accessors can carry a modifier, and it must be more restrictive than the property's own accessibility.

### Read-Only and Init-Only Properties

A get-only auto-property can be assigned only in a constructor or its initializer. An `init` accessor (C# 9) widens that to the object-creation phase: a constructor, an object initializer, a `with` expression, or another property's `init` accessor. After that, the property is read-only.

```csharp
public class Configuration
{
    public string Environment { get; }                   // constructor only
    public string ConnectionString { get; init; } = "";  // constructor or initializer
    public int MaxConnections { get; init; } = 100;

    public Configuration(string environment) => Environment = environment;
}

var config = new Configuration("Production")
{
    ConnectionString = "Server=...",
    MaxConnections = 50
};

// config.ConnectionString = "other";   // compile error after initialization
```

`init` stops reassignment of the property. It doesn't make the value immutable: an `init`-only `List<T>` property still hands out a list anyone can add to.

### Required Members (C# 11)

`required` makes the compiler insist that every object creation sets the member, either in an object initializer or through a constructor marked as setting it:

```csharp
public class Order
{
    public required int CustomerId { get; set; }
    public required string ProductCode { get; init; }
    public int Quantity { get; set; } = 1;
}

var order = new Order { CustomerId = 123, ProductCode = "ABC-001" };
// var invalid = new Order { ProductCode = "ABC" };   // error: CustomerId must be set
```

A constructor that sets the required members itself is marked `[SetsRequiredMembers]`, which switches the check off for callers using that constructor. The compiler takes the attribute on trust and doesn't verify that the constructor sets every required member. Nullable analysis still warns about a non-nullable one left unset (CS8618), but a missed `int` goes unnoticed.

```csharp
public class Customer
{
    public required string Name { get; set; }
    public required string Email { get; set; }

    [SetsRequiredMembers]
    public Customer(string name, string email)
    {
        Name = name;
        Email = email;
    }
}
```

`required` is about presence, not nullability. `public required string? MiddleName { get; set; }` is legal and means "every caller must decide, and null is an acceptable decision." For a non-nullable reference property, `required` is also one of the ways to satisfy the nullable warning about an uninitialized property.

### Computed Properties

A property with only a getter can compute its value from other state rather than storing it, so it can never fall out of sync:

```csharp
public class Rectangle
{
    public double Width { get; set; }
    public double Height { get; set; }

    public double Area => Width * Height;
    public double Perimeter => 2 * (Width + Height);
    public bool IsSquare => Width == Height;
}
```

### Property or Method?

Because a property reads like a field, callers assume it behaves like one: cheap, free of side effects, and returning the same value when read twice in a row. Microsoft's framework design guidelines turn those assumptions into rules. Make it a method instead when the operation:

| Use a method when the operation | Example |
| --- | --- |
| Is much slower than a field access, or does I/O | `LoadOrders()`, not `Orders` that queries a database |
| Has an observable side effect | `Advance()`, not a getter that moves a cursor |
| Returns a different value each call with no state change | `Guid.NewGuid()` is a method; `DateTime.Now` is the often-cited exception |
| Returns a copy of internal state, such as a new array | `GetItems()`, so callers know `x.GetItems()[0] = ...` changes nothing |
| Is a conversion | `ToArray()`, `ToString()` |

The same expectations make throwing from a getter a surprise, since nobody wraps a property read in `try`. Validation belongs in the setter, and a getter that can fail is usually a method in disguise.

### Validation

A setter is where a type enforces its invariants on incoming values. With `field`, validation no longer costs a hand-written backing field:

```csharp
public class Person
{
    public int Age
    {
        get;
        set => field = value is >= 0 and <= 150
            ? value
            : throw new ArgumentOutOfRangeException(nameof(value), "Age must be 0-150");
    }

    public string? Email
    {
        get;
        set
        {
            if (value is not null && !value.Contains('@'))
                throw new ArgumentException("Invalid email format", nameof(value));
            field = value?.ToLowerInvariant();
        }
    }
}
```

Setter validation only guards the setter. An object initializer calls it, but a constructor that writes a different backing field, or deserialization that bypasses the property, doesn't.

### Lazy Initialization

A getter can defer creating an expensive value until the first read:

```csharp
public class DataService
{
    // Not thread-safe: two threads can both see null and both create one
    public ExpensiveResource Resource => field ??= new ExpensiveResource();

    // Thread-safe: Lazy<T> defaults to creating the value exactly once
    private readonly Lazy<ExpensiveResource> shared = new(() => new ExpensiveResource());
    public ExpensiveResource SharedResource => shared.Value;
}
```

`??=` is fine for an object used from one thread. For a value shared across threads, `Lazy<T>` in its default mode runs the factory once and makes every other caller wait for it.

### Change Notification (INotifyPropertyChanged)

UI frameworks such as WPF, WinUI, and .NET MAUI bind to properties and listen for `INotifyPropertyChanged.PropertyChanged` to know when to refresh. The usual shape is a helper that compares, assigns, and raises the event, with `[CallerMemberName]` supplying the property's name:

```csharp
public class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    protected bool SetProperty<T>(ref T storage, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(storage, value))
            return false;

        storage = value;
        OnPropertyChanged(name);
        return true;
    }
}

public class PersonViewModel : ObservableObject
{
    public string Name { get; set => SetProperty(ref field, value); } = "";
    public int Age { get; set => SetProperty(ref field, value); }
}
```

`field` can be passed by `ref`, so each property is one line with no declared backing field. Before C# 14, the same result needed an explicit field per property, or a source generator such as the MVVM Toolkit's `[ObservableProperty]` to write them.

## Indexers

An indexer lets callers use `obj[key]` syntax on an instance. It is declared like a property named `this`, with parameters in square brackets, and its accessors work the same way.

### Basic Indexer

```csharp
public class StringCollection
{
    private readonly List<string> items = new();

    public string this[int index]
    {
        get => items[index];
        set => items[index] = value;
    }

    public int Count => items.Count;
    public void Add(string item) => items.Add(item);
}

var collection = new StringCollection();
collection.Add("first");
collection.Add("second");
string item = collection[0];     // "first"
collection[1] = "modified";
```

A get-only indexer can use the expression-bodied form, `public string this[int index] => items[index];`.

### Keys Other Than int

An indexer parameter can be any type, and a type can overload indexers on different parameter types, as long as the parameter lists differ:

```csharp
public class Settings
{
    private readonly Dictionary<string, string> values = new();

    public string this[string key]
    {
        get => values[key];              // throws KeyNotFoundException for a missing key
        set => values[key] = value;
    }

    public bool TryGet(string key, [NotNullWhen(true)] out string? value) =>
        values.TryGetValue(key, out value);
}

var settings = new Settings();
settings["database"] = "Server=localhost";
string db = settings["database"];
```

A missing key needs a deliberate choice. Returning a default such as `""` hides the mistake of asking for a key that was never set. The BCL's `Dictionary<TKey, TValue>` throws from its indexer and offers `TryGetValue` for callers who expect absence, and a custom indexer usually should follow the same split.

### Multi-Parameter Indexers

```csharp
public class Matrix
{
    private readonly double[,] data;

    public Matrix(int rows, int cols) => data = new double[rows, cols];

    public double this[int row, int col]
    {
        get => data[row, col];
        set => data[row, col] = value;
    }

    public int Rows => data.GetLength(0);
    public int Columns => data.GetLength(1);
}

var identity = new Matrix(3, 3);
identity[0, 0] = identity[1, 1] = identity[2, 2] = 1.0;
```

### Index and Range Support

The `^` (from end) and `..` (range) operators work on a custom type without an `Index` or `Range` indexer. C# 8 supplies them by pattern when the type has the right shape:

| To support | The type needs |
| --- | --- |
| `obj[^1]` | A `Count` or `Length` property and an `int` indexer |
| `obj[2..5]` | A `Count` or `Length` property and a `Slice(int start, int length)` method |

```csharp
public class Sequence
{
    private readonly List<int> items = new();

    public int Count => items.Count;
    public int this[int index] => items[index];

    public Sequence Slice(int start, int length)
    {
        var slice = new Sequence();
        slice.items.AddRange(items.GetRange(start, length));
        return slice;
    }

    public void Add(int item) => items.Add(item);
}

// with items 0..9
int last = seq[^1];          // 9: rewritten to seq[seq.Count - 1]
var middle = seq[2..5];      // 2, 3, 4: rewritten to seq.Slice(2, 3)
var lastThree = seq[^3..];   // 7, 8, 9
```

Declare explicit `this[Index]` or `this[Range]` indexers only when the implicit translation isn't what you want.

## Static Properties

A static property belongs to the type rather than to an instance. A computed static property, such as a named constant value or a cached default instance, is common and harmless. A static property with a public setter is global mutable state that every caller shares, with the testing and concurrency problems that brings.

```csharp
public static class Defaults
{
    public static TimeSpan RequestTimeout => TimeSpan.FromSeconds(30);   // computed, read-only
    public static JsonSerializerOptions Json { get; } = new(JsonSerializerDefaults.Web);
}
```

## Interface Properties

An interface can declare properties and indexers. The declaration is abstract even though it looks like an auto-property, so each implementer provides the accessors. An implementer may add an accessor the interface didn't ask for, such as an `init` on a property the interface declared get-only.

```csharp
public interface IEntity
{
    int Id { get; }
    DateTime? ModifiedAt { get; set; }
}

public interface IConfigurable
{
    string this[string key] { get; set; }
}

public class User : IEntity, IConfigurable
{
    public int Id { get; init; }
    public DateTime? ModifiedAt { get; set; }

    private readonly Dictionary<string, string> settings = new();
    public string this[string key]
    {
        get => settings[key];
        set => settings[key] = value;
    }
}
```

## Key Takeaways

**Expose data through properties, not fields.** Switching later is a binary-breaking change, and fields can't join an interface or, by default, a serializer.

**Use `field` to add logic without a hand-written backing field.** One accessor can validate or notify while the other stays automatic, and nothing else in the class can bypass it.

**Prefer `init` for values fixed at creation, and `required` for values every caller must supply.** Neither makes the referenced object immutable, and `[SetsRequiredMembers]` is taken on trust.

**Keep getters cheap and free of side effects.** If reading it is slow, changes state, or returns a fresh copy each time, make it a method.

**Give indexers a clear missing-key behavior.** Throw from the indexer and offer a `TryGet` method, as `Dictionary` does, rather than returning a silent default.

**Let the compiler provide `^` and `..`.** A `Count`, an `int` indexer, and a `Slice` method are enough.
