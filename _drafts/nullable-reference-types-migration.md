---
layout: post
title: "C# Nullable Reference Types Are a Migration, Not a Feature"
description: "C# nullable reference types check only the code the compiler can see, so the suppressions that stall a migration collect where data enters, in deserialized DTOs, EF Core entities, and unannotated libraries. Finishing the migration means deciding, boundary by boundary, who enforces non-null."
tags: [csharp, dotnet, nullable-reference-types, software-design, technical-debt]
author: steven-stuart
sources:
  - title: "C# reference: ! (null-forgiving) operator"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/null-forgiving"
  - title: "ASP.NET Core: Model validation"
    url: "https://learn.microsoft.com/en-us/aspnet/core/mvc/models/validation"
  - title: "System.Text.Json: Respect nullable annotations"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/nullable-annotations"
  - title: "EF Core: Working with nullable reference types"
    url: "https://learn.microsoft.com/en-us/ef/core/miscellaneous/nullable-reference-types"
  - title: "Mads Torgersen: Embracing nullable reference types (.NET Blog, 2019)"
    url: "https://devblogs.microsoft.com/dotnet/embracing-nullable-reference-types/"
  - title: "C#: Nullable migration strategies"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/update-applications/nullable-migration-strategies"
  - title: "dotnet/runtime issue #41720: nullable annotations throughout netcoreapp"
    url: "https://github.com/dotnet/runtime/issues/41720"
  - title: "System.Text.Json: Require properties for deserialization"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/required-properties"
---

You turned on nullable reference types. Then you told the compiler to trust you 400 times.

Nobody sets out to write 400 of them. Someone adds `<Nullable>enable</Nullable>` to the project file, the build lights up with thousands of warnings, and the team spends a sprint making them go away. Most fixes are honest: a `?` on a return that can come back empty, a guard clause, a constructor that finally sets its fields. But a stubborn remainder won't yield to any change inside the method, and those get a `!` or a `= null!` so the build can go green. A year later the annotations are still there, few people trust them, and new code tends to pick up `!` from the code around it.

> **AUTHOR** — the author's experience goes here: a .NET codebase where nullable reference types were switched on, where the suppressions accumulated, and what the team found when it looked at them.

The stall follows from how the feature works. Nullable reference types check the code the compiler can see, so the warnings no local fix can clear arise where data comes from somewhere the compiler can't see: a JSON body, a database row, a library compiled without annotations. A `!` at one of those boundaries doesn't fix a warning. It records a null contract that nobody decided. Enabling the feature is a compiler switch, but adopting it is a migration, and the unit of work is each boundary's contract, not each warning.

## The Compiler Checks Only the Code It Compiles

Nullable reference types are a compile-time contract. `string` and `string?` compile to the same type, the annotations become metadata, and the runtime enforces nothing. The C# reference is plain about the null-forgiving operator in particular: it "has no effect at run time" and only changes the compiler's view of the expression. A `!` generates no check. If the value is null, the program throws later, wherever it's first dereferenced.

Inside a method, the flow analysis is thorough. It follows every branch, every early return, and every pattern match, and when it warns, the fix is usually local: check for null, restructure the flow, or add an attribute like `NotNullWhen` so the analysis can follow a helper method. Warnings of that kind tend to get fixed during the migration sprint, because the compiler can see the fix working.

The analysis has blind spots: callers outside the compilation, reflection, deserializers, array elements, unannotated code, and suppressions themselves. Set aside array elements and suppressions, and every item on that list is a boundary, a place where a value is created by code the compiler never analyzed. Nothing inside the method can clear a warning that starts there, so that's where a team in a hurry reaches for `!`.

## The Suppressions Pile Up Where Data Enters

In a line-of-business .NET service, those blind spots show up at three boundaries. Each one has its own contract that the switch left undecided.

### Request DTOs: The Contract Depends on the Framework

A request DTO is the first thing the migration breaks:

```csharp
public class CreateOrderRequest
{
    public string CustomerId { get; set; }   // CS8618: non-nullable property is uninitialized
    public string? Notes { get; set; }
}
```

The compiler is right to warn. Nothing in this class guarantees `CustomerId` is set, because the object is built by a serializer, not by a constructor the compiler can check. The quick fix is `= null!`, which silences CS8618 and changes nothing else. The type now claims `CustomerId` is never null, and whether that's true depends entirely on configuration the compiler never sees.

That configuration varies by framework. ASP.NET Core MVC model validation, once the nullable context is on, treats every non-nullable bound property as if it carried `[Required(AllowEmptyStrings = true)]`, so a missing `CustomerId` becomes a validation error before the action runs. System.Text.Json, used directly, ignores the annotations by default. .NET 9 added an opt-in, `RespectNullableAnnotations`, and even with it on, an explicit `"CustomerId": null` throws while a missing `CustomerId` deserializes to null without complaint. Microsoft's documentation says the serializer treats required and non-nullable as orthogonal, and points to the `required` modifier or `[JsonRequired]` for presence.

So the same `= null!` can be true behind an MVC controller and false in a message consumer that calls `JsonSerializer.Deserialize` on a queue payload. The suppression looks identical in both places. The contract differs, and the annotation can't tell you which one you have.

### EF Core Entities: The Vendor Prescribes `null!`

Of the three, EF Core is the boundary where the vendor's own documentation prescribes the suppression. For navigation properties that constructor binding can't initialize, EF Core's guidance on nullable reference types says to initialize the property to null with the null-forgiving operator:

```csharp
public Product Product { get; set; } = null!;
```

That is an honest instruction, and the same page explains what the claim means. A required navigation property is non-null only if the query that loaded the entity included it. The documentation frames the choice as a contract. Make the navigation non-nullable if accessing it unloaded is a programmer error, and nullable if code legitimately checks whether it was loaded. For teams that want the first contract enforced, it offers a nullable backing field whose getter throws `InvalidOperationException` when the navigation wasn't loaded.

The switch also changes the database. EF Core configures a non-nullable reference type property as required, and the documentation warns that enabling nullable reference types on an existing project can generate migrations that alter column nullability. A property that was optional yesterday can become a `NOT NULL` column in the next generated migration because a compiler setting changed. Whatever the team decides about `string` versus `string?` on an entity is a schema decision, whether or not anyone made it deliberately.

Not every `!` near EF Core carries this weight. The same documentation shows `!` inside query lambdas like `.Where(o => o.OptionalInfo!.SomeProperty == "foo")`, where the expression is translated to SQL and never runs as C#. That suppression tells the compiler something true about a query provider it can't model, and it costs nothing at run time. It belongs in a different pile from `= null!` on the entity itself.

### Unannotated Libraries: Nulls With No Warning

Oblivious code, a library compiled without annotations, produces no warnings at all. Assigning its return value to `string` is silent, and so is dereferencing it. This boundary shows up less in a `!` count than in what the count misses: values the team treated as non-null because nothing said otherwise.

Mads Torgersen's 2019 post "Embracing nullable reference types" warned about the other side of this. Code that adopts the feature before its dependencies do gets "some churn" as those libraries come online with their annotations. Each new package version can move a boundary from silent to noisy, and a team that treats the migration as done will meet those warnings as regressions rather than as contracts to decide.

## A Suppression Postpones the Crash, and a Default Hides It

When a team wants to keep the type non-nullable, the two quickest fixes for CS8618 are `= null!` and `= ""`, and they fail differently.

`= null!` leaves null in place. If a request arrives without a `CustomerId` and nothing at the boundary rejects it, the code throws a `NullReferenceException` somewhere downstream, at the first dereference. That crash is loud, but it happens in the wrong place. The stack trace points at a pricing rule or a log statement, not at the deserializer that let null in, and the type signature along the way insisted null was impossible.

`= ""` is worse. The missing `CustomerId` becomes an empty string, passes every non-null check, and flows into lookups, logs, and records as a value that looks valid. Behind an MVC controller it even defeats the implicit validation, because the inferred `[Required(AllowEmptyStrings = true)]` accepts the empty string the default supplied. Nothing crashes. The error surfaces later as a customer record with a blank ID, if it surfaces at all. A default chosen to satisfy the compiler becomes a default nobody chose for the data.

What a team wants is null rejected at the boundary, loudly, with an error that names the cause. The suppression moves the crash away from its cause, and the default removes it. Both leave the boundary's contract unwritten, and a boundary without a written contract is the place a null-safety feature can't help.

## The Unit of Migration Is a Boundary Contract

### Sequencing Handles the Volume

Microsoft's own guide to migrating an existing codebase treats adoption as sequencing, not switching. It describes choosing a default context, enabling warnings or annotations file by file from the leaves of the dependency graph outward, and converging on `<Nullable>enable</Nullable>` with no `#nullable` directives left. Its definition of done includes removing the `null!` and `default!` initializers added only to silence warnings during migration, and replacing them with real initialization or a nullable type.

The .NET team treated its own libraries as a migration too. Jeff Handley's tracking issue in the dotnet/runtime repository records that across .NET Core 3.0 and .NET 5.0, the team annotated 94% of the `netcoreapp` assemblies, and it opened a new plan for the remainder in .NET 6 and 7. That's two major releases for most of the base class library, done as a deliberate project with an owner and a tracking issue.

### Each Boundary Needs a Named Enforcer

File-by-file sequencing handles the volume, but the decisions happen at the boundaries. For each place data enters, the team decides one thing and writes it down in code: **who enforces non-null here?**

- **The boundary does.** The value is rejected before it's constructed. The tools include `required` members or constructor parameters, `required` plus `RespectNullableAnnotations` for System.Text.Json, MVC's implicit validation, or `ArgumentNullException.ThrowIfNull` at a public entry point. The type can then say `string` honestly.
- **Nobody does, because null is valid.** The type says `string?`, and every consumer handles absence. This is the right answer more often than a migration under deadline admits.
- **The framework does, conditionally.** EF Core navigations are the standard case. Decide whether an unloaded access is a bug, and if it is, make it throw with a message rather than letting a `null!` pass it along.

For the request DTO above, the first choice looks like this:

```csharp
public class CreateOrderRequest
{
    public required string CustomerId { get; init; }
    public string? Notes { get; init; }
}
```

The `required` modifier makes the compiler enforce construction in code, and System.Text.Json's documentation on required properties says the serializer treats it exactly like `[JsonRequired]`, so a payload without `CustomerId` fails deserialization with a `JsonException`. That covers a missing property but not an explicit `"CustomerId": null`, which `required` lets through. Turning on `RespectNullableAnnotations` closes that second gap, and together the two settings make the boundary reject both ways null can arrive. Only then can every consumer downstream trust the `string`, and that is the difference between an annotation that means something and one that's decoration.

## Suppressions Spread Evenly Point to a Different Problem

This argument predicts where suppressions collect, and no published study has measured it, so treat the prediction as something to check against your own code. If a codebase has many of them spread evenly through business logic, far from any boundary, the cause is different. Those suppressions usually mark places where the analysis can't follow a helper method, and the nullability attributes like `NotNullWhen`, `MemberNotNull`, and `NotNull` exist for exactly that. They're a local cleanup, not a contract decision, and they don't need a migration plan. The count tells you which problem you have.

## Count What You've Told the Compiler

This week, search your solution for the null-forgiving operator and the `#nullable disable` directive, and sort every hit by where it sits:

- **Request and message DTOs.** For each `= null!`, find what rejects a missing value before the object reaches your code. If nothing does, choose between `required` and `string?`.
- **EF Core entities.** Separate `!` inside query lambdas, which is harmless, from `= null!` on navigation properties. For each navigation, decide whether an unloaded access is a bug, and make it throw if it is.
- **Wrappers around unannotated libraries.** Check whether the values you take from them are declared `string?` at the point they enter your code.
- **Everything else.** Most of these mark a helper method the analysis can't follow. Look for an attribute like `NotNullWhen` or `MemberNotNull` that lets it.
- **`#nullable disable` directives.** Each one is a file still waiting for its migration. List them, with an owner.

Then add `<WarningsAsErrors>nullable</WarningsAsErrors>` once the list is short enough to finish, so the count can only go down. The number you found is not a measure of how badly the feature went. It's the list of null contracts your system has been running on without anyone deciding them.
