---
title: "C# Properties and Indexers"
layout: guide
category: ".NET & C#"
subcategory: "Object-Oriented Programming"
description: "Properties, auto-properties, computed properties, indexers, and modern initialization patterns in C#."
tags: [c-sharp, dotnet, oop, properties, encapsulation, practical]
---

## Properties

### Basic Property Syntax

```csharp
public class Product
{
    private string name;
    private decimal price;

    // Full property with backing field
    public string Name
    {
        get { return name; }
        set { name = value; }
    }

    // Expression-bodied accessors
    public decimal Price
    {
        get => price;
        set => price = value;
    }
}
```

### Auto-Implemented Properties

When no additional logic is needed, auto-properties eliminate the backing field boilerplate.

```csharp
public class Customer
{
    // Auto-property - compiler generates backing field
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }

    // Read-only auto-property (settable only in constructor)
    public DateTime CreatedAt { get; }

    // Auto-property with initializer
    public bool IsActive { get; set; } = true;
    public List<Order> Orders { get; } = new();

    public Customer(int id)
    {
        Id = id;
        CreatedAt = DateTime.UtcNow;
    }
}
```

### Access Modifiers on Accessors

```csharp
public class Account
{
    // Public get, private set
    public decimal Balance { get; private set; }

    // Public get, protected set
    public int Version { get; protected set; }

    // Internal property with private setter
    internal string InternalId { get; private set; }

    public void Deposit(decimal amount)
    {
        Balance += amount;
    }
}
```

### Read-Only and Init-Only Properties

```csharp
public class Configuration
{
    // Read-only (get only) - set in constructor
    public string Environment { get; }

    // Init-only (C# 9.0) - set during object initialization
    public string ConnectionString { get; init; }
    public int MaxConnections { get; init; } = 100;

    public Configuration(string environment)
    {
        Environment = environment;
    }
}

// Init-only allows object initializer syntax
var config = new Configuration("Production")
{
    ConnectionString = "Server=...",
    MaxConnections = 50
};

// After construction, init properties are read-only
// config.ConnectionString = "other"; // Error
```

### Required Properties (C# 11)

Force initialization of properties during object creation.

```csharp
public class Order
{
    public required int CustomerId { get; set; }
    public required string ProductCode { get; init; }
    public int Quantity { get; set; } = 1;
}

// Must provide required members
var order = new Order
{
    CustomerId = 123,
    ProductCode = "ABC-001"
};

// Error: Required member 'CustomerId' must be set
// var invalid = new Order { ProductCode = "ABC" };

// SetsRequiredMembers attribute for constructors
public class Customer
{
    public required string Name { get; set; }
    public required string Email { get; set; }

    [System.Diagnostics.CodeAnalysis.SetsRequiredMembers]
    public Customer(string name, string email)
    {
        Name = name;
        Email = email;
    }
}
```

### Computed Properties

Properties that calculate their value from other data.

```csharp
public class Rectangle
{
    public double Width { get; set; }
    public double Height { get; set; }

    // Computed from other properties
    public double Area => Width * Height;
    public double Perimeter => 2 * (Width + Height);
    public bool IsSquare => Width == Height;

    // Computed with more complex logic
    public string Classification
    {
        get
        {
            if (Width == Height) return "Square";
            if (Width > Height * 2) return "Wide";
            if (Height > Width * 2) return "Tall";
            return "Rectangle";
        }
    }
}
```

### Property Validation

```csharp
public class Person
{
    private string name;
    private int age;
    private string email;

    public string Name
    {
        get => name;
        set
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException("Name cannot be empty", nameof(value));
            name = value.Trim();
        }
    }

    public int Age
    {
        get => age;
        set
        {
            if (value < 0 || value > 150)
                throw new ArgumentOutOfRangeException(nameof(value), "Age must be 0-150");
            age = value;
        }
    }

    public string Email
    {
        get => email;
        set
        {
            if (!string.IsNullOrEmpty(value) && !value.Contains('@'))
                throw new ArgumentException("Invalid email format", nameof(value));
            email = value?.ToLowerInvariant();
        }
    }
}
```

### Lazy Initialization

```csharp
public class DataService
{
    private ExpensiveResource? resource;

    // Manual lazy initialization
    public ExpensiveResource Resource
    {
        get
        {
            if (resource == null)
            {
                resource = new ExpensiveResource();
            }
            return resource;
        }
    }

    // Using Lazy<T> for thread-safe lazy initialization
    private readonly Lazy<ExpensiveResource> lazyResource =
        new Lazy<ExpensiveResource>(() => new ExpensiveResource());

    public ExpensiveResource ThreadSafeResource => lazyResource.Value;
}

// Modern pattern with null-coalescing assignment
public class Cache
{
    private Dictionary<string, object>? data;

    public Dictionary<string, object> Data =>
        data ??= new Dictionary<string, object>();
}
```

### Change Notification (INotifyPropertyChanged)

```csharp
using System.ComponentModel;
using System.Runtime.CompilerServices;

public class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
            return false;

        field = value;
        OnPropertyChanged(name);
        return true;
    }
}

public class Person : ObservableObject
{
    private string name;
    private int age;

    public string Name
    {
        get => name;
        set => SetProperty(ref name, value);
    }

    public int Age
    {
        get => age;
        set => SetProperty(ref age, value);
    }
}
```

## Indexers

Indexers enable array-like access to objects.

### Basic Indexer

```csharp
public class StringCollection
{
    private readonly List<string> items = new();

    // Indexer with int parameter
    public string this[int index]
    {
        get => items[index];
        set => items[index] = value;
    }

    public int Count => items.Count;

    public void Add(string item) => items.Add(item);
}

// Usage
var collection = new StringCollection();
collection.Add("first");
collection.Add("second");
string item = collection[0];  // "first"
collection[1] = "modified";
```

### Dictionary-Style Indexer

```csharp
public class Configuration
{
    private readonly Dictionary<string, string> settings = new();

    // String indexer
    public string this[string key]
    {
        get => settings.TryGetValue(key, out var value) ? value : "";
        set => settings[key] = value;
    }

    public bool ContainsKey(string key) => settings.ContainsKey(key);
}

// Usage
var config = new Configuration();
config["database"] = "Server=localhost";
config["timeout"] = "30";
string db = config["database"];
```

### Multi-Parameter Indexer

```csharp
public class Matrix
{
    private readonly double[,] data;

    public Matrix(int rows, int cols)
    {
        data = new double[rows, cols];
    }

    // Two-parameter indexer for row, column access
    public double this[int row, int col]
    {
        get => data[row, col];
        set => data[row, col] = value;
    }

    public int Rows => data.GetLength(0);
    public int Columns => data.GetLength(1);
}

// Usage
var matrix = new Matrix(3, 3);
matrix[0, 0] = 1.0;
matrix[1, 1] = 1.0;
matrix[2, 2] = 1.0;
double value = matrix[0, 0];
```

### Read-Only Indexer

```csharp
public class ReadOnlyCollection<T>
{
    private readonly T[] items;

    public ReadOnlyCollection(IEnumerable<T> source)
    {
        items = source.ToArray();
    }

    // Get-only indexer
    public T this[int index] => items[index];

    public int Count => items.Length;
}
```

### Expression-Bodied Indexer

```csharp
public class Sequence
{
    // Expression-bodied indexer (get-only)
    public int this[int index] => index * 2;  // Returns doubles: 0, 2, 4, 6...

    // Expression-bodied with both accessors
    private readonly int[] values = new int[10];
    public int this[int i]
    {
        get => values[i];
        set => values[i] = value;
    }
}
```

### Indexer Overloading

```csharp
public class DataStore
{
    private readonly Dictionary<int, string> byId = new();
    private readonly Dictionary<string, string> byName = new();

    // Indexer by int
    public string this[int id]
    {
        get => byId.TryGetValue(id, out var value) ? value : "";
        set => byId[id] = value;
    }

    // Indexer by string
    public string this[string name]
    {
        get => byName.TryGetValue(name, out var value) ? value : "";
        set => byName[name] = value;
    }
}

// Usage
var store = new DataStore();
store[1] = "First";
store["key"] = "Value";
string byId = store[1];
string byName = store["key"];
```

### Index and Range with Indexers

```csharp
public class CustomList<T>
{
    private readonly List<T> items = new();

    // Standard indexer
    public T this[int index]
    {
        get => items[index];
        set => items[index] = value;
    }

    // Index struct support (^n from end)
    public T this[Index index]
    {
        get => items[index.GetOffset(items.Count)];
        set => items[index.GetOffset(items.Count)] = value;
    }

    // Range support for slicing
    public CustomList<T> this[Range range]
    {
        get
        {
            var (start, length) = range.GetOffsetAndLength(items.Count);
            var result = new CustomList<T>();
            result.items.AddRange(items.GetRange(start, length));
            return result;
        }
    }

    public void Add(T item) => items.Add(item);
    public int Count => items.Count;
}

// Usage
var list = new CustomList<int>();
for (int i = 0; i < 10; i++) list.Add(i);

int last = list[^1];      // 9
int secondLast = list[^2]; // 8
var slice = list[2..5];    // 2, 3, 4
var lastThree = list[^3..]; // 7, 8, 9
```

## Static Properties

```csharp
public class AppSettings
{
    // Static auto-property
    public static string Environment { get; set; } = "Development";

    // Static computed property
    public static bool IsProduction => Environment == "Production";

    // Static property with backing field
    private static ILogger? logger;
    public static ILogger Logger
    {
        get => logger ?? throw new InvalidOperationException("Logger not configured");
        set => logger = value;
    }
}

// Usage
AppSettings.Environment = "Production";
var logger = AppSettings.Logger;
```

## Interface Properties

```csharp
public interface IEntity
{
    int Id { get; }
    DateTime CreatedAt { get; }
    DateTime? ModifiedAt { get; set; }
}

public interface IConfigurable
{
    // Interface indexer
    string this[string key] { get; set; }
}

public class User : IEntity, IConfigurable
{
    public int Id { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public DateTime? ModifiedAt { get; set; }

    private readonly Dictionary<string, string> settings = new();
    public string this[string key]
    {
        get => settings.TryGetValue(key, out var v) ? v : "";
        set => settings[key] = value;
    }
}
```
## Key Takeaways

**Use auto-properties by default**: Only add backing fields when you need validation, lazy loading, or change notification.

**Prefer init over set for immutability**: Init-only setters allow object initializer syntax while preventing later modification.

**Use required for mandatory data**: Required properties ensure objects are always in a valid state after construction.

**Indexers for collection-like access**: When your type logically contains items accessible by key or index, expose an indexer.

**Computed properties for derived data**: Don't store data that can be computed from other properties.

**Validate in setters, not getters**: Keep getters simple and side-effect free; put validation logic in setters.
