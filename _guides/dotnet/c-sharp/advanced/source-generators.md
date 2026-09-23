---
title: "C# Source Generators"
layout: guide
category: ".NET & C#"
subcategory: "Advanced Topics"
description: "How Roslyn source generators add code at compile time: why they replace reflection, the partial-declaration contract, the built-in generators, writing an incremental generator with ForAttributeWithMetadataName and equatable models, project setup, viewing generated code, and when a generator isn't worth it."
tags: [source-generators, iincrementalgenerator, roslyn, metaprogramming, native-aot, partial-classes, advanced]
---
{% raw %}

## The Problem Source Generators Solve

A lot of code is mechanical: a `ToString` that lists every property, serialization that reads and writes each field, `INotifyPropertyChanged` raised from every setter, a service registration per class. There have been two ways to avoid writing it by hand, and each has a cost.

| Approach | How it works | Cost |
|---|---|---|
| Hand-written | You write and maintain every line | Adding a property means remembering every place that lists properties |
| Runtime reflection | The program inspects its own types while running | Work repeated at every startup, and metadata the trimmer and Native AOT can't always see |
| Source generator | A compiler plug-in writes the code during the build | Build-time complexity, and a generator to maintain or depend on |

A source generator is a component loaded by the C# compiler. During compilation it can inspect everything the compiler knows about your code, and it adds new C# files that are compiled into the same assembly. The result behaves as if you had written the code by hand, with no run-time discovery.

## How a Generator Fits Into Compilation

The compiler parses your source and builds a semantic model of it: types, members, attributes, and what each name refers to. Generators receive that model, read-only, and return additional source text. The compiler then compiles your code and the generated code together.

Two constraints follow from that design:

- **Generators only add.** A generator can't edit or remove your code. It can't change a method body or add an attribute to your class.
- **Generators can't see each other's output.** Every generator receives the same original compilation, so one generator's code can't trigger another.

### Why `partial` Is Everywhere

Since a generator can't modify your class, it needs your permission to add to it, and `partial` is that permission. A `partial` type may be declared in several files, and the compiler merges them. You write one part, the generator writes another:

```csharp
// You write
public partial class Patterns
{
    [GeneratedRegex(@"^[0-9]+\z")]
    public static partial Regex Digits();
}

// The generator writes, in a file of its own
public partial class Patterns
{
    public static partial Regex Digits() => /* generated implementation */;
}
```

A `partial` method or property with no body is a declaration the generator must implement. Forget `partial` on the method or on any enclosing type, and the build fails, because there's nothing for the generated part to merge with.

## The Built-in Generators

.NET ships several generators, each triggered by an attribute on a `partial` declaration:

| Attribute | Generates | Why it beats the reflection path |
|---|---|---|
| `[JsonSerializable]` on a `JsonSerializerContext` | Serialization metadata and fast-path writers for System.Text.Json | Works under trimming and Native AOT; removes per-type startup cost |
| `[GeneratedRegex]` | C# source implementing the pattern's matching logic | No run-time `Reflection.Emit`; invalid patterns fail the build |
| `[LoggerMessage]` | Logging methods with the level check and cached parsing of the template | No template parsing or `object[]` allocation per call |
| `[LibraryImport]` | P/Invoke marshalling code | Marshalling is visible C#, and works under Native AOT |
| Configuration binding (`EnableConfigurationBindingGenerator`) | `Bind` and `Get<T>` implementations | Binding without reflection for trimmed apps |

Each is ordinary source you can open and step through. Generated regex code, for instance, is plain C# with comments explaining which part of the pattern each block matches.

### Native AOT and Trimming

Native AOT compiles the whole application to machine code at publish time, and trimming removes code that static analysis doesn't see used. Reflection itself still works under both, but two things break. Anything that generates code at run time, which means `Reflection.Emit`, has nothing to run it. And a type reached only through reflection, such as a property discovered by name, may have been trimmed away. Native AOT always trims, so both problems apply to it.

A reflection-based serializer or DI scanner hits both limits, which is why the libraries offer a generator. The generator decides at build time which members are used, and the trimmer sees that code as ordinary references. That is the most common reason a project adopts a generator it didn't write.

## Writing an Incremental Generator

Most developers consume generators rather than write them. A custom generator earns its place when a rule-driven pattern repeats across many types in a codebase, and its output would otherwise be maintained by hand or discovered by reflection.

The example below implements `ToString` for every class marked `[AutoToString]`.

### Project Setup

A generator is a separate project, loaded by the compiler rather than referenced by your code:

```xml
<!-- AutoToString.Generator.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.0</TargetFramework>
    <LangVersion>latest</LangVersion>
    <EnforceExtendedAnalyzerRules>true</EnforceExtendedAnalyzerRules>
    <IsRoslynComponent>true</IsRoslynComponent>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.CSharp" Version="4.14.0" PrivateAssets="all" />
  </ItemGroup>
</Project>
```

```xml
<!-- The consuming project -->
<ItemGroup>
  <ProjectReference Include="..\AutoToString.Generator\AutoToString.Generator.csproj"
                    OutputItemType="Analyzer" ReferenceOutputAssembly="false" />
</ItemGroup>
```

- **`netstandard2.0`** because the generator runs inside whichever compiler hosts it, including hosts on .NET Framework. `LangVersion` can still be current, since that controls the generator's own syntax, not its runtime. Some newer features need a polyfill on this target: records and `init` fail with error CS0518 until the project declares `namespace System.Runtime.CompilerServices { internal static class IsExternalInit { } }`.
- **The `Microsoft.CodeAnalysis.CSharp` version sets the oldest compiler that can load the generator.** Referencing 4.14 means an SDK or IDE with an older Roslyn won't run it.
- **`EnforceExtendedAnalyzerRules`** turns on analyzers that flag APIs a generator mustn't use, such as file I/O.
- **`OutputItemType="Analyzer"` with `ReferenceOutputAssembly="false"`** loads the project into the compiler without making it a run-time dependency.

To ship a generator in a NuGet package, place the assembly under `analyzers/dotnet/cs` in the package rather than `lib`.

### The Generator

A generator implements `IIncrementalGenerator`. Its `Initialize` method doesn't generate anything directly. It builds a pipeline, and the compiler runs that pipeline, caching each stage's output and skipping stages whose inputs haven't changed:

```csharp
[Generator]
public sealed class AutoToStringGenerator : IIncrementalGenerator
{
    private const string AttributeSource = """
        namespace AutoToString
        {
            [global::Microsoft.CodeAnalysis.EmbeddedAttribute]
            [global::System.AttributeUsage(global::System.AttributeTargets.Class)]
            internal sealed class AutoToStringAttribute : global::System.Attribute { }
        }
        """;

    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // 1. Add the marker attribute to every consuming compilation
        context.RegisterPostInitializationOutput(ctx =>
        {
            ctx.AddEmbeddedAttributeDefinition();
            ctx.AddSource("AutoToStringAttribute.g.cs", AttributeSource);
        });

        // 2. Find classes carrying the attribute and extract an equatable model
        IncrementalValuesProvider<ClassModel> classes = context.SyntaxProvider.ForAttributeWithMetadataName(
            "AutoToString.AutoToStringAttribute",
            predicate: static (node, _) => node is ClassDeclarationSyntax,
            transform: static (ctx, _) =>
            {
                var type = (INamedTypeSymbol)ctx.TargetSymbol;
                string properties = string.Join(",", type.GetMembers()
                    .OfType<IPropertySymbol>()
                    .Where(p => p.DeclaredAccessibility == Accessibility.Public && !p.IsStatic)
                    .Select(p => p.Name));

                return new ClassModel(
                    type.ContainingNamespace.IsGlobalNamespace ? null : type.ContainingNamespace.ToDisplayString(),
                    type.Name,
                    properties);
            });

        // 3. Emit one file per class
        context.RegisterSourceOutput(classes, static (ctx, model) =>
            ctx.AddSource($"{model.Name}.ToString.g.cs", Render(model)));
    }

    private static string Render(ClassModel model)
    {
        var sb = new StringBuilder();
        if (model.Namespace is not null)
            sb.AppendLine($"namespace {model.Namespace};");

        sb.AppendLine($"partial class {model.Name}");
        sb.AppendLine("{");
        sb.AppendLine("    public override string ToString() =>");
        sb.Append($"        \"{model.Name} {{ \"");
        string[] names = model.Properties.Length == 0 ? [] : model.Properties.Split(',');
        for (int i = 0; i < names.Length; i++)
            sb.Append($" + \"{(i > 0 ? ", " : "")}{names[i]} = \" + {names[i]}");
        sb.AppendLine(" + \" }\";");
        sb.AppendLine("}");
        return sb.ToString();
    }

    // A record gives value equality, so an unchanged class produces an equal model and no re-emit
    private sealed record ClassModel(string? Namespace, string Name, string Properties);
}
```

Applied to a class, it produces a second part:

```csharp
// You write
[AutoToString]
public partial class Person
{
    public string Name { get; set; } = "";
    public int Age { get; set; }
}

// Generated: Person.ToString.g.cs
namespace Demo;
partial class Person
{
    public override string ToString() =>
        "Person { " + "Name = " + Name + ", Age = " + Age + " }";
}
```

`new Person { Name = "Ada", Age = 36 }.ToString()` returns `Person { Name = Ada, Age = 36 }`, and adding a property updates it on the next build.

### The Three Stages

**The marker attribute** comes from `RegisterPostInitializationOutput`, which adds source before anything else runs, so user code can apply the attribute without referencing another assembly. `AddEmbeddedAttributeDefinition` and the `[Embedded]` marker make the attribute private to each consuming assembly. Without them, two projects that both use the generator, one referencing the other, each define `AutoToString.AutoToStringAttribute` and produce conflicting-type warnings.

**Finding targets** uses `ForAttributeWithMetadataName`, which the compiler can answer from an index of attribute usages rather than by examining every syntax node. The Roslyn team's measurements put it at usually around 99 times more efficient than a hand-written `CreateSyntaxProvider` scan. The predicate is a cheap syntax check, and the transform runs only on nodes that pass it.

**The model** is where incremental generators succeed or fail. Each stage's output is compared with the previous run's, and when it's equal, later stages are skipped. That comparison uses `Equals`, so the model must have value equality:

- **Never put symbols, syntax nodes, or the `Compilation` in the model.** They are never equal across edits, so every keystroke reruns everything downstream, and they keep old compilations alive in memory.
- **Use records, but watch their collections.** A record compares an array or `List<T>` field by reference, which defeats caching just as a symbol does. Flatten it, as `ClassModel.Properties` does, or wrap it in a collection type that implements value equality.
- **Extract early.** Copy the names and flags you need out of the symbol in the transform, and let everything after it work on plain data.

A generator whose model isn't equatable still produces correct output. It just reruns in full on every edit, which appears as IDE lag in the projects that use it.

### Reporting Problems

A generator can't throw to report a user mistake. An exception disables it for the compilation and surfaces as warning CS8785, which names the generator and not the user's code. Report a diagnostic instead, such as "class must be partial", with `ctx.ReportDiagnostic` in the output stage, pointing at the declaration. Carry the location in the model as data, not as a syntax node.

## Viewing Generated Code

Generated files don't appear in the project folder. The IDE shows them under the project's **Dependencies → Analyzers → *generator name*** node in Visual Studio, or in a similar node in Rider, and Go to Definition on a generated member opens its file.

To write them to disk, for code review or a diff between builds:

```xml
<PropertyGroup>
  <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
</PropertyGroup>
```

Files then appear under `obj/<configuration>/<target framework>/generated/<generator assembly>/<generator type>/`. `CompilerGeneratedFilesOutputPath` moves them elsewhere.

When a build fails with errors inside a `.g.cs` file, the generator produced invalid code for your input. Read the generated file first, since the fault is usually visible there, and then look for an input shape the generator doesn't handle, such as a nested or generic class.

## When a Generator Isn't Worth It

- **Code you'll edit afterwards.** A generator rewrites its output on every build. For one-time scaffolding, use a template or a `dotnet new` template.
- **A handful of types.** Writing `ToString` by hand for three classes costs less than building, testing, and versioning a generator.
- **Behaviour that depends on run-time information.** A generator knows only the compilation. Plugins loaded at run time, or types chosen by configuration, still need reflection.
- **Logic that belongs in a library.** If the generated code would be the same for every type apart from a few names, a generic method or base class may express it without generating anything.

The cost that's easiest to underestimate is maintenance. A generator is a compiler extension, pinned to a Roslyn version, running in every developer's IDE. Its bugs appear as build errors in someone else's project, and it needs its own tests, usually by running it against sample source and comparing the output to a stored snapshot.

## Key Takeaways

**Generators add source at compile time and never modify yours.** `partial` is how your declaration and the generated implementation meet.

**Prefer the built-in generators** for JSON, regex, logging, and interop. They're what make those libraries work under trimming and Native AOT.

**Native AOT's limit is run-time code generation and trimmed metadata,** not reflection as such. Generators solve both by doing the work at build time.

**Write incremental generators with `ForAttributeWithMetadataName` and value-equal models.** Symbols or arrays in the model make every edit rerun the pipeline.

**Report user errors as diagnostics,** and target `netstandard2.0` with an explicit Roslyn version.

**Build a custom generator only for a pattern repeated across many types,** and budget for testing and maintaining it.
{% endraw %}
