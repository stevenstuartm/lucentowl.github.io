---
title: "C# Source Generators"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "Compile-time code generation for boilerplate reduction, performance optimization, and metaprogramming without runtime reflection."
tags: [c-sharp, dotnet, source-generators, metaprogramming, compilation, advanced]
---

## The Problem Source Generators Solve

Programming involves a lot of repetitive code. Consider these common scenarios:

- Writing `ToString()` methods that list every property
- Creating serialization logic that converts objects to and from JSON
- Implementing `INotifyPropertyChanged` with the same pattern for every property
- Registering dozens of service classes with dependency injection
- Writing HTTP client methods that follow identical patterns

Developers have traditionally solved this repetition in two ways, and both have significant drawbacks.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Hand-Written Boilerplate</h4>
<ul>
<li>Tedious and error-prone</li>
<li>Maintenance burden grows</li>
<li>Easy to forget updates</li>
<li>No runtime cost</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Runtime Reflection</h4>
<ul>
<li>Automatic and convenient</li>
<li>No code to maintain</li>
<li>Always stays synchronized</li>
<li>Slow startup and execution</li>
</ul>
</div>
</div>

**Approach 1: Write it by hand.** This is tedious, error-prone, and creates maintenance burden. When you add a property to a class, you have to remember to update the `ToString()`, the serialization logic, and everywhere else that needs to know about it.

**Approach 2: Use reflection at runtime.** Your program can inspect itself while running, discovering what properties a class has, what attributes are applied, and so on. This works, but reflection is slow. Every time your program runs, it spends time figuring out what it could have known at compile time.

Source generators offer a third approach: **generate the repetitive code automatically at compile time**. The compiler runs your generator, which examines your code and writes additional C# source files. These generated files compile alongside your handwritten code, producing a final program with no runtime overhead.

## Why This Matters

Understanding source generators matters for three reasons:

**Performance without sacrifice.** Reflection-based approaches like traditional JSON serialization or dependency injection scanning have measurable runtime costs. Source generators eliminate this cost entirely. The generated code is identical to what you would write by hand, and the compiler cannot tell the difference.

**You already use them.** If you use `System.Text.Json` with the `[JsonSerializable]` attribute, regex with `[GeneratedRegex]`, or high-performance logging with `[LoggerMessage]`, you're using source generators. Understanding how they work helps you use these features effectively and debug issues when they arise.

**AOT compilation requires them.** Ahead-of-time (AOT) compiled applications cannot use runtime reflection in the same way. If you're building for platforms that require AOT (like iOS, or .NET Native AOT deployment), source generators become essential rather than optional.

## How Source Generators Work

Before diving into specific generators, understanding the underlying mechanism helps everything else make sense.

When you compile a C# project, the compiler goes through several phases: parsing your source files into syntax trees, building a semantic model that understands types and symbols, and finally generating IL code. Source generators plug into this pipeline between the semantic analysis and code generation phases.

```
Your Code → Parse → Semantic Analysis → [Source Generators Run Here] → Code Generation → Assembly
```

A source generator receives read-only access to everything the compiler knows about your code: every class, method, property, and attribute. It analyzes this information and emits new C# source files. These generated files then get compiled alongside your original code as if you had written them yourself.

Two constraints shape how generators work:

<div class="callout callout--note">
<p class="callout__title">Generators Add, Never Modify</p>
<p>Source generators cannot change your existing code. They can only create new files. This is why <code>partial class</code> is everywhere: the generator adds a new partial definition that merges with your original.</p>
</div>

**Generators can only add code, never modify existing code.** If you have a `Person` class, a generator cannot change that class. It can only create new files. This is why you see `partial class` everywhere in generated code: the generator creates a new partial definition that the compiler merges with your original.

**Generators must be deterministic and fast.** The compiler runs generators on every keystroke in an IDE. A slow generator makes IntelliSense lag. A non-deterministic generator causes confusing behavior. Modern generators use an "incremental" API that caches results and only regenerates when relevant code changes.

## Built-in Generators You Should Know

.NET includes several source generators that handle common scenarios. Understanding these serves two purposes: you can use them effectively in your own code, and studying how they work illustrates patterns for the broader concept.

### JSON Serialization

Traditional JSON serialization uses reflection. When you call `JsonSerializer.Serialize(person)`, the serializer inspects the `Person` type at runtime to discover its properties, then figures out how to convert each one to JSON. This happens every time your application starts.

The JSON source generator moves this work to compile time. You declare which types need serialization, and the generator writes custom serialization code for each one.

```csharp
// You write this:
[JsonSerializable(typeof(Person))]
public partial class AppJsonContext : JsonSerializerContext { }

// The generator creates optimized serialization code for Person.
// At runtime, no reflection occurs—the generated code runs directly.

string json = JsonSerializer.Serialize(person, AppJsonContext.Default.Person);
```

The practical benefits are faster application startup (no reflection cost), smaller deployments (unused reflection code can be trimmed), and compatibility with AOT compilation where reflection may not work at all.

### Regex Generation

Regular expressions normally compile their pattern into an internal state machine when you create a `Regex` object. The `[GeneratedRegex]` attribute moves this compilation to build time.

```csharp
public partial class Validators
{
    [GeneratedRegex(@"^[\w\.-]+@[\w\.-]+\.\w+$", RegexOptions.IgnoreCase)]
    public static partial Regex EmailRegex();
}
```

The generator produces actual C# code implementing the regex matching logic, not an interpreted pattern, but compiled IL instructions. This runs significantly faster than runtime-compiled regex for patterns used repeatedly.

### Logging Generation

High-performance logging has an awkward requirement: you want to avoid allocating strings and boxing value types when the log level is disabled. Writing this by hand is tedious:

```csharp
// Manual high-performance logging pattern
if (_logger.IsEnabled(LogLevel.Information))
{
    _logger.Log(LogLevel.Information, "Processing order {OrderId}", orderId);
}
```

The logging source generator automates this pattern:

```csharp
public static partial class Log
{
    [LoggerMessage(Level = LogLevel.Information,
                   Message = "Processing order {OrderId}")]
    public static partial void OrderProcessing(ILogger logger, int orderId);
}

// Usage - no allocation if Information level is disabled
Log.OrderProcessing(_logger, 123);
```

The generated code includes the enabled check and avoids boxing value types, giving you high-performance logging without writing boilerplate.

## The Partial Keyword Connection

You may have noticed that all the examples above use `partial` classes and `partial` methods. This is fundamental to how source generators work.

When you write `partial class AppJsonContext`, you're telling the compiler that this class definition is incomplete, and other parts exist elsewhere. The source generator creates another file with `partial class AppJsonContext` containing the generated implementation. The compiler merges these partial definitions into a single class.

Similarly, `partial` methods declare a method signature without implementation. The generator provides the implementation in a generated file. If you write:

```csharp
public static partial Regex EmailRegex();
```

The generator creates:

```csharp
public static partial Regex EmailRegex() => /* generated implementation */;
```

This explains why forgetting the `partial` keyword causes source generator features to fail. Without it, the compiler cannot merge your declaration with the generated implementation.

## Writing Your Own Generator

Most developers will consume existing generators rather than write new ones. However, understanding how to build a generator deepens your understanding of how they work and prepares you for the occasional situation where a custom generator makes sense.

A custom generator is appropriate when you have a pattern repeated across many classes that follows predictable rules. Common examples include generating builder patterns, implementing `INotifyPropertyChanged`, creating strongly-typed wrappers, or automating service registration.

### The Structure of a Generator

A source generator lives in its own project, separate from the code it generates for. This project targets `netstandard2.0` (for broad compatibility) and references the Roslyn compiler APIs.

The generator implements `IIncrementalGenerator`, which has a single method: `Initialize`. This method sets up a pipeline that:

1. **Filters** syntax nodes to find relevant code (classes with certain attributes, interfaces, etc.)
2. **Transforms** those nodes into simple data objects containing what you need to generate
3. **Outputs** generated source files based on that data

Here's the conceptual flow:

```
All Syntax Nodes → Filter (predicate) → Transform (extract info) → Generate (emit code)
```

The incremental API ensures that if a user edits an unrelated file, the generator doesn't re-run. Only changes to relevant code trigger regeneration.

### A Concrete Example: Auto-ToString

To illustrate the pattern, consider a generator that automatically implements `ToString()` for any class marked with an `[AutoToString]` attribute.

First, you define the marker attribute (in a shared project, not the generator project):

```csharp
namespace MyNamespace;

[AttributeUsage(AttributeTargets.Class)]
public class AutoToStringAttribute : Attribute { }
```

Users apply it to their classes:

```csharp
[AutoToString]
public partial class Person
{
    public string Name { get; set; } = "";
    public int Age { get; set; }
}
```

The generator finds classes with this attribute, extracts their property names, and generates a `ToString()` implementation:

```csharp
// Generated file: Person.g.cs
partial class Person
{
    public override string ToString()
    {
        return $"Person { Name = {Name}, Age = {Age} }";
    }
}
```

The user gets automatic `ToString()` that stays synchronized with their properties. Add a property, and the next build updates `ToString()` automatically.

## Common Patterns in Source Generators

When you encounter source generators in the wild or consider writing one, you'll see several recurring patterns.

### Marker Attributes

The most common pattern uses an attribute to mark types that need generation. The `[JsonSerializable]`, `[GeneratedRegex]`, and `[LoggerMessage]` attributes all follow this pattern. You mark something with an attribute, and the generator finds it and generates corresponding code.

This pattern works well because attributes are explicit. Developers opt in deliberately, and the generator has a clear, narrow scope of what to process.

### Interface-to-Implementation

Some generators take an interface definition and generate an implementation. You might define an interface describing your HTTP API, and a generator creates the actual HTTP client code. The Refit library uses this pattern: you declare an interface with route attributes, and generated code handles the HTTP calls.

This separates the contract (what operations exist) from the implementation details (how HTTP calls are made), and keeps the repetitive HTTP boilerplate out of your codebase.

### Assembly Scanning

Rather than marking individual types, some generators scan all types in an assembly looking for patterns. A dependency injection generator might find every class implementing `IService` and generate registration code automatically. This eliminates the need to manually register each service.

The tradeoff is less explicit control. You have to understand what the generator looks for, and accidentally matching the pattern creates unexpected behavior.

## Viewing and Debugging Generated Code

One initial challenge with source generators is that the generated code is invisible by default. You mark a class with an attribute, and methods magically appear. When something goes wrong, you need to see what the generator actually produced.

### Seeing the Generated Files

Add these properties to your project file to write generated code to disk:

```xml
<PropertyGroup>
  <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
  <CompilerGeneratedFilesOutputPath>$(BaseIntermediateOutputPath)Generated</CompilerGeneratedFilesOutputPath>
</PropertyGroup>
```

After building, look in `obj/Generated/` for the actual C# files the generator created. You can read them, understand what was generated, and spot issues.

Most IDEs also let you navigate to generated code directly. In Visual Studio, you can expand "Analyzers" under Dependencies to see generated files. In Rider, generated sources appear in the project tree.

### Understanding Generator Errors

When a generator fails, the error messages come from the generator itself, not from your code directly. Well-designed generators report diagnostics explaining what went wrong, for example, "Class 'Foo' must be partial to use this generator."

If you see cryptic errors during compilation that mention generator assemblies, the generated code likely has a bug, or your code doesn't match what the generator expects. Viewing the generated files usually reveals the problem.

## When Source Generators Make Sense

Source generators are powerful, but they're not the right tool for every situation.

**Good fits for source generators:**

- **Eliminating reflection costs.** If you're using reflection for serialization, dependency injection scanning, or type inspection, a source generator can move that work to compile time.
- **Reducing boilerplate that follows patterns.** When you find yourself writing the same code structure repeatedly with minor variations, a generator can automate it.
- **AOT compilation requirements.** If you're targeting platforms where runtime reflection is limited or unavailable, source generators become necessary rather than optional.

**Poor fits for source generators:**

- **One-time code scaffolding.** If you need to generate code once and then modify it by hand, use a CLI tool or T4 template instead. Generators regenerate on every build; they're not for code you intend to edit.
- **Situations requiring runtime flexibility.** If the code's behavior genuinely needs to change based on runtime conditions, reflection may be appropriate. Generators only know what's available at compile time.
- **Simple cases.** If you have three classes that need the same pattern, writing it by hand three times is probably simpler than creating and maintaining a generator.

## Practical Implications

Understanding source generators changes how you approach certain problems:

**When you see `partial` in modern C# code, look for generated counterparts.** The keyword is a signal that code exists somewhere else, often from a generator.

**Startup time improvements often come from source generators.** If an application using reflection-based JSON or DI feels slow to start, source-generated alternatives can help.

**Build errors from generators can be confusing.** When compilation fails with unfamiliar errors mentioning generator assemblies, enable `EmitCompilerGeneratedFiles` and examine what was actually generated.

**AOT and trimming compatibility usually requires source generators.** If you're building for deployment scenarios that don't support runtime code generation, you'll need source-generated alternatives for serialization, DI, and similar concerns.

## Summary

Source generators are compiler plugins that write C# code during compilation. They solve the problem of repetitive boilerplate by automating code generation, and they solve the problem of reflection overhead by moving type inspection from runtime to compile time.

The key concepts to remember:

- Generators **add** code; they cannot modify existing code
- The `partial` keyword enables merging generated code with your handwritten code
- Built-in generators for JSON, Regex, and Logging cover common high-performance scenarios
- Generated code is real C# code—debuggable, readable, and type-checked
- AOT compilation and application trimming often require source generators

For most developers, using existing generators like `[JsonSerializable]` and `[GeneratedRegex]` effectively is more valuable than writing custom generators. Understanding the underlying mechanism helps you use these tools well and troubleshoot issues when they arise.
