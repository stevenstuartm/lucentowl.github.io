---
title: "Automating Architecture Governance"
layout: guide
category: Architecture
subcategory: Governance
description: "How to enforce architecture decisions automatically with compile-time analyzers, CI quality gates, and architecture rules written as tests, and how policy-as-code extends the same idea to infrastructure."
tags: [architecture, governance, automation, archunit, roslyn-analyzers, sonarqube, practical]
---

## Choosing What to Automate

<blockquote class="pull-quote">
<p>Start with problems, not tools. Prove value at each phase before expanding. Make governance automatic, not manual.</p>
</blockquote>

### Key Questions

**1. What problem are we solving?**

| Problem | Solution |
|---------|----------|
| Inconsistent architecture | Architecture rules as tests (ArchUnit.NET) |
| Recurring code-level violations | Compile-time analyzers (Roslyn) |
| Code quality drifting over time | CI quality gates (SonarQube) |
| Non-compliant infrastructure | Policy-as-code checks on infrastructure templates |

**2. What can we maintain?**
- Tools require ongoing maintenance, updates, and tuning
- Start small and expand based on demonstrated value
- Each tool needs a clear owner and purpose

## Code Quality Governance (.NET)

### Tool Decision Framework

| Need | Tool | When to Use | When NOT to Use |
|------|------|-------------|-----------------|
| Enforce architecture rules | ArchUnit.NET | Layered architecture, DDD, strict boundaries | Small apps, prototypes |
| Comprehensive analysis | NDepend | Large codebases, technical debt tracking | < 50k LOC, tight budget |
| CI/CD quality gates | SonarQube | All teams after PoC stage | Solo developers, hobby projects |
| Real-time feedback | Roslyn Analyzers | Always (low cost, high value) | Always use this |

### Roslyn Analyzers (Start Here)

<div class="callout callout--tip">
<p class="callout__title">Always Start with Roslyn Analyzers</p>
<p><strong>Why start here:</strong></p>
<ul>
<li>Zero infrastructure required</li>
<li>Catches issues immediately at compile time</li>
<li>Free and built into .NET SDK</li>
<li>Easily distributed via NuGet</li>
<li>Fastest feedback loop possible</li>
</ul>
</div>

**What it is:** Compile-time code analysis integrated into Visual Studio/VS Code.

**Implementation:**

```csharp
// Create NuGet package: YourOrg.Analyzers
[DiagnosticAnalyzer(LanguageNames.CSharp)]
public class RequireConfigurationValidationAnalyzer : DiagnosticAnalyzer
{
    private static readonly DiagnosticDescriptor Rule = new DiagnosticDescriptor(
        id: "ORG001",
        title: "Configuration classes must have validation",
        messageFormat: "Class {0} uses IOptions but doesn't implement IValidatableObject",
        category: "Reliability",
        defaultSeverity: DiagnosticSeverity.Warning,
        isEnabledByDefault: true);

    // Implementation details...
}
```

**What to enforce:**
- Security rules (no hardcoded secrets, secure random, modern TLS)
- Organization patterns (naming conventions, required attributes)
- Reliability (configuration validation, null checks)

**What NOT to enforce:**
- Stylistic preferences (use .editorconfig)
- Complex business rules (belongs in tests)
- Anything that slows down builds significantly

### SonarQube (Next Priority)

**What it is:** Continuous code quality platform with quality gates.

**When to add:**
- After Roslyn analyzers are in place
- Team is > 5 engineers
- Technical debt is becoming problematic
- Need quality trends over time

**Quality gate strategy:**

```yaml
# Start with achievable standards, tighten over time
conditions:
  - metric: new_coverage
    operator: LESS_THAN
    value: 70  # Not 80 - be realistic
  - metric: new_security_rating
    operator: WORSE_THAN
    value: A  # Security is non-negotiable
  - metric: new_maintainability_rating
    operator: WORSE_THAN
    value: B  # Allow some technical debt in new code
```

**Why this works:**
- Quality gates run in PR workflow
- Blocks merge if standards not met
- Tracks improvement over time

**Common mistake:** Setting quality gates too high initially. Start achievable, improve gradually.

### ArchUnit.NET (For Architecture Enforcement)

**What it is:** Unit tests for architecture rules.

**When to use:**
- Clean/Onion/Hexagonal architecture with strict boundaries
- Domain-Driven Design with protected aggregates
- Multi-team projects needing consistency
- After architecture violations cause production issues

**When NOT to use:**
- Simple CRUD applications
- Prototypes or MVPs
- Teams unfamiliar with the architecture pattern
- Before architecture is stable

**Practical examples:**

```csharp
public class ArchitectureTests
{
    // Test 1: Enforce layering (most important)
    [Fact]
    public void DomainLayer_ShouldNotDependOn_ApplicationOrInfrastructure()
    {
        var domain = ArchRuleDefinition.Types()
            .That().ResideInNamespace("MyApp.Domain.*");

        var forbidden = ArchRuleDefinition.Types()
            .That().ResideInNamespace("MyApp.Application.*")
            .Or().ResideInNamespace("MyApp.Infrastructure.*");

        domain.Should().NotDependOnAny(forbidden).Check(Architecture);
    }

    // Test 2: Enforce naming conventions
    [Fact]
    public void Repositories_MustImplement_IRepository()
    {
        ArchRuleDefinition.Classes()
            .That().HaveNameEndingWith("Repository")
            .Should().ImplementInterface("IRepository")
            .Check(Architecture);
    }
}
```

**Start with 2-3 critical rules only.** Add more as architecture matures.

## Policy as Code for Infrastructure

The same principle applies to infrastructure: express standards as machine-checked policies and evaluate them in the pipeline, not in a review meeting after deployment.

- **Preventive checks** evaluate infrastructure templates or plans before deployment and block non-compliant changes.
- **Detective checks** evaluate resources that already exist and catch drift that bypassed the pipeline.

Most organizations need both. The tooling is platform-specific: each cloud and IaC tool has its own policy engine and rule language.

## Rolling Out Automation

<blockquote class="pull-quote">
<p>Demonstrate value at each phase before moving to the next. Adjust priorities based on your specific pain points, not a generic roadmap.</p>
</blockquote>

1. **Deploy Roslyn analyzers.** Package critical security and pattern rules and distribute them via NuGet. *Why first: fast feedback, no infrastructure, prevents bad code.*
2. **Add CI quality gates.** Realistic SonarQube gates in the PR workflow. *Why next: builds on analyzers and provides trends.*
3. **Add architecture tests.** Two or three critical ArchUnit.NET rules running in CI, once the architecture is stable enough to encode. *Why later: enforces architecture maturity rather than guessing at it.*
4. **Extend to infrastructure.** Preventive policy checks for the few rules that past incidents or compliance requirements justify.

## Key Takeaways

**Starting point:**
- Always start with Roslyn analyzers (low cost, immediate value)
- Don't deploy all tools at once - prove value incrementally
- Choose tools based on actual problems, not hypothetical needs

**.NET governance tools:**
- Roslyn analyzers provide fastest feedback and should always be used
- SonarQube for quality trends and PR gates (after analyzers)
- ArchUnit.NET only for applications with strict architecture patterns
- NDepend for large codebases with technical debt problems

**Common mistakes to avoid:**
- Implementing all tools simultaneously (overwhelming)
- Setting quality/compliance bars too high initially (creates resistance)
- Choosing tools before understanding problems (solution in search of problem)
- Not defining clear ownership for tool maintenance (tools degrade without care)
- Measuring adoption instead of outcomes (focus on value, not usage)

**Success factors:**
- Start with problems, not tools
- Prove value at each phase
- Make governance automatic, not manual
- Focus on critical rules, not comprehensive coverage
- Integrate into existing workflows
- Define clear ownership and maintenance processes
