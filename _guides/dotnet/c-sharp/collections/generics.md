---
title: "C# Generics"
layout: guide
category: ".NET & C#"
subcategory: "Collections & Data"
description: "Generic types, methods, constraints, variance, and building reusable type-safe components."
tags: [c-sharp, dotnet, generics, type-safety, reusability, practical]
---

## Why Generics

Generics enable type-safe, reusable code without sacrificing performance.

```csharp
// Without generics - type unsafe, boxing overhead
ArrayList list = new ArrayList();
list.Add(1);
list.Add("string");  // No compile error
int value = (int)list[0];  // Runtime cast needed
int error = (int)list[1];  // Runtime exception

// With generics - type safe, no boxing
List<int> list = new List<int>();
list.Add(1);
// list.Add("string");  // Compile error
int value = list[0];  // No cast needed
```

## Generic Classes

### Basic Generic Class

```csharp
public class Box<T>
{
    private T content;

    public void Pack(T item)
    {
        content = item;
    }

    public T Unpack()
    {
        return content;
    }
}

// Usage - type argument inferred or explicit
var intBox = new Box<int>();
intBox.Pack(42);
int value = intBox.Unpack();

Box<string> stringBox = new Box<string>();
stringBox.Pack("hello");
```

### Multiple Type Parameters

```csharp
public class Pair<TFirst, TSecond>
{
    public TFirst First { get; set; }
    public TSecond Second { get; set; }

    public Pair(TFirst first, TSecond second)
    {
        First = first;
        Second = second;
    }

    public void Deconstruct(out TFirst first, out TSecond second)
    {
        first = First;
        second = Second;
    }
}

var pair = new Pair<string, int>("age", 30);
var (key, value) = pair;

// Generic key-value store
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

Methods can be generic independently of their containing class.

```csharp
public class Utilities
{
    // Generic method
    public static T Max<T>(T a, T b) where T : IComparable<T>
    {
        return a.CompareTo(b) >= 0 ? a : b;
    }

    // Generic swap
    public static void Swap<T>(ref T a, ref T b)
    {
        T temp = a;
        a = b;
        b = temp;
    }

    // Type inference
    public static List<T> ToList<T>(params T[] items)
    {
        return new List<T>(items);
    }
}

// Usage - type often inferred
int max = Utilities.Max(10, 20);  // T inferred as int
string maxStr = Utilities.Max("apple", "banana");

int x = 1, y = 2;
Utilities.Swap(ref x, ref y);

var list = Utilities.ToList(1, 2, 3);  // T inferred as int
```

### Generic Extension Methods

```csharp
public static class EnumerableExtensions
{
    public static bool IsEmpty<T>(this IEnumerable<T> source)
    {
        return !source.Any();
    }

    public static T? FirstOrNull<T>(this IEnumerable<T> source)
        where T : class
    {
        return source.FirstOrDefault();
    }

    public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T?> source)
        where T : class
    {
        foreach (var item in source)
        {
            if (item is not null)
                yield return item;
        }
    }
}

// Usage
var items = new List<int> { 1, 2, 3 };
bool empty = items.IsEmpty();

var people = new List<Person?> { person1, null, person2 };
var validPeople = people.WhereNotNull();
```

## Type Constraints

Constraints restrict which types can be used as type arguments.

### Reference Type Constraint

```csharp
public class ReferenceOnlyContainer<T> where T : class
{
    private T? item;

    public void Set(T value) => item = value;
    public T? Get() => item;
}

// Valid
var container = new ReferenceOnlyContainer<string>();

// Invalid - int is a value type
// var invalid = new ReferenceOnlyContainer<int>();
```

### Value Type Constraint

```csharp
public class ValueOnlyContainer<T> where T : struct
{
    private T item;

    public void Set(T value) => item = value;
    public T Get() => item;
}

// Valid
var container = new ValueOnlyContainer<int>();

// Invalid - string is a reference type
// var invalid = new ValueOnlyContainer<string>();
```

### Constructor Constraint

```csharp
public class Factory<T> where T : new()
{
    public T Create() => new T();
}

// Valid
var factory = new Factory<List<int>>();
var list = factory.Create();

// Invalid - string has no parameterless constructor
// var invalid = new Factory<string>();
```

### Interface and Base Class Constraints

```csharp
public class ComparableContainer<T> where T : IComparable<T>
{
    private T value;

    public bool IsGreaterThan(T other) => value.CompareTo(other) > 0;
}

public class AnimalShelter<T> where T : Animal
{
    private List<T> animals = new();

    public void Accept(T animal) => animals.Add(animal);
    public IEnumerable<T> GetAll() => animals;
}
```

### Multiple Constraints

```csharp
public class Repository<TKey, TEntity>
    where TKey : notnull, IComparable<TKey>
    where TEntity : class, IEntity, new()
{
    private SortedDictionary<TKey, TEntity> store = new();

    public TEntity GetOrCreate(TKey key)
    {
        if (!store.TryGetValue(key, out var entity))
        {
            entity = new TEntity();
            store[key] = entity;
        }
        return entity;
    }
}
```

### notnull Constraint (C# 8.0)

```csharp
public class Dictionary<TKey, TValue>
    where TKey : notnull  // Cannot use nullable type
{
    // TKey guaranteed non-null
}
```

### unmanaged Constraint

For types that can be used in unsafe code (no reference type fields).

```csharp
public class Buffer<T> where T : unmanaged
{
    private T* pointer;
    private int length;

    public unsafe Buffer(int size)
    {
        pointer = (T*)Marshal.AllocHGlobal(size * sizeof(T));
        length = size;
    }
}

// Valid: int, double, structs with only unmanaged fields
var intBuffer = new Buffer<int>(100);
```

## Generic Interfaces

```csharp
public interface IRepository<T>
{
    T? GetById(int id);
    IEnumerable<T> GetAll();
    void Add(T entity);
    void Update(T entity);
    void Delete(int id);
}

public class CustomerRepository : IRepository<Customer>
{
    private readonly List<Customer> customers = new();

    public Customer? GetById(int id) =>
        customers.FirstOrDefault(c => c.Id == id);

    public IEnumerable<Customer> GetAll() => customers;

    public void Add(Customer entity) => customers.Add(entity);

    public void Update(Customer entity)
    {
        var index = customers.FindIndex(c => c.Id == entity.Id);
        if (index >= 0) customers[index] = entity;
    }

    public void Delete(int id) =>
        customers.RemoveAll(c => c.Id == id);
}
```

## Covariance and Contravariance

Variance allows more flexible type relationships in generic interfaces.

### Covariance (out)

Return type can be more derived.

```csharp
public interface IReadOnlyRepository<out T>
{
    T GetById(int id);
    IEnumerable<T> GetAll();
}

IReadOnlyRepository<Animal> animals = new DogRepository();
// OK because Dog is-a Animal, and we only read (out)

public interface IEnumerable<out T>
{
    // T only appears in output positions
}

IEnumerable<Animal> animals = new List<Dog>();  // Valid
```

### Contravariance (in)

Parameter type can be more general.

```csharp
public interface IComparer<in T>
{
    int Compare(T x, T y);
}

IComparer<Dog> dogComparer = new AnimalComparer();
// OK because AnimalComparer can compare any Animal, including Dogs

public interface IEqualityComparer<in T>
{
    bool Equals(T x, T y);
    int GetHashCode(T obj);
}

IEqualityComparer<string> stringComparer = new ObjectComparer();
```

### Combined Variance

```csharp
public interface IConverter<in TInput, out TOutput>
{
    TOutput Convert(TInput input);
}

IConverter<Animal, string> converter = new DogToStringConverter();
// DogToStringConverter can accept Dog (more specific) for Animal
// and return string

// Func delegate is contravariant in input, covariant in output
Func<Animal, string> func = (Dog d) => d.Name;  // Valid
```

## Default Values

```csharp
public class Container<T>
{
    private T item = default!;

    public void Reset()
    {
        item = default!;  // null for reference, 0 for value types
    }

    public T GetOrDefault(Func<T> factory)
    {
        return item ?? factory();
    }
}

// default keyword
T defaultValue = default;  // Type inferred
T defaultValue2 = default(T);
```

## Static Members in Generics

Each closed generic type has its own static members.

```csharp
public class Counter<T>
{
    private static int count = 0;

    public Counter()
    {
        count++;
    }

    public static int Count => count;
}

var intCounter1 = new Counter<int>();
var intCounter2 = new Counter<int>();
var stringCounter = new Counter<string>();

Console.WriteLine(Counter<int>.Count);     // 2
Console.WriteLine(Counter<string>.Count);  // 1
```

## Static Abstract Members (C# 11)

Allow static members in interfaces.

```csharp
public interface IAdditionOperators<TSelf, TOther, TResult>
    where TSelf : IAdditionOperators<TSelf, TOther, TResult>
{
    static abstract TResult operator +(TSelf left, TOther right);
}

public interface INumber<T> where T : INumber<T>
{
    static abstract T Zero { get; }
    static abstract T One { get; }
    static abstract T operator +(T left, T right);
    static abstract T operator *(T left, T right);
}

// Generic math
public static T Sum<T>(IEnumerable<T> values) where T : INumber<T>
{
    T result = T.Zero;
    foreach (var value in values)
    {
        result = result + value;
    }
    return result;
}
```

## Common Generic Patterns

### Generic Factory

```csharp
public interface IFactory<T>
{
    T Create();
}

public class Factory<T> : IFactory<T> where T : new()
{
    public T Create() => new T();
}

// With dependency injection
public class ServiceFactory<T> where T : class
{
    private readonly IServiceProvider provider;

    public ServiceFactory(IServiceProvider provider)
    {
        this.provider = provider;
    }

    public T Create() => provider.GetRequiredService<T>();
}
```

### Generic Result Type

```csharp
public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }

    private Result(T value)
    {
        IsSuccess = true;
        Value = value;
    }

    private Result(string error)
    {
        IsSuccess = false;
        Error = error;
    }

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(string error) => new(error);

    public TResult Match<TResult>(
        Func<T, TResult> success,
        Func<string, TResult> failure)
    {
        return IsSuccess ? success(Value!) : failure(Error!);
    }
}

// Usage
Result<Customer> GetCustomer(int id)
{
    var customer = repository.Find(id);
    return customer != null
        ? Result<Customer>.Success(customer)
        : Result<Customer>.Failure($"Customer {id} not found");
}
```

### Generic Specifications

```csharp
public interface ISpecification<T>
{
    bool IsSatisfiedBy(T entity);
}

public class AndSpecification<T> : ISpecification<T>
{
    private readonly ISpecification<T> left;
    private readonly ISpecification<T> right;

    public AndSpecification(ISpecification<T> left, ISpecification<T> right)
    {
        this.left = left;
        this.right = right;
    }

    public bool IsSatisfiedBy(T entity) =>
        left.IsSatisfiedBy(entity) && right.IsSatisfiedBy(entity);
}

// Usage
public class ActiveCustomerSpec : ISpecification<Customer>
{
    public bool IsSatisfiedBy(Customer customer) => customer.IsActive;
}

public class PremiumCustomerSpec : ISpecification<Customer>
{
    public bool IsSatisfiedBy(Customer customer) => customer.TotalSpent > 1000;
}

var spec = new AndSpecification<Customer>(
    new ActiveCustomerSpec(),
    new PremiumCustomerSpec());

var premiumActive = customers.Where(c => spec.IsSatisfiedBy(c));
```

## Key Takeaways

**Use generics for type-safe reusability**: Avoid object-based collections and casts.

**Apply constraints to enable operations**: Constraints let you call methods on type parameters.

**Understand variance for flexibility**: Covariance (out) for return types, contravariance (in) for parameters.

**Avoid runtime type checks in generics**: If you need `if (typeof(T) == typeof(int))`, reconsider your design.

**Static abstract members enable generic math**: C# 11 allows truly generic numeric algorithms.

**Generic methods over generic classes**: When only one method needs the type parameter, make the method generic instead of the class.
