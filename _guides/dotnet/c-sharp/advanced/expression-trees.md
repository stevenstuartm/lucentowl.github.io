---
title: "C# Expression Trees"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "Expression trees as code represented as data: how a lambda becomes an Expression, what the tree looks like, building and combining predicates for IQueryable providers, rewriting trees with ExpressionVisitor, compiling to delegates and what that costs, the C# constructs a tree can't hold, and behaviour under Native AOT."
tags: [expression-trees, system-linq-expressions, expressionvisitor, iqueryable, metaprogramming, native-aot, advanced]
---

## Code as Data

The same lambda can become two different things, depending on the type it's assigned to:

```csharp
using System.Linq.Expressions;

Func<int, int> doubler = x => x * 2;                // Compiled to IL; can only be called
Expression<Func<int, int>> doublerTree = x => x * 2; // Built as a tree of objects; can be read

doubler(5);                                  // 10
doublerTree.Body.NodeType;                   // Multiply
doublerTree.Compile()(5);                    // 10, after turning the tree into a delegate
```

For `Expression<TDelegate>`, the compiler emits code that constructs a tree of objects describing the lambda: a parameter `x`, a multiplication, a constant `2`. Code that receives the tree can inspect it, rewrite it, translate it into another language, or compile it into a delegate at run time.

That is how LINQ providers work. `Queryable.Where` takes an `Expression<Func<T, bool>>`, not a `Func<T, bool>`, so EF Core receives a description of the filter and translates it to SQL:

```csharp
var adults = db.People
    .Where(p => p.Age >= 18)
    .OrderBy(p => p.Name)
    .ToList();

// Translated to SQL along the lines of:
// SELECT ... FROM "People" AS "p" WHERE "p"."Age" >= 18 ORDER BY "p"."Name"
```

The same mechanism lets mocking libraries read `mock.Setup(x => x.GetUser(42))` as a description of a call rather than making one, and lets validation and mapping libraries learn a property's name from `x => x.Email` without a string.

## The Shape of a Tree

`(a, b) => a + b` becomes this structure:

```
Expression<Func<int, int, int>>
├── Parameters: a, b                  ParameterExpression
└── Body: Add                         BinaryExpression
    ├── Left:  a                      ParameterExpression (the same object as in Parameters)
    └── Right: b                      ParameterExpression
```

Every node derives from `Expression` and has a `NodeType` and a `Type`. The ones you meet most:

| Node | Represents | Example |
|---|---|---|
| `ParameterExpression` | A lambda parameter or local variable | `x` in `x => x + 1` |
| `ConstantExpression` | A literal value | `18`, `"Alice"` |
| `MemberExpression` | A field or property read | `p.Name`, or a captured variable |
| `BinaryExpression` | Two operands | `a + b`, `x >= 18`, `a && b` |
| `UnaryExpression` | One operand, including conversions | `-x`, `!flag`, `(object)x` |
| `MethodCallExpression` | A method call | `s.StartsWith("A")` |
| `ConditionalExpression` | A ternary | `x > 0 ? x : -x` |
| `NewExpression`, `MemberInitExpression` | Construction, with initializers | `new Dto { Name = p.Name }` |
| `LambdaExpression` | The lambda itself | The root of every tree above |

**Parameters are matched by object identity, not by name.** The `a` in the body must be the same `ParameterExpression` instance as the `a` in `Parameters`. Two parameters both named `x` are unrelated, which is the source of most bugs when combining trees.

**A captured variable is not a constant.** In `p => p.Name == name`, the compiler hoists `name` into a closure object, and the tree reads it as a `MemberExpression` on a `ConstantExpression` holding that closure. The difference reaches the database: EF Core sends a captured variable as a SQL parameter (`WHERE "p"."Name" = @name`), while an `Expression.Constant("Alice")` built by hand is inlined as a literal (`WHERE "p"."Name" = 'Alice'`). Literals mean a different SQL text, and a separate cached query plan, for every value.

## Building Trees by Hand

The `Expression` factory methods build any node directly. The result is a tree the compiler would have produced from the equivalent lambda:

```csharp
// p => p.Age >= 18
ParameterExpression p = Expression.Parameter(typeof(Person), "p");
Expression body = Expression.GreaterThanOrEqual(
    Expression.Property(p, nameof(Person.Age)),
    Expression.Constant(18));

var isAdult = Expression.Lambda<Func<Person, bool>>(body, p);
```

The factory methods check types as the tree is built, not when it runs. `Expression.Property(p, "Nope")` throws `ArgumentException`, and `Expression.Equal` between an `int?` property and an `int` constant throws `InvalidOperationException`, because no `==` operator exists for that pair. Convert explicitly with `Expression.Convert(constant, property.Type)`.

Hand-built trees are worth their verbosity only when the shape isn't known until run time, such as a filter or sort chosen by the user. When the shape is known, write the lambda and let the compiler build the tree.

### Filtering and Sorting on a Property Chosen at Run Time

```csharp
public static IQueryable<T> WhereEquals<T>(this IQueryable<T> source, string propertyName, object? value)
{
    ParameterExpression x = Expression.Parameter(typeof(T), "x");
    MemberExpression property = Expression.Property(x, propertyName);

    // Captured through a closure so a provider sends it as a parameter, not a literal
    Expression<Func<object?>> captured = () => value;
    Expression typedValue = Expression.Convert(captured.Body, property.Type);

    return source.Where(Expression.Lambda<Func<T, bool>>(Expression.Equal(property, typedValue), x));
}

public static IQueryable<T> OrderByProperty<T>(this IQueryable<T> source, string propertyName, bool descending = false)
{
    ParameterExpression x = Expression.Parameter(typeof(T), "x");
    MemberExpression property = Expression.Property(x, propertyName);

    MethodCallExpression call = Expression.Call(
        typeof(Queryable),
        descending ? nameof(Queryable.OrderByDescending) : nameof(Queryable.OrderBy),
        [typeof(T), property.Type],
        source.Expression,
        Expression.Quote(Expression.Lambda(property, x)));

    return source.Provider.CreateQuery<T>(call);
}
```

`OrderByProperty` builds the call to `Queryable.OrderBy` itself, because the key type is known only at run time. `Expression.Call` with a type and method name finds the right generic overload, and `Expression.Quote` marks the key selector as a tree, the way the compiler does when it passes a lambda to a `Queryable` method. Against EF Core on SQLite, `OrderByProperty("Name", descending: true)` produced `ORDER BY "p"."Name" DESC`.

When the property name comes from a request, check it against an allowlist first. Otherwise any public property, including ones that were never meant to be filterable, is reachable, and an unknown name surfaces as an `ArgumentException` from deep in the query.

### Combining Predicates

Filters built from optional search fields are combined with `AndAlso` or `OrElse`. The two lambdas each have their own parameter, so one must be rewritten to use the other's before the bodies can share a lambda:

```csharp
public static class PredicateBuilder
{
    public static Expression<Func<T, bool>> And<T>(this Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
    {
        Expression rightBody = new ParameterReplacer(right.Parameters[0], left.Parameters[0]).Visit(right.Body);
        return Expression.Lambda<Func<T, bool>>(Expression.AndAlso(left.Body, rightBody), left.Parameters);
    }

    public static Expression<Func<T, bool>> Or<T>(this Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
    {
        Expression rightBody = new ParameterReplacer(right.Parameters[0], left.Parameters[0]).Visit(right.Body);
        return Expression.Lambda<Func<T, bool>>(Expression.OrElse(left.Body, rightBody), left.Parameters);
    }
}

Expression<Func<Person, bool>> filter = p => true;
if (minAge is not null) filter = filter.And(p => p.Age >= minAge);
if (emailRequired) filter = filter.And(p => p.Email != null);

var results = await db.People.Where(filter).ToListAsync();
```

Skipping the replacement and just joining `left.Body` with `right.Body` produces a tree whose body refers to a parameter the lambda doesn't declare. Compiling it throws `InvalidOperationException` ("variable 'p' of type 'Person' referenced from scope '', but it is not defined"), and EF Core rejects it with an `InvalidOperationException` of its own.

## Rewriting Trees with ExpressionVisitor

`ExpressionVisitor` walks a tree and rebuilds any node whose children changed, leaving the rest shared. Override the `Visit*` method for the node type you care about:

```csharp
public sealed class ParameterReplacer(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
{
    protected override Expression VisitParameter(ParameterExpression node) =>
        node == from ? to : base.VisitParameter(node);
}
```

Trees are immutable, so a visitor never modifies its input. It returns a new tree, or the same instance if nothing changed.

Visitors also analyze. This one lists the properties a predicate reads, which a caching layer could use to decide which changes invalidate a result:

```csharp
public sealed class MemberCollector : ExpressionVisitor
{
    public List<string> Members { get; } = [];

    protected override Expression VisitMember(MemberExpression node)
    {
        if (node.Expression is ParameterExpression)
            Members.Add(node.Member.Name);
        return base.VisitMember(node);
    }
}

var collector = new MemberCollector();
collector.Visit((Expression<Func<Person, bool>>)(p => p.Age > 18 && p.Name.StartsWith("A")));
// collector.Members: Age, Name
```

A replacement node must have a compatible `Type`. Swapping a `string` property for an `object`-typed dictionary lookup makes the parent node, such as a `StartsWith` call, throw `ArgumentException` when the visitor rebuilds it.

## Compiling Trees to Delegates

`Compile()` turns a tree into a delegate, which is the other main use: generating fast accessors for types known only at run time, as serializers, mappers, and ORMs do.

```csharp
public static class PropertyGetter<T>
{
    private static readonly ConcurrentDictionary<string, Func<T, object?>> Cache = new();

    public static Func<T, object?> For(string propertyName) =>
        Cache.GetOrAdd(propertyName, static name =>
        {
            ParameterExpression x = Expression.Parameter(typeof(T), "x");
            Expression body = Expression.Convert(Expression.Property(x, name), typeof(object));
            return Expression.Lambda<Func<T, object?>>(body, x).Compile();
        });
}
```

Measured on .NET 10:

| Operation | Cost |
|---|---|
| First `Compile()` in the process | About 5 ms, mostly JIT-compiling the expression compiler itself |
| Each later `Compile()` of a small tree | About 50 µs |
| Calling the compiled delegate | About 5 ns |
| `PropertyInfo.GetValue` on the same property | About 12 ns |
| Calling an interpreted delegate (`Compile(preferInterpretation: true)`) | About 90 ns |

Two conclusions follow. Compile once and cache the delegate, since compiling costs about ten thousand calls. And the gap over reflection is smaller than it once was. Current reflection is only a few times slower than a compiled delegate, so compiling pays off only for accessors called very often.

### Cache by Your Own Key, Not by the Tree

Expression trees compare by reference. The same lambda evaluated twice produces two distinct tree objects, because the compiler emits construction code that runs every time:

```csharp
Expression<Func<Person, bool>> Make() => p => p.Age >= 18;
ReferenceEquals(Make(), Make());   // false, and Equals is reference equality too
```

A `ConcurrentDictionary<Expression, Delegate>` cache therefore never hits. Worse, it adds an entry on every call and grows until the process runs out of memory. Key the cache on something you control, like the property name above, a type, or an explicit string.

### Native AOT

Under Native AOT there's no JIT to compile new code at run time, so `Compile()` doesn't throw. It falls back to the interpreter, and returns a delegate that behaves identically at interpreter speed, in the measurement above about 17 times slower to call. Code that relies on compiled trees for speed, like a hand-written mapper or accessor cache, gets slower after AOT publishing with no error. For those cases a source generator produces the accessors at build time instead. Trees passed to a LINQ provider are unaffected, since the provider translates them rather than compiling them.

## What a Tree Can't Contain

Expression trees date from C# 3, and many later language features can't be represented. Each is a compile error when the lambda is converted to an `Expression`, not a silent fallback. Tested with the .NET 10 compiler:

| Construct | Error |
|---|---|
| A statement body `{ ... }` | CS0834 |
| Assignment, `x = 5` | CS0832 |
| `async` lambdas | CS1989 |
| `dynamic` operations | CS1963 |
| Null-conditional `?.` | CS8072 |
| Pattern matching with `is`, including `is null` and `is > 1 and < 5` | CS8122 |
| Switch expressions | CS8514 |
| Throw expressions | CS8188 |
| Tuple literals | CS8143 |
| `with` expressions | CS8849 |
| `^` and `..` indexers | CS8790 |
| Collection expressions `[1, 2]` | CS9175 |

Several constructs that look recent do work: `??`, string interpolation, a plain type test such as `o is string`, and calls that use named or omitted optional arguments. The usual fix for the rest is the older form of the same thing: `x == null` instead of `x is null`, a ternary instead of a switch expression, `p.Name == null ? null : p.Name.Length` instead of `p.Name?.Length`.

The `Expression` API itself is broader than the lambdas C# converts. `Expression.Block`, `Expression.Assign`, `Expression.Loop`, and `Expression.TryCatch` build statement trees that compile to delegates. A LINQ provider generally can't translate them, so they're for code generation, not queries.

## Key Takeaways

**An `Expression<TDelegate>` is a description of code, not code.** LINQ providers, mocking libraries, and mappers read it rather than run it.

**Parameters match by identity.** Rewrite one lambda's parameter with an `ExpressionVisitor` before combining bodies.

**Capture values through a closure, not `Expression.Constant`,** so providers send them as parameters.

**Compile once, cache by a key you own, and measure.** Trees compare by reference, and compiled delegates are only a few times faster than current reflection.

**Under Native AOT, `Compile()` interprets.** Nothing fails, and delegate calls become many times slower.

**Allowlist property names from user input** before building trees from them.
