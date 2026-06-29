---
title: "C# Expression Trees"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "Building and manipulating code as data structures with expression trees for dynamic queries, metaprogramming, and runtime code generation."
tags: [c-sharp, dotnet, expression-trees, metaprogramming, linq, advanced]
---

## What Are Expression Trees

Expression trees represent code as data structures. Instead of executing immediately, the code is captured as a tree that can be analyzed, modified, or compiled.

```csharp
using System.Linq.Expressions;

// Lambda expression - executes immediately
Func<int, int> doubleFunc = x => x * 2;
int result = doubleFunc(5);  // 10

// Expression tree - captured as data
Expression<Func<int, int>> doubleExpr = x => x * 2;
// Can inspect: Parameter "x", Multiply operation, Constant 2

// Compile to function when ready
Func<int, int> compiled = doubleExpr.Compile();
int result2 = compiled(5);  // 10
```

## Why Expression Trees Matter

<div class="callout callout--note">
<p class="callout__title">Where You Use Expression Trees</p>
<p>If you've written <code>.Where(p => p.Age > 18)</code> with Entity Framework, you've used expression trees. EF Core translates that lambda into SQL because it's an expression tree, not executable code.</p>
</div>

Expression trees power:
- **LINQ to SQL/EF Core**: Translates C# queries to SQL
- **Dynamic queries**: Build queries at runtime
- **Serialization**: Send code across boundaries
- **Code generation**: Create optimized delegates
- **Mocking frameworks**: Capture method calls

```csharp
// EF Core translates this to SQL
var adults = dbContext.People
    .Where(p => p.Age >= 18)  // Expression<Func<Person, bool>>
    .OrderBy(p => p.Name)     // Expression<Func<Person, string>>
    .ToList();

// Generated SQL:
// SELECT * FROM People WHERE Age >= 18 ORDER BY Name
```

## Expression Tree Structure

### Anatomy of an Expression

```csharp
Expression<Func<int, int, int>> addExpr = (a, b) => a + b;

// Tree structure:
// LambdaExpression
// ├── Parameters: [a, b]
// └── Body: BinaryExpression (Add)
//     ├── Left: ParameterExpression (a)
//     └── Right: ParameterExpression (b)

// Inspect the tree
var lambda = (LambdaExpression)addExpr;
Console.WriteLine($"Parameters: {string.Join(", ", lambda.Parameters)}");
Console.WriteLine($"Body: {lambda.Body}");
Console.WriteLine($"Body Type: {lambda.Body.NodeType}");  // Add

var binary = (BinaryExpression)lambda.Body;
Console.WriteLine($"Left: {binary.Left}");   // a
Console.WriteLine($"Right: {binary.Right}"); // b
```

### Common Expression Types

| Type | Description | Example |
|------|-------------|---------|
| `ConstantExpression` | Literal value | `5`, `"hello"` |
| `ParameterExpression` | Parameter reference | `x` in `x => x + 1` |
| `BinaryExpression` | Two operands | `a + b`, `x > 5` |
| `UnaryExpression` | One operand | `-x`, `!flag` |
| `MemberExpression` | Property/field access | `person.Name` |
| `MethodCallExpression` | Method invocation | `str.ToUpper()` |
| `ConditionalExpression` | Ternary | `x > 0 ? x : -x` |
| `NewExpression` | Constructor call | `new Point(1, 2)` |
| `LambdaExpression` | Lambda definition | `x => x * 2` |

## Building Expressions Manually

### Simple Expressions

```csharp
// Build: x => x * 2
var param = Expression.Parameter(typeof(int), "x");
var constant = Expression.Constant(2);
var multiply = Expression.Multiply(param, constant);
var lambda = Expression.Lambda<Func<int, int>>(multiply, param);

Func<int, int> compiled = lambda.Compile();
Console.WriteLine(compiled(5));  // 10
```

### Property Access

```csharp
public class Person
{
    public string Name { get; set; } = "";
    public int Age { get; set; }
}

// Build: p => p.Name
var param = Expression.Parameter(typeof(Person), "p");
var property = Expression.Property(param, "Name");
var lambda = Expression.Lambda<Func<Person, string>>(property, param);

var getName = lambda.Compile();
var person = new Person { Name = "Alice" };
Console.WriteLine(getName(person));  // Alice
```

### Method Calls

```csharp
// Build: s => s.ToUpper()
var param = Expression.Parameter(typeof(string), "s");
var method = typeof(string).GetMethod("ToUpper", Type.EmptyTypes)!;
var call = Expression.Call(param, method);
var lambda = Expression.Lambda<Func<string, string>>(call, param);

var toUpper = lambda.Compile();
Console.WriteLine(toUpper("hello"));  // HELLO
```

### Complex Expressions

```csharp
// Build: (a, b) => a > 0 ? a + b : a - b
var a = Expression.Parameter(typeof(int), "a");
var b = Expression.Parameter(typeof(int), "b");

var condition = Expression.GreaterThan(a, Expression.Constant(0));
var ifTrue = Expression.Add(a, b);
var ifFalse = Expression.Subtract(a, b);
var conditional = Expression.Condition(condition, ifTrue, ifFalse);

var lambda = Expression.Lambda<Func<int, int, int>>(conditional, a, b);
var func = lambda.Compile();

Console.WriteLine(func(5, 3));   // 8
Console.WriteLine(func(-5, 3)); // -8
```

## Dynamic Query Building

### Building Where Clauses

```csharp
public static class QueryBuilder
{
    public static Expression<Func<T, bool>> BuildPredicate<T>(
        string propertyName,
        object value)
    {
        var param = Expression.Parameter(typeof(T), "x");
        var property = Expression.Property(param, propertyName);
        var constant = Expression.Constant(value);
        var equals = Expression.Equal(property, constant);

        return Expression.Lambda<Func<T, bool>>(equals, param);
    }
}

// Usage
var predicate = QueryBuilder.BuildPredicate<Person>("Name", "Alice");
var results = dbContext.People.Where(predicate).ToList();
```

### Combining Predicates

```csharp
public static class PredicateBuilder
{
    public static Expression<Func<T, bool>> And<T>(
        Expression<Func<T, bool>> left,
        Expression<Func<T, bool>> right)
    {
        var param = Expression.Parameter(typeof(T), "x");

        var leftBody = ReplaceParameter(left.Body, left.Parameters[0], param);
        var rightBody = ReplaceParameter(right.Body, right.Parameters[0], param);

        var combined = Expression.AndAlso(leftBody, rightBody);
        return Expression.Lambda<Func<T, bool>>(combined, param);
    }

    public static Expression<Func<T, bool>> Or<T>(
        Expression<Func<T, bool>> left,
        Expression<Func<T, bool>> right)
    {
        var param = Expression.Parameter(typeof(T), "x");

        var leftBody = ReplaceParameter(left.Body, left.Parameters[0], param);
        var rightBody = ReplaceParameter(right.Body, right.Parameters[0], param);

        var combined = Expression.OrElse(leftBody, rightBody);
        return Expression.Lambda<Func<T, bool>>(combined, param);
    }

    private static Expression ReplaceParameter(
        Expression expression,
        ParameterExpression oldParam,
        ParameterExpression newParam)
    {
        return new ParameterReplacer(oldParam, newParam).Visit(expression);
    }
}

// Usage
Expression<Func<Person, bool>> isAdult = p => p.Age >= 18;
Expression<Func<Person, bool>> hasEmail = p => p.Email != null;

var combined = PredicateBuilder.And(isAdult, hasEmail);
var results = dbContext.People.Where(combined).ToList();
```

### Dynamic OrderBy

```csharp
public static IQueryable<T> OrderByProperty<T>(
    this IQueryable<T> source,
    string propertyName,
    bool descending = false)
{
    var param = Expression.Parameter(typeof(T), "x");
    var property = Expression.Property(param, propertyName);
    var lambda = Expression.Lambda(property, param);

    string methodName = descending ? "OrderByDescending" : "OrderBy";

    var method = typeof(Queryable).GetMethods()
        .First(m => m.Name == methodName && m.GetParameters().Length == 2)
        .MakeGenericMethod(typeof(T), property.Type);

    return (IQueryable<T>)method.Invoke(null, new object[] { source, lambda })!;
}

// Usage
var sorted = dbContext.People
    .OrderByProperty("Name")
    .ToList();
```

## Expression Visitors

### Traversing and Modifying Trees

```csharp
public class ParameterReplacer : ExpressionVisitor
{
    private readonly ParameterExpression _oldParam;
    private readonly ParameterExpression _newParam;

    public ParameterReplacer(ParameterExpression oldParam, ParameterExpression newParam)
    {
        _oldParam = oldParam;
        _newParam = newParam;
    }

    protected override Expression VisitParameter(ParameterExpression node)
    {
        return node == _oldParam ? _newParam : base.VisitParameter(node);
    }
}
```

### Query Analysis

```csharp
public class MemberAccessVisitor : ExpressionVisitor
{
    public List<string> AccessedMembers { get; } = new();

    protected override Expression VisitMember(MemberExpression node)
    {
        AccessedMembers.Add(node.Member.Name);
        return base.VisitMember(node);
    }
}

// Usage - find all properties accessed in a query
Expression<Func<Person, bool>> expr = p => p.Age > 18 && p.Name.StartsWith("A");
var visitor = new MemberAccessVisitor();
visitor.Visit(expr);
// AccessedMembers: ["Age", "Name"]
```

### Expression Transformation

```csharp
// Convert property access to dictionary lookup
public class PropertyToDictVisitor : ExpressionVisitor
{
    private readonly ParameterExpression _dictParam;

    public PropertyToDictVisitor(ParameterExpression dictParam)
    {
        _dictParam = dictParam;
    }

    protected override Expression VisitMember(MemberExpression node)
    {
        if (node.Expression is ParameterExpression)
        {
            // Convert p.Name to dict["Name"]
            var key = Expression.Constant(node.Member.Name);
            var indexer = typeof(Dictionary<string, object>)
                .GetProperty("Item")!;
            return Expression.MakeIndex(_dictParam, indexer, new[] { key });
        }
        return base.VisitMember(node);
    }
}
```

## Compiled Expressions for Performance

### Caching Compiled Delegates

<div class="callout callout--warning">
<p class="callout__title">Compile() Is Expensive</p>
<p>Compiling an expression tree to a delegate is slow, much slower than reflection. Always cache the compiled result when the same expression will be used repeatedly.</p>
</div>

```csharp
public static class PropertyAccessor<T>
{
    private static readonly ConcurrentDictionary<string, Func<T, object?>> Getters = new();

    public static Func<T, object?> GetGetter(string propertyName)
    {
        return Getters.GetOrAdd(propertyName, CreateGetter);
    }

    private static Func<T, object?> CreateGetter(string propertyName)
    {
        var param = Expression.Parameter(typeof(T), "x");
        var property = Expression.Property(param, propertyName);
        var converted = Expression.Convert(property, typeof(object));
        var lambda = Expression.Lambda<Func<T, object?>>(converted, param);
        return lambda.Compile();
    }
}

// Usage - much faster than reflection after first call
var getter = PropertyAccessor<Person>.GetGetter("Name");
var name = getter(person);
```

### Fast Property Setters

```csharp
public static class PropertySetter<T>
{
    private static readonly ConcurrentDictionary<string, Action<T, object?>> Setters = new();

    public static Action<T, object?> GetSetter(string propertyName)
    {
        return Setters.GetOrAdd(propertyName, CreateSetter);
    }

    private static Action<T, object?> CreateSetter(string propertyName)
    {
        var param = Expression.Parameter(typeof(T), "x");
        var valueParam = Expression.Parameter(typeof(object), "value");
        var property = Expression.Property(param, propertyName);
        var converted = Expression.Convert(valueParam, property.Type);
        var assign = Expression.Assign(property, converted);
        var lambda = Expression.Lambda<Action<T, object?>>(assign, param, valueParam);
        return lambda.Compile();
    }
}
```

## Practical Examples

### Generic Mapper

```csharp
public static class Mapper<TSource, TDest> where TDest : new()
{
    private static readonly Func<TSource, TDest> MapFunc = CreateMapper();

    private static Func<TSource, TDest> CreateMapper()
    {
        var sourceParam = Expression.Parameter(typeof(TSource), "src");
        var bindings = new List<MemberBinding>();

        foreach (var destProp in typeof(TDest).GetProperties())
        {
            var sourceProp = typeof(TSource).GetProperty(destProp.Name);
            if (sourceProp != null && sourceProp.PropertyType == destProp.PropertyType)
            {
                var sourceAccess = Expression.Property(sourceParam, sourceProp);
                bindings.Add(Expression.Bind(destProp, sourceAccess));
            }
        }

        var newExpr = Expression.New(typeof(TDest));
        var memberInit = Expression.MemberInit(newExpr, bindings);
        var lambda = Expression.Lambda<Func<TSource, TDest>>(memberInit, sourceParam);

        return lambda.Compile();
    }

    public static TDest Map(TSource source) => MapFunc(source);
}

// Usage
var dto = Mapper<Person, PersonDto>.Map(person);
```

### Specification Pattern

```csharp
public abstract class Specification<T>
{
    public abstract Expression<Func<T, bool>> ToExpression();

    public bool IsSatisfiedBy(T entity)
    {
        return ToExpression().Compile()(entity);
    }

    public Specification<T> And(Specification<T> other)
    {
        return new AndSpecification<T>(this, other);
    }

    public Specification<T> Or(Specification<T> other)
    {
        return new OrSpecification<T>(this, other);
    }
}

public class AndSpecification<T> : Specification<T>
{
    private readonly Specification<T> _left;
    private readonly Specification<T> _right;

    public AndSpecification(Specification<T> left, Specification<T> right)
    {
        _left = left;
        _right = right;
    }

    public override Expression<Func<T, bool>> ToExpression()
    {
        return PredicateBuilder.And(_left.ToExpression(), _right.ToExpression());
    }
}

// Concrete specifications
public class AdultSpecification : Specification<Person>
{
    public override Expression<Func<T, bool>> ToExpression()
        => p => p.Age >= 18;
}

// Usage
var spec = new AdultSpecification()
    .And(new HasEmailSpecification());
var results = dbContext.People.Where(spec.ToExpression()).ToList();
```

## Limitations and Considerations

### What Can't Be in Expression Trees

```csharp
// These compile as Func, not Expression:

// Dynamic
Expression<Func<dynamic, int>> bad1 = d => d.Value;  // Error

// Out/ref parameters
Expression<Action<out int>> bad2 = (out int x) => x = 1;  // Error

// Named/optional parameters
Expression<Func<int>> bad3 = () => Method(name: "test");  // Error in some cases

// Async lambdas
Expression<Func<Task<int>>> bad4 = async () => await Task.FromResult(1);  // Error

// Statements (only expressions allowed)
Expression<Action> bad5 = () => { var x = 1; };  // Error
```

### Performance Notes

```csharp
// Compile() is expensive - cache results
// BAD: Compiles every call
public bool Check(Expression<Func<Person, bool>> expr, Person p)
{
    return expr.Compile()(p);  // Slow!
}

// GOOD: Cache compiled delegate
private readonly ConcurrentDictionary<Expression, Delegate> _cache = new();

public bool CheckCached(Expression<Func<Person, bool>> expr, Person p)
{
    var compiled = (Func<Person, bool>)_cache.GetOrAdd(
        expr,
        e => ((Expression<Func<Person, bool>>)e).Compile());
    return compiled(p);
}
```

## Key Takeaways

**Code as data**: Expression trees let you inspect and manipulate code structure at runtime.

**LINQ translation**: They're how EF Core and other providers translate C# to SQL.

**Cache compiled delegates**: `Compile()` is expensive. Cache results for repeated use.

**Use ExpressionVisitor**: The standard way to traverse and transform expression trees.

**Prefer lambdas when possible**: Manual tree building is verbose. Use `Expression<Func<>>` from lambdas when the expression is known at compile time.

**Limitations exist**: Async, out parameters, statements, and some language features aren't supported.
