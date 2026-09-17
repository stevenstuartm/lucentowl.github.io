---
title: "Automating Architecture Governance"
layout: guide
category: Architecture
subcategory: Governance
description: "Turning architecture decisions into checks that run on every change: where each kind of check belongs in the feedback loop, Roslyn analyzers and banned-API rules, architecture rules written as ArchUnitNET tests, SonarQube quality gates focused on new code, policy as code for infrastructure, and rolling checks out with baselines instead of big-bang enforcement."
tags: [practical, governance, roslyn-analyzers, archunitnet, sonarqube, fitness-functions, policy-as-code]
---

An architecture decision that lives only in a document gets forgotten, reinterpreted, or quietly worked around, one pull request at a time. Automated governance turns the decisions that can be stated precisely into checks that run on every change, such as "the domain layer doesn't reference infrastructure," "nothing reads the system clock directly," or "new code doesn't lower test coverage." Each check is a fitness function for one architectural characteristic. It frees reviewers to spend their attention on what automation can't judge.

Automation doesn't replace governance conversations. It enforces the outcomes of those conversations consistently, at a cost of nearly nothing per change, and it tells a developer about a violation minutes after writing it rather than weeks later in a review.

## Where Each Check Belongs

The earlier a check runs, the cheaper the violation is to fix. Each kind of rule has a natural place in the feedback loop.

| Stage | Feedback time | Checks that fit | Examples |
|---|---|---|---|
| **Editor and build** | Seconds | Rules about individual code constructs | Roslyn analyzers, banned APIs, nullable warnings |
| **Test run** | Minutes | Rules about relationships across the codebase | Layer dependencies, naming and placement conventions as architecture tests |
| **Pull request gate** | Minutes to an hour | Rules about trends and aggregate quality of the change | Coverage, duplication, and new issues on changed code |
| **Deployment pipeline** | Before release | Rules about infrastructure and configuration | Policy checks on infrastructure templates and plans |
| **Running environment** | Continuous | Rules about what actually exists | Detective policy checks for drift that bypassed the pipeline |

A rule placed too late in the loop frustrates developers, who learn about a problem after they've moved on. A rule placed too early slows every build for checks that only matter at release. Most rules have one right place.

## Analyzers

### Built-In Analyzers

The .NET SDK includes the .NET code quality and style analyzers, so every project already runs a baseline of rules for correctness, security, performance, and reliability. Governance starts by deciding how strict they are and making that decision the same for every repository. Project properties set the overall level:

```xml
<PropertyGroup>
  <AnalysisLevel>latest-recommended</AnalysisLevel>
  <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
</PropertyGroup>
```

An `.editorconfig` file then raises or lowers individual rules. Placing these settings in a shared `Directory.Build.props` and `.editorconfig`, or in a NuGet package every repository references, keeps rules consistent across teams without copying configuration by hand.

```ini
[*.cs]
# SQL built from string concatenation is a security defect, not a warning.
dotnet_diagnostic.CA2100.severity = error
```

### Banning APIs

Many architecture decisions come down to "don't call that." Reading `DateTime.UtcNow` directly makes time-dependent logic untestable, so a team standardizes on `TimeProvider`. A legacy HTTP client wrapper is being retired. A logging call bypasses structured logging. The [banned API analyzer](https://github.com/dotnet/roslyn-analyzers/blob/main/src/Microsoft.CodeAnalysis.BannedApiAnalyzers/BannedApiAnalyzers.Help.md){:target="_blank" rel="noopener noreferrer"} (`Microsoft.CodeAnalysis.BannedApiAnalyzers`) enforces decisions like these from a text file listing symbols and the reason each is banned:

```text
P:System.DateTime.Now;Use TimeProvider so time can be controlled in tests
P:System.DateTime.UtcNow;Use TimeProvider so time can be controlled in tests
T:Shop.Legacy.HttpClientWrapper;Retired, use the typed clients registered in DI
```

The file is added to the project as `<AdditionalFiles Include="BannedSymbols.txt" />`, and any use of a listed symbol raises a diagnostic with the stated reason. The reason text matters, since a developer who hits the rule learns the decision and its replacement in the same message.

### Custom Analyzers

When a rule depends on code structure that a banned list can't express, such as "every message handler must be idempotent-keyed" or "controllers must not return domain entities," a custom Roslyn analyzer can check it. Custom analyzers are production code in their own right, with tests and maintenance, so they earn their cost for rules that are violated often, have caused incidents, and can't be expressed with existing analyzers or architecture tests. An organization-wide analyzer package distributed through NuGet gives every repository the same rules and lets them be updated centrally.

Analyzers are the wrong place for style preferences that `.editorconfig` already handles, and for rules that need the whole compiled codebase to judge, which architecture tests handle better.

## Architecture Rules as Tests

Rules about how parts of a codebase relate, such as which layers may reference which, where types of a given kind must live, and which modules may depend on each other, are awkward for analyzers and natural as tests. [ArchUnitNET](https://github.com/TNG/ArchUnitNET){:target="_blank" rel="noopener noreferrer"} loads compiled assemblies and evaluates rules written in a fluent API, reporting each violating type when a rule fails. NetArchTest offers a similar approach with a smaller API.

```csharp
using ArchUnitNET.Domain;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

public class ArchitectureTests
{
    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(
            typeof(Order).Assembly,
            typeof(PlaceOrderHandler).Assembly,
            typeof(OrdersDbContext).Assembly)
        .Build();

    // ResideInNamespace matches one exact namespace. A pattern needs the Matching variant.
    private static readonly IObjectProvider<IType> DomainLayer =
        Types().That().ResideInNamespaceMatching(@"^Shop\.Domain(\..+)?$").As("Domain layer");

    private static readonly IObjectProvider<IType> InfrastructureLayer =
        Types().That().ResideInNamespaceMatching(@"^Shop\.Infrastructure(\..+)?$").As("Infrastructure layer");

    [Fact]
    public void Domain_does_not_depend_on_infrastructure()
    {
        Types().That().Are(DomainLayer)
            .Should().NotDependOnAny(InfrastructureLayer)
            .Check(Architecture);
    }

    [Fact]
    public void Repositories_implement_the_repository_interface()
    {
        Classes().That().HaveNameEndingWith("Repository")
            .Should().ImplementInterface(typeof(IRepository))
            .Check(Architecture);
    }

    [Fact]
    public void Layer_definitions_match_real_types()
    {
        Assert.NotEmpty(DomainLayer.GetObjects(Architecture));
        Assert.NotEmpty(InfrastructureLayer.GetObjects(Architecture));
    }
}
```

The last test guards against the easiest mistake with architecture tests. A rule whose selection matches no types has nothing to violate, so it passes forever. A namespace renamed during a refactoring, or a pattern written as `"Shop.Domain.*"` against an API that expects an exact namespace, silently turns an enforced rule into a test that checks nothing. Asserting that each layer definition selects real types catches that.

Architecture tests fit codebases with an intended structure the team wants to protect, such as layered or hexagonal architectures, modular monoliths whose modules must stay independent, and domain models that must not leak infrastructure concerns. They add little to a small service with no internal boundaries, or to an architecture still being discovered, where encoding today's structure would lock in guesses. A few rules that protect the boundaries the team cares most about tend to outlast a large rule set that encodes every convention.

## Quality Gates

A quality gate is a set of conditions a change must meet before it merges, evaluated in the pull request. [SonarQube](https://docs.sonarsource.com/sonarqube-server/){:target="_blank" rel="noopener noreferrer"} is a common platform for it, and its gates are defined in the SonarQube UI or through its Web API rather than in a file in the repository. The built-in Sonar way gate applies to new code only: no new issues introduced, all new security hotspots reviewed, coverage of new code of at least 80%, and duplication in new code of at most 3%.

Gating new code rather than overall code is what makes quality gates adoptable in an existing codebase. A gate on total coverage fails every pull request in a legacy codebase with 30% coverage, and teams either disable it or stop trusting it. A gate on new code holds every change to the standard without demanding that the whole codebase be fixed first, and overall quality improves as code is touched.

Gate conditions still need judgment. A coverage threshold rewards tests that execute lines without checking behavior, so it works best alongside review rather than as the only signal of test quality. Conditions on security issues and reliability bugs tend to deserve less flexibility than conditions on maintainability.

Tools that analyze the whole codebase over time, such as NDepend with its LINQ-based rule queries, add trend analysis and dependency visualization for large .NET codebases. They suit teams tracking technical debt and structural erosion across many releases, more than teams needing a merge gate.

## Policy as Code for Infrastructure

The same idea extends beyond application code. Infrastructure standards, such as encryption at rest, no public storage buckets, required tags, and approved regions, can be written as machine-checked policies and evaluated automatically rather than in a review meeting after deployment.

- **Preventive checks** evaluate infrastructure templates or deployment plans in the pipeline and block non-compliant changes before they're applied.
- **Detective checks** evaluate resources that already exist and catch drift from changes made outside the pipeline, such as a console edit during an incident.

Most organizations need both, since preventive checks only see changes that go through the pipeline. The tooling is platform-specific, since each cloud and infrastructure-as-code tool has its own policy engines and rule languages. The governance decisions are the same ones that apply to code, such as which policies are mandatory, where they run, and how a justified exception is recorded.

## Rolling Out Automation

### Start From Decisions That Matter

The best candidates for automation are decisions that are violated often, whose violations are costly, and that can be stated precisely. A rule prompted by an incident, such as a service that called another's database directly, has an obvious justification developers will accept. A rule prompted by someone's preference invites workarounds.

### Baseline, Then Ratchet

Turning on a strict rule in an existing codebase usually produces hundreds of violations at once, and a check that fails every build gets disabled. A ratchet avoids this:

1. **Measure.** Run the rule in report-only mode and count existing violations.
2. **Baseline.** Record the existing violations as accepted, for example with suppressions, a warning severity, or a quality gate scoped to new code.
3. **Enforce on new code.** Fail builds only for violations introduced after the baseline.
4. **Pay down.** Reduce the baseline over time, and tighten the rule when it reaches zero.

The ratchet only moves one way. New violations fail, and the accepted set only shrinks.

### Make Failures Self-Explanatory

A failing check should tell a developer what rule was broken, why the rule exists, and what to do instead. A diagnostic reading "RS0030: DateTime.UtcNow is banned, use TimeProvider so time can be controlled in tests" teaches the decision. An architecture test failure that names the violating type and the layer it shouldn't reference points straight at the fix. A check that fails with only a rule ID sends developers to search for the reason or ask someone, and pushes them toward suppressing it.

### Give Every Rule an Owner and an Exception Path

Rules outlive the reasons they were written unless someone reviews them. Each automated rule needs an owner who can explain it and retire it, and a documented way to make a justified exception, such as a suppression with a required justification comment, so exceptions stay visible instead of being hidden by disabling the check.

## Common Pitfalls

- **Enforcing everything at once.** Hundreds of new failures lead teams to disable the checks. Baseline existing violations and enforce on new code.
- **Rules that match nothing.** An architecture rule over a mistyped or renamed namespace passes forever. Assert that each selection contains types.
- **Gates on overall metrics in legacy code.** A total-coverage gate fails every change in an under-tested codebase. Gate new code.
- **Checks in the wrong place.** Slow whole-codebase analysis in every local build, or code-level rules discovered only at release. Match each rule to its stage.
- **Failures without reasons.** A bare rule ID invites suppression. Put the decision and its replacement in the message.
- **Silent suppressions.** Disabling a check to unblock a change hides the exception. Require a justification with every suppression.
- **Automating preferences.** Rules without a clear cost behind them breed resentment and workarounds. Automate decisions that protect something.

## Quick Reference

| Tool or technique | Enforces | Runs at | Best for |
|---|---|---|---|
| **Built-in .NET analyzers** | Correctness, security, performance, and reliability rules on code constructs | Editor and build | A consistent baseline across every repository |
| **Banned API analyzer** | "Don't call this" decisions, with the reason in the diagnostic | Editor and build | Retired APIs, testability rules, mandated wrappers |
| **Custom Roslyn analyzer** | Organization-specific rules on code structure | Editor and build | Frequently violated, costly rules no existing tool expresses |
| **ArchUnitNET or NetArchTest** | Dependencies between layers and modules, placement and naming rules | Test run | Protecting an intended structure |
| **SonarQube quality gate** | Conditions on new issues, hotspots, coverage, and duplication in changed code | Pull request | Holding every change to a standard in an existing codebase |
| **NDepend** | Queryable rules and trends across a large .NET codebase | Scheduled or CI analysis | Tracking structural erosion and technical debt over time |
| **Preventive policy checks** | Infrastructure standards on templates and plans | Deployment pipeline | Blocking non-compliant infrastructure before it exists |
| **Detective policy checks** | Infrastructure standards on deployed resources | Continuously | Catching drift from changes outside the pipeline |
