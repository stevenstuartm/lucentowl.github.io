---
title: "Code Formatting and Style Enforcement"
layout: guide
category: ".NET & C#"
subcategory: "Tooling"
description: "Enforcing consistent code style with .editorconfig, Roslyn analyzers, and dotnet format."
tags: [c-sharp, dotnet, tooling, code-quality, maintainability, practical]
---

## Why Formatting Standards Matter

Inconsistent code style creates friction at every stage of development. Code reviews devolve into debates about brace placement instead of logic. New team members absorb conflicting patterns from different files. Git diffs become noisy with whitespace and style changes mixed into functional changes, making it harder to review what actually changed.

Automated formatting enforcement removes these problems. When every developer's IDE applies the same rules and the CI pipeline rejects style violations, the team stops debating formatting and starts agreeing on it by default.

The .NET SDK ships with everything needed to define, apply, and enforce code style rules without any third-party tools.

## EditorConfig

The `.editorconfig` file is an open standard for defining coding styles that editors and IDEs read automatically. The .NET SDK extends this standard with C#-specific rules for code style, naming conventions, and analyzer severity.

A `.editorconfig` placed at the repository root applies to all files beneath it. You can override settings with additional `.editorconfig` files in subdirectories, and a `root = true` declaration at the top prevents editors from searching parent directories for additional files.

### Whitespace and Indentation

These rules control basic formatting across all file types.

```ini
# Top-level EditorConfig
root = true

# Default rules for all files
[*]
indent_style = space
indent_size = 4
end_of_line = crlf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

# C# files
[*.cs]
indent_size = 4

# XML project files
[*.{csproj,props,targets}]
indent_size = 2

# JSON files
[*.json]
indent_size = 2
```

### C# Code Style Rules

The SDK recognizes two families of style rules that control how C# code should look beyond simple whitespace.

**`dotnet_style_*` rules** apply to both C# and VB.NET, covering language-agnostic style preferences.

```ini
[*.cs]
# Prefer 'this.' qualification: never
dotnet_style_qualification_for_field = false:suggestion
dotnet_style_qualification_for_property = false:suggestion
dotnet_style_qualification_for_method = false:suggestion
dotnet_style_qualification_for_event = false:suggestion

# Prefer language keywords over framework type names
# int instead of Int32, string instead of String
dotnet_style_predefined_type_for_locals_parameters_members = true:warning
dotnet_style_predefined_type_for_member_access = true:warning

# Prefer object/collection initializers
dotnet_style_object_initializer = true:suggestion
dotnet_style_collection_initializer = true:suggestion

# Prefer explicit accessibility modifiers
dotnet_style_require_accessibility_modifiers = always:warning
```

**`csharp_style_*` rules** are specific to C# and cover features like expression bodies, pattern matching, and `var` usage.

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

### Formatting Rules

Formatting rules control whitespace, newlines, and spacing within C# constructs.

```ini
[*.cs]
# New line preferences
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
```

### Naming Conventions

Naming rules enforce consistent identifier naming across the codebase. These rules use three components: a symbol group (what identifiers to target), a naming style (what pattern to enforce), and a naming rule that connects them with a severity.

```ini
[*.cs]
# PascalCase for public members
dotnet_naming_rule.public_members_pascal_case.symbols = public_symbols
dotnet_naming_rule.public_members_pascal_case.style = pascal_case_style
dotnet_naming_rule.public_members_pascal_case.severity = warning

dotnet_naming_symbols.public_symbols.applicable_kinds = property, method, field, event
dotnet_naming_symbols.public_symbols.applicable_accessibilities = public, internal

dotnet_naming_style.pascal_case_style.capitalization = pascal_case

# camelCase for private fields
dotnet_naming_rule.private_fields_camel_case.symbols = private_fields
dotnet_naming_rule.private_fields_camel_case.style = camel_case_underscore
dotnet_naming_rule.private_fields_camel_case.severity = warning

dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private, protected

dotnet_naming_style.camel_case_underscore.capitalization = camel_case
dotnet_naming_style.camel_case_underscore.required_prefix = _

# PascalCase for interfaces with 'I' prefix
dotnet_naming_rule.interfaces_begin_with_i.symbols = interface_symbols
dotnet_naming_rule.interfaces_begin_with_i.style = interface_style
dotnet_naming_rule.interfaces_begin_with_i.severity = warning

dotnet_naming_symbols.interface_symbols.applicable_kinds = interface

dotnet_naming_style.interface_style.capitalization = pascal_case
dotnet_naming_style.interface_style.required_prefix = I

# PascalCase for type parameters with 'T' prefix
dotnet_naming_rule.type_parameters_begin_with_t.symbols = type_parameter_symbols
dotnet_naming_rule.type_parameters_begin_with_t.style = type_parameter_style
dotnet_naming_rule.type_parameters_begin_with_t.severity = warning

dotnet_naming_symbols.type_parameter_symbols.applicable_kinds = type_parameter

dotnet_naming_style.type_parameter_style.capitalization = pascal_case
dotnet_naming_style.type_parameter_style.required_prefix = T
```

### Severity Levels

Every style and naming rule can have a severity that determines how violations surface.

| Severity | IDE Behavior | Build Behavior |
|----------|-------------|----------------|
| `none` | Hidden completely | Ignored |
| `silent` | Hidden in editor, visible in code cleanup | Ignored |
| `suggestion` | Shown as dots under code | Ignored by default |
| `warning` | Yellow squiggles in editor | Produces build warning |
| `error` | Red squiggles in editor | Produces build error, fails the build |

Setting a rule to `warning` or `error` means the compiler itself enforces it. A rule set to `suggestion` only appears as an IDE hint unless you enable `EnforceCodeStyleInBuild` (covered later).

## Roslyn Analyzers

Roslyn analyzers run as part of the C# compilation pipeline, inspecting your code and producing diagnostics. The .NET SDK ships with two sets of built-in analyzers that require no NuGet packages.

**IDE analyzers** (diagnostic IDs starting with `IDE`) enforce code style preferences. These are the same rules configured by `dotnet_style_*` and `csharp_style_*` settings. For example, `IDE0003` flags unnecessary `this.` qualification and `IDE0090` flags `new` expressions that could use target-typed `new()`.

**Code quality analyzers** (diagnostic IDs starting with `CA`) catch potential bugs, performance issues, and API misuse. For example, `CA1822` flags methods that could be static, `CA2007` warns about missing `ConfigureAwait` calls, and `CA1062` flags parameters that aren't null-checked.

### Configuring Analyzer Severity

You can change the severity of any analyzer rule in `.editorconfig` using the `dotnet_diagnostic` syntax.

```ini
[*.cs]
# Promote specific rules to warnings
dotnet_diagnostic.CA1822.severity = warning    # Mark members as static
dotnet_diagnostic.CA2007.severity = none       # Disable ConfigureAwait warning (ASP.NET)

# IDE rules
dotnet_diagnostic.IDE0005.severity = warning   # Remove unnecessary usings
dotnet_diagnostic.IDE0090.severity = suggestion # Simplify new expression
```

### Bulk Severity with Analysis Categories

Rather than configuring rules one at a time, you can set default severity for entire categories.

```ini
[*.cs]
# Set all code quality analyzers to warning
dotnet_analyzer_diagnostic.category-Performance.severity = warning
dotnet_analyzer_diagnostic.category-Reliability.severity = warning
dotnet_analyzer_diagnostic.category-Security.severity = error

# Then suppress specific noisy rules
dotnet_diagnostic.CA1848.severity = suggestion  # Use LoggerMessage for performance
```

### GlobalConfig Files

For settings that apply across all files without relying on directory hierarchy, you can use `.globalconfig` files. These are useful when you want a single source of truth for analyzer configuration that doesn't depend on `.editorconfig` file placement.

```ini
# .globalconfig
is_global = true

dotnet_diagnostic.CA1822.severity = warning
dotnet_diagnostic.CA2007.severity = none
```

When both `.editorconfig` and `.globalconfig` configure the same rule, `.editorconfig` takes precedence for files in its scope. This lets you set global defaults and override them per-directory when needed.

## dotnet format

The `dotnet format` command ships with the .NET SDK (version 6 and later) and applies the formatting and style rules defined in your `.editorconfig` to your codebase. It reads the same configuration files that IDEs read, so the CLI and your editor always agree on what "correct" formatting looks like.

Running `dotnet format` against a solution or project rewrites files in place to match your rules. Running it with `--verify-no-changes` checks whether any files would change and exits with a non-zero code if they would, making it suitable for CI pipelines.

The command supports three sub-commands that control which rules it applies.

| Sub-command | What it fixes |
|-------------|--------------|
| `dotnet format whitespace` | Indentation, spacing, newlines |
| `dotnet format style` | Code style rules (IDE diagnostics) |
| `dotnet format analyzers` | Code quality rules (CA diagnostics) |

Running `dotnet format` without a sub-command applies all three categories. You can target specific projects, filter by diagnostic ID, or limit changes to specific files.

## Directory.Build.props

`Directory.Build.props` is an MSBuild file that applies properties to every project in the directory tree beneath it. Placing one at the repository root lets you configure analyzer behavior solution-wide without modifying individual `.csproj` files.

```xml
<Project>
  <PropertyGroup>
    <!-- Enforce code style rules during build, not just in IDE -->
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>

    <!-- Set analysis level (latest, preview, or specific version) -->
    <AnalysisLevel>latest-recommended</AnalysisLevel>

    <!-- Treat warnings as errors in Release builds -->
    <TreatWarningsAsErrors Condition="'$(Configuration)' == 'Release'">true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

`EnforceCodeStyleInBuild` is the most important setting here. Without it, IDE-style rules like the `IDE*` diagnostics only appear in the editor. With it enabled, those same rules produce warnings or errors during `dotnet build`, which means your CI pipeline catches style violations that a developer's IDE might have surfaced but they ignored.

`AnalysisLevel` controls which set of CA rules are active. The `latest-recommended` value enables all rules that Microsoft considers recommended for the current SDK version, with appropriate default severities. You can use `latest-all` to enable every available rule (though this tends to be noisy) or pin to a specific version like `8.0-recommended` for stability across SDK upgrades.

## CI Enforcement

Once `.editorconfig` and `Directory.Build.props` are in place, enforcing standards in a CI pipeline comes down to two checks.

**Format check**: Run `dotnet format --verify-no-changes` to confirm that all code matches the formatting rules. This catches cases where a developer committed code without their IDE applying the rules, or where a quick edit bypassed the formatter. If any file would change, the command exits with a non-zero code and lists the files that need formatting.

**Build check**: A normal `dotnet build` with `EnforceCodeStyleInBuild` enabled produces warnings and errors for style violations. Combined with `TreatWarningsAsErrors` in Release configuration, this fails the build on any violation. Running both checks ensures that formatting rules (whitespace, newlines) and style rules (naming, language preferences) are both enforced before code reaches the main branch.

The typical pattern is to run the format check first (since it's fast and catches the most common issues) and then run the full build, which catches deeper analyzer violations.

## Adopting Standards Incrementally

Introducing formatting enforcement to an existing codebase doesn't require fixing every file at once. A practical approach starts with rules set to `suggestion` severity and a single `dotnet format` pass to normalize whitespace and basic formatting. This creates one large but purely cosmetic commit that establishes the baseline.

From there, you can promote rules to `warning` severity in batches as the team becomes comfortable with them. Starting with the least controversial rules (indentation, brace placement, using directives) avoids overwhelming developers with hundreds of warnings. Naming conventions and more opinionated style rules like `var` preferences can follow once the team has bought into the approach.

Using a `.globalconfig` file for the initial rollout lets you set default severities in one place and track which rules are active at a glance. Developers can still override specific rules per-directory with `.editorconfig` if parts of the codebase need different treatment, such as a test project where certain CA rules add noise rather than value.

## Key Takeaways

**Commit your `.editorconfig` to source control.** It's the single source of truth for how code should look, and every editor and IDE that supports the standard will read it automatically.

**Use `EnforceCodeStyleInBuild` to close the gap between IDE and CI.** Without this setting, style rules only surface in the editor and developers can ignore them. With it, the build catches what the IDE caught.

**Start with formatting, then add style rules.** Whitespace and indentation are non-controversial. Run `dotnet format` once to normalize everything, then layer on code style and naming rules incrementally.

**Keep severity levels intentional.** Not every rule needs to be an error. Use `suggestion` for preferences, `warning` for team standards, and `error` only for rules that genuinely prevent bugs or break consistency in ways that matter.

**Let the tooling handle the debates.** Once the team agrees on rules and commits them to `.editorconfig`, formatting discussions in code reviews disappear. The CI pipeline becomes the enforcer, and developers focus on logic instead of style.
