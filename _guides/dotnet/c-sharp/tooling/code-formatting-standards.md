---
title: "Code Formatting and Style Enforcement"
layout: guide
category: ".NET & C#"
subcategory: "Tooling & Quality"
description: "Defining and enforcing C# code style with .editorconfig, Roslyn IDE and CA analyzers, dotnet format, and Directory.Build.props: which rules each tool enforces, how severity and EnforceCodeStyleInBuild decide what fails a build, and how to roll standards out to an existing codebase."
tags: [practical, editorconfig, roslyn-analyzers, dotnet-format, code-quality, maintainability, cicd]
---

## Why Formatting Standards Matter

Inconsistent code style creates friction at every stage of development. Code reviews drift into debates about brace placement instead of logic. New team members absorb conflicting patterns from different files. Diffs fill with whitespace and style changes mixed into functional ones, which hides what actually changed.

Automated enforcement removes these problems. When every developer's editor applies the same rules and the CI pipeline rejects violations, the team stops debating formatting and agrees on it by default. The .NET SDK ships with everything needed to define, apply, and enforce these rules, with no third-party tools.

---

## Three Kinds of Rule, Three Places They Run

The rules come in three kinds, and the tools that enforce them don't all enforce all three. Most confusion about "why didn't CI catch this" comes from this split.

| Kind of rule | Diagnostic IDs | Configured by |
|---|---|---|
| **Formatting**: indentation, spacing, newlines | `IDE0055` | `indent_size`, `csharp_new_line_*`, `csharp_space_*` options |
| **Code style**: `var`, braces, `this.`, expression bodies, naming | `IDE0001` and up | `dotnet_style_*`, `csharp_style_*`, `dotnet_naming_*` options |
| **Code quality**: likely bugs, performance, API misuse | `CA1000` and up | `dotnet_diagnostic.CAxxxx.severity`, `AnalysisLevel` |

And where each is checked:

| | Editor | `dotnet build` | `dotnet build` with `EnforceCodeStyleInBuild` | `dotnet format` |
|---|---|---|---|---|
| Formatting | Yes | No | Only if `IDE0055` has a severity | Yes |
| Code style | Yes | **No** | Mostly, at the configured severity (exceptions below) | Yes |
| Code quality | Yes | Yes | Yes | Yes (`analyzers` subcommand) |

The row to remember is code style under plain `dotnet build`: nothing. A style rule set to `warning` shows a squiggle in the editor and produces no build output at all until `EnforceCodeStyleInBuild` is on. A team that configures `.editorconfig` carefully and never sets that property has a style guide the build ignores.

---

## EditorConfig

`.editorconfig` is an [open standard](https://editorconfig.org){:target="_blank" rel="noopener noreferrer"} for coding style that editors read automatically. The .NET SDK extends it with C# options for code style, naming, and analyzer severity, and the compiler reads it too, so the same file drives the editor, the build, and `dotnet format`.

An `.editorconfig` at the repository root applies to every file beneath it. Files in subdirectories can override its settings for their own subtree, and `root = true` at the top of the root file stops the search from continuing into parent directories. `dotnet new editorconfig` generates a starting file with the SDK's default options spelled out.

### Whitespace and Indentation

These apply across all file types:

```ini
# Top-level EditorConfig
root = true

# Default rules for all files
[*]
indent_style = space
indent_size = 4
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

# XML project files
[*.{csproj,props,targets}]
indent_size = 2

# JSON files
[*.json]
indent_size = 2
```

`end_of_line` is left out deliberately. Setting it in `.editorconfig` while Git also normalizes line endings through `core.autocrlf` or `.gitattributes` makes the two fight, and a cross-platform team usually lets `.gitattributes` decide. Set `end_of_line` only when the whole team works on one platform.

### C# Code Style Options

Code style options take the form `option = value:severity`. The value states the preference, and the severity decides how a violation surfaces. Two families exist.

**`dotnet_style_*` options** apply to both C# and Visual Basic:

```ini
[*.cs]
# Don't qualify members with 'this.'
dotnet_style_qualification_for_field = false:suggestion
dotnet_style_qualification_for_property = false:suggestion
dotnet_style_qualification_for_method = false:suggestion
dotnet_style_qualification_for_event = false:suggestion

# Language keywords over framework type names: int, not Int32
dotnet_style_predefined_type_for_locals_parameters_members = true:warning
dotnet_style_predefined_type_for_member_access = true:warning

# Object and collection initializers
dotnet_style_object_initializer = true:suggestion
dotnet_style_collection_initializer = true:suggestion

# Explicit accessibility modifiers
dotnet_style_require_accessibility_modifiers = always:warning
```

**`csharp_style_*` options** are specific to C#:

```ini
[*.cs]
# var preferences
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_style_var_elsewhere = false:suggestion

# Expression-bodied members
csharp_style_expression_bodied_methods = when_on_single_line:suggestion
csharp_style_expression_bodied_constructors = false:suggestion
csharp_style_expression_bodied_properties = true:suggestion
csharp_style_expression_bodied_accessors = true:suggestion

# Pattern matching
csharp_style_pattern_matching_over_is_with_cast_check = true:warning
csharp_style_pattern_matching_over_as_with_null_check = true:warning

# Null checking
csharp_style_throw_expression = true:suggestion
csharp_style_conditional_delegate_call = true:suggestion

# Braces
csharp_prefer_braces = true:warning

# using directives
csharp_using_directive_placement = outside_namespace:warning
```

### Formatting Options

Formatting options control whitespace, newlines, and spacing inside C# constructs. Unlike style options, they take no `:severity` suffix. All of them report under the single diagnostic `IDE0055`, so to make formatting violations fail a build, give that ID a severity:

```ini
[*.cs]
# New lines
csharp_new_line_before_open_brace = all
csharp_new_line_before_else = true
csharp_new_line_before_catch = true
csharp_new_line_before_finally = true
csharp_new_line_before_members_in_object_initializers = true

# Indentation
csharp_indent_case_contents = true
csharp_indent_switch_labels = true
csharp_indent_block_contents = true

# Spacing
csharp_space_after_cast = false
csharp_space_after_keywords_in_control_flow_statements = true
csharp_space_between_method_call_parameter_list_parentheses = false
csharp_space_between_parentheses = false

# Report formatting violations in the build (with EnforceCodeStyleInBuild)
dotnet_diagnostic.IDE0055.severity = warning
```

### Naming Conventions

A naming rule has three parts: a **symbol group** (which identifiers it targets), a **naming style** (the pattern to enforce), and the **rule** that connects them with a severity.

```ini
[*.cs]
# PascalCase for public and internal members
dotnet_naming_rule.public_members_pascal_case.symbols = public_symbols
dotnet_naming_rule.public_members_pascal_case.style = pascal_case_style
dotnet_naming_rule.public_members_pascal_case.severity = warning

dotnet_naming_symbols.public_symbols.applicable_kinds = property, method, field, event
dotnet_naming_symbols.public_symbols.applicable_accessibilities = public, internal

dotnet_naming_style.pascal_case_style.capitalization = pascal_case

# _camelCase for private and protected fields
dotnet_naming_rule.private_fields_camel_case.symbols = private_fields
dotnet_naming_rule.private_fields_camel_case.style = camel_case_underscore
dotnet_naming_rule.private_fields_camel_case.severity = warning

dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private, protected

dotnet_naming_style.camel_case_underscore.capitalization = camel_case
dotnet_naming_style.camel_case_underscore.required_prefix = _

# Interfaces start with I
dotnet_naming_rule.interfaces_begin_with_i.symbols = interface_symbols
dotnet_naming_rule.interfaces_begin_with_i.style = interface_style
dotnet_naming_rule.interfaces_begin_with_i.severity = warning

dotnet_naming_symbols.interface_symbols.applicable_kinds = interface

dotnet_naming_style.interface_style.capitalization = pascal_case
dotnet_naming_style.interface_style.required_prefix = I

# Type parameters start with T
dotnet_naming_rule.type_parameters_begin_with_t.symbols = type_parameter_symbols
dotnet_naming_rule.type_parameters_begin_with_t.style = type_parameter_style
dotnet_naming_rule.type_parameters_begin_with_t.severity = warning

dotnet_naming_symbols.type_parameter_symbols.applicable_kinds = type_parameter

dotnet_naming_style.type_parameter_style.capitalization = pascal_case
dotnet_naming_style.type_parameter_style.required_prefix = T
```

Naming violations report as `IDE1006`. `dotnet format` honours each naming rule's own severity, but in testing on the .NET 10 SDK the build reported them only after `dotnet_diagnostic.IDE1006.severity = warning` was also set, even with `EnforceCodeStyleInBuild` on. Add that line whenever naming rules should fail CI.

### Severity Levels

| Severity | Editor | Build (for IDE rules, only with `EnforceCodeStyleInBuild`) |
|----------|--------|----------------|
| `none` | Not reported | Not reported |
| `silent` | Not shown, but the fix is still offered as a refactoring | Not reported |
| `suggestion` | Dots under the code | Reported as a message, never fails the build |
| `warning` | Squiggles | Build warning |
| `error` | Red squiggles | Build error, and the build fails |

There are two ways to set a severity, and they interact. `option = value:severity` sets it alongside the option. `dotnet_diagnostic.<ID>.severity = <severity>` sets it for the diagnostic ID, and when both are present, the `dotnet_diagnostic` entry wins. Some options also map to a diagnostic ID shared with other options, so setting severities by ID is the more predictable choice once rules start to pile up.

---

## Roslyn Analyzers

Roslyn analyzers run inside the C# compiler, inspect the code, and report diagnostics. The SDK ships two built-in sets, with no NuGet package needed.

**IDE analyzers** (`IDE` IDs) enforce the code style and formatting options above. For example, `IDE0003` flags an unnecessary `this.` qualification and `IDE0090` flags a `new` expression that could be target-typed `new()`.

**Code quality analyzers** (`CA` IDs) catch likely bugs, performance issues, and API misuse. For example, `CA1822` flags members that could be static, `CA2007` flags an `await` without `ConfigureAwait`, and `CA1062` flags public methods that don't validate reference-type arguments. The last two are off by default.

Third-party analyzer packages, such as [StyleCop.Analyzers](https://github.com/DotNetAnalyzers/StyleCopAnalyzers){:target="_blank" rel="noopener noreferrer"} and [Roslynator](https://github.com/dotnet/roslynator){:target="_blank" rel="noopener noreferrer"}, add more rules on the same mechanism and are configured with the same `dotnet_diagnostic` entries.

### Configuring Analyzer Severity

Set the severity of any rule by ID:

```ini
[*.cs]
dotnet_diagnostic.CA1822.severity = warning     # Mark members as static
dotnet_diagnostic.CA2007.severity = none        # No ConfigureAwait in app code

dotnet_diagnostic.IDE0005.severity = warning    # Remove unnecessary usings
dotnet_diagnostic.IDE0090.severity = suggestion # Simplify new expression
```

`IDE0005` has a trap. It reports in the build only when the project also sets `<GenerateDocumentationFile>true</GenerateDocumentationFile>`, because the compiler tracks which `using` directives are used only while it is also parsing documentation comments, which can refer to types through `cref`. With it off, the rule appears in the editor and silently never fails CI.

### Severity by Category

Rather than setting CA rules one at a time, set a default for a whole category and then adjust individual rules:

```ini
[*.cs]
dotnet_analyzer_diagnostic.category-Performance.severity = warning
dotnet_analyzer_diagnostic.category-Reliability.severity = warning
dotnet_analyzer_diagnostic.category-Security.severity = error

# Then relax specific noisy rules
dotnet_diagnostic.CA1848.severity = suggestion  # Use LoggerMessage delegates
```

### Global AnalyzerConfig Files

A `.globalconfig` file holds analyzer settings that apply to every file in a project regardless of directory, with no `[*.cs]` sections:

```ini
# .globalconfig
is_global = true

dotnet_diagnostic.CA1822.severity = warning
dotnet_diagnostic.CA2007.severity = none
```

The SDK picks up a file named `.globalconfig` in the project directory or any parent, so one at the repository root covers every project. When a `.globalconfig` and an `.editorconfig` set the same rule, the `.editorconfig` wins for the files in its scope. That makes `.globalconfig` a good home for repository-wide defaults, with `.editorconfig` files overriding them where a directory needs different treatment.

---

## dotnet format

`dotnet format` ships with the .NET SDK from version 6. It reads the same `.editorconfig` as the editor and the build, and rewrites files in place to match it:

| Subcommand | What it fixes |
|-------------|--------------|
| `dotnet format whitespace` | Formatting: indentation, spacing, newlines |
| `dotnet format style` | Code style (IDE diagnostics) |
| `dotnet format analyzers` | Code quality (CA and third-party diagnostics) that have code fixes |

Plain `dotnet format` runs all three. With `--verify-no-changes`, it changes nothing, lists every violation, and exits with code 2 if any file would change, which makes it a CI check.

Two behaviours are easy to miss. `dotnet format` acts only on rules at `warning` severity or above unless you pass `--severity info`, so rules left at `suggestion` are neither fixed nor reported. And its coverage is not identical to the build's. In testing on the .NET 10 SDK, `IDE0003` (`this.` qualification) set to `warning` was reported by `dotnet format` but not by `dotnet build` with `EnforceCodeStyleInBuild`, while the brace and `using` rules were reported by both. Running both checks in CI covers the gaps between them.

---

## Directory.Build.props

`Directory.Build.props` is an MSBuild file whose properties apply to every project in the directory tree beneath it. One at the repository root configures analysis for the whole solution without touching each `.csproj`:

```xml
<Project>
  <PropertyGroup>
    <!-- Report IDE style rules in the build, not just the editor -->
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>

    <!-- Needed for IDE0005 (unused usings) to report in the build -->
    <GenerateDocumentationFile>true</GenerateDocumentationFile>

    <!-- Which CA rules are on, and at what default severity -->
    <AnalysisLevel>latest-recommended</AnalysisLevel>

    <!-- Fail Release builds on any warning -->
    <TreatWarningsAsErrors Condition="'$(Configuration)' == 'Release'">true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

`EnforceCodeStyleInBuild` is the setting that matters most, for the reason shown in the table at the top: without it, every code style rule is editor-only.

`GenerateDocumentationFile` also makes the compiler warn about missing XML documentation comments (`CS1591`) on public members. In an application where that is noise, suppress it with `dotnet_diagnostic.CS1591.severity = none`.

`AnalysisLevel` chooses the set of CA rules and their default severities. `latest-recommended` turns on the rules Microsoft recommends for the current SDK, and `latest-all` turns on every rule, which is usually too noisy to adopt at once. Both follow the SDK, so upgrading the SDK can add new warnings. Pin to a version such as `10.0-recommended` to keep the rule set fixed until you choose to move.

---

## CI Enforcement

With `.editorconfig` and `Directory.Build.props` in place, CI needs two checks:

1. **Format check.** `dotnet format --verify-no-changes` fails when any file doesn't match the formatting and style rules. It is fast, so it runs first.
2. **Build check.** `dotnet build -c Release` with `EnforceCodeStyleInBuild` reports style and quality rules as warnings or errors, and `TreatWarningsAsErrors` turns every warning into a failure.

Neither check alone covers everything, since each reports some rules the other doesn't. Together they ensure no style or quality violation reaches the main branch.

---

## Adopting Standards Incrementally

Turning enforcement on in an existing codebase doesn't require fixing every file at once.

1. **Normalize formatting first.** Add the `.editorconfig`, run `dotnet format whitespace` once, and commit the result on its own. The commit is large but purely cosmetic, so reviewers can skip it. Listing it in a `.git-blame-ignore-revs` file keeps `git blame` pointing at real authors.
2. **Start style rules at `suggestion`.** The team sees them in the editor without the build failing.
3. **Promote in batches.** Move rules to `warning` a few at a time, uncontroversial ones first (braces, `using` placement, accessibility modifiers), then naming and opinionated preferences such as `var` once the team has agreed on them. Run `dotnet format style` after each promotion to fix existing violations in one commit.
4. **Turn on the build checks** once the warning count is at zero, so they stay at zero.

A `.globalconfig` at the repository root is a convenient place to track which rules are on during the rollout. A test project where some CA rules add noise can override them in its own `.editorconfig`.

Keep severities intentional. `suggestion` suits preferences, `warning` suits team standards that CI enforces, and `error` is for rules that prevent bugs, such as the security category, so that they fail even local Debug builds.
