---
title: "Architecture Governance Tools & Automation"
layout: guide
category: Architecture
subcategory: Leadership & Governance
description: "Practical tools and automation for implementing architecture governance - AWS, .NET, IaC, and security"
tags: [architecture, governance, automation, aws, security, practical]
---

## Tool Selection Strategy

<blockquote class="pull-quote">
<p>Start with problems, not tools. Prove value at each phase before expanding. Make governance automatic, not manual.</p>
</blockquote>

### Decision Matrix

| Organization Size | Complexity | Regulatory Requirements | Recommended Tools |
|-------------------|------------|-------------------------|-------------------|
| < 50 engineers | Single product | Low | Well-Architected + basic analyzers |
| 50-200 engineers | Multiple products | Medium | Control Tower + SonarQube + IaC policies |
| 200+ engineers | Many products/platforms | High | Full toolchain + custom automation |
| Any size | Simple apps | High (regulated) | Control Tower + Security Hub + audit tools |

### Key Questions

**1. What problem are we solving?**

| Problem | Solution |
|---------|----------|
| Inconsistent architecture | Code governance (ArchUnit, analyzers) |
| Cloud cost overruns | AWS cost governance (Budgets, tagging) |
| Security/compliance | Security Hub, Config, compliance automation |
| Non-compliant infrastructure | IaC validation (Guard, OPA) |

**2. What can we maintain?**
- Tools require ongoing maintenance, updates, and tuning
- Start small and expand based on demonstrated value
- Each tool needs a clear owner and purpose

## AWS Multi-Account Governance

### AWS Organizations + Control Tower

**What it is:** Organizations provides multi-account management, Control Tower adds automated governance guardrails.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>When to Use Control Tower</h4>
<ul>
<li>Multiple AWS accounts (or will have)</li>
<li>Need to prevent specific actions (like disabling CloudTrail)</li>
<li>Want automated account provisioning</li>
<li>Require consolidated billing and security</li>
<li>Organization is scaling</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>When NOT to Use</h4>
<ul>
<li>Single AWS account only (Organizations alone is sufficient)</li>
<li>Very early startup with 1-2 engineers (premature)</li>
<li>Not ready for multi-account complexity</li>
</ul>
</div>
</div>

**Why it's essential:**
- Prevents accidental or intentional policy violations
- Scalable governance across hundreds of accounts
- Built-in best practices via guardrails
- Foundation for other AWS governance services

### Account Structure

```
Root
├── Security (OU)
│   ├── Audit Account
│   └── Log Archive Account
├── Workloads (OU)
│   ├── Production (OU) ← Strict SCPs
│   └── Non-Production (OU) ← Moderate SCPs
└── Sandbox (OU) ← Permissive SCPs
```

### Service Control Policies (SCPs): Key Use Cases

| Use Case | When to Apply | Example |
|----------|---------------|---------|
| Prevent region usage | Always (cost/compliance) | Deny all actions except us-east-1, us-west-2 |
| Require encryption | Production accounts | Deny S3 PutObject without encryption |
| Limit instance types | Cost control | Deny EC2 RunInstances for large instance types |
| Protect resources | All accounts | Deny CloudTrail:StopLogging |

### Control Tower: Guardrails Priority

<div class="callout callout--tip">
<p class="callout__title">Start Small with Guardrails</p>
<p><strong>Mandatory (Preventive):</strong></p>
<ul>
<li>Disallow public read access to S3 buckets</li>
<li>Disallow changes to CloudTrail</li>
<li>Disallow deletion of AWS Config resources</li>
</ul>
<p><strong>Recommended (Detective):</strong></p>
<ul>
<li>Detect unencrypted EBS volumes</li>
<li>Detect unrestricted SSH access (0.0.0.0/0)</li>
<li>Detect root account usage</li>
</ul>
<p>Add custom guardrails only when you have specific needs. Don't enable everything "just in case."</p>
</div>

### AWS Config: Compliance Monitoring

**What it is:** Continuously evaluates AWS resource configurations against rules.

**When to use:**
- Need ongoing compliance monitoring (not just one-time checks)
- Require configuration history for audit
- Want automated remediation for drift
- Have specific compliance standards (PCI-DSS, HIPAA, etc.)

**When NOT to use:**
- Only need pre-deployment validation (use Guard/OPA instead)
- Can't afford the cost (charged per rule evaluation)
- Lack team capacity to respond to findings

### Practical Rule Selection

**Start with these rules only:**
- `s3-bucket-public-read-prohibited`
- `encrypted-volumes`
- `iam-password-policy`
- `required-tags` (customize for your tag strategy)

**Add more rules based on actual compliance failures, not hypothetically.**

### Custom Config Rules (.NET)

Use Config custom rules when:
- Built-in rules don't cover your specific governance needs
- You have organization-specific patterns to enforce
- You need logic beyond simple resource property checks

```csharp
// Example: Enforce naming conventions
public class NamingConventionConfigRule
{
    public async Task<ConfigRuleResult> FunctionHandler(
        ConfigRuleEvent configEvent,
        ILambdaContext context)
    {
        // Extract resource name
        var resourceName = configEvent.ConfigRuleInvokingEvent.Configuration["resourceName"];

        // Check against naming standard: {environment}-{app}-{resource-type}
        var pattern = @"^(dev|staging|prod)-[a-z0-9-]+-[a-z]+$";
        var compliant = Regex.IsMatch(resourceName, pattern);

        await ReportCompliance(configEvent, compliant);

        return new ConfigRuleResult { Compliant = compliant };
    }
}
```

**When to write custom rules:**
- After identifying repeated violations of org-specific standards
- When built-in rules are insufficient
- Not for every governance idea you have

### AWS Security Hub

**What it is:** Centralized security and compliance dashboard aggregating findings.

**When to use:**
- You have multiple security tools (GuardDuty, Inspector, Config, etc.)
- Need consolidated view of security posture
- Require compliance reporting (CIS, PCI-DSS standards)
- Want automated remediation workflows

**When NOT to use:**
- Don't need security aggregation (use tools directly)
- Only using Config (just use Config dashboard)
- Can't dedicate time to remediate findings

**Implementation priority:**
1. Enable Security Hub in all accounts
2. Enable CIS AWS Foundations Benchmark standard
3. Create automated responses for critical findings only
4. Review high/critical findings weekly

**Don't try to achieve 100% compliance immediately.** Focus on critical and high severity findings.

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

## Infrastructure as Code Governance

### AWS CloudFormation Guard

**What it is:** Policy-as-code for CloudFormation/CDK templates, runs pre-deployment.

**When to use:**
- Using CloudFormation or CDK
- Need to prevent non-compliant infrastructure before deployment
- Want fast feedback (runs in seconds)
- Already have CI/CD pipeline

**When NOT to use:**
- Using Terraform (use OPA instead)
- Need runtime compliance (use Config)
- Team hasn't standardized on IaC yet

**Essential rules:**

```
# Rule: Encryption mandatory for S3
let s3_buckets = Resources.*[ Type == 'AWS::S3::Bucket' ]
rule s3_encryption when %s3_buckets !empty {
    %s3_buckets.Properties.BucketEncryption EXISTS
}

# Rule: Required tags
rule required_tags {
    Resources.*.Properties.Tags[*].Key IN ["Environment", "Owner", "CostCenter"]
}

# Rule: No public access
let s3_buckets = Resources.*[ Type == 'AWS::S3::Bucket' ]
rule no_public_buckets when %s3_buckets !empty {
    %s3_buckets.Properties.PublicAccessBlockConfiguration EXISTS
    %s3_buckets.Properties.PublicAccessBlockConfiguration.BlockPublicAcls == true
}
```

**Implementation:**

```bash
# In CI/CD pipeline
cfn-guard validate \
  --rules org-policies.guard \
  --data template.yaml \
  --show-summary fail

# Exit code 1 if violations, blocks deployment
```

**Start with 5-10 critical rules based on past security incidents or compliance requirements.**

### CDK Aspects (For CDK Users)

**What it is:** Cross-cutting concerns applied to all CDK constructs in a stack.

**When to use:**
- Using CDK (not raw CloudFormation)
- Need to apply same policy across many resources
- Want type-safe governance logic
- Prefer C# over Guard's domain-specific language

**When NOT to use:**
- Using CloudFormation without CDK (use Guard)
- Need to govern existing deployed resources (use Config)

**Practical aspects:**

```csharp
// Aspect: Enforce encryption
public class EncryptionAspect : IAspect
{
    public void Visit(IConstruct node)
    {
        if (node is CfnBucket bucket && bucket.BucketEncryption == null)
        {
            Annotations.Of(node).AddError(
                "S3 buckets must have encryption enabled");
        }

        if (node is CfnDBInstance db && db.StorageEncrypted != true)
        {
            Annotations.Of(node).AddError(
                "RDS instances must have encryption enabled");
        }
    }
}

// Apply to stack
public class MyStack : Stack
{
    public MyStack(Construct scope, string id) : base(scope, id)
    {
        // Define resources...

        // Apply governance
        Aspects.Of(this).Add(new EncryptionAspect());
        Aspects.Of(this).Add(new RequiredTagsAspect());
    }
}
```

<div class="callout callout--note">
<p class="callout__title">Aspects vs Guard</p>
<p><strong>Use Aspects</strong> when you're already using CDK and need complex logic with type safety.</p>
<p><strong>Use Guard</strong> when you need simple policy validation or use both CDK and raw CloudFormation.</p>
<p>Many teams use both: Guard for simple checks, Aspects for complex logic.</p>
</div>

### Terraform + Open Policy Agent

**What it is:** Policy engine for Terraform plans, evaluates before apply.

**When to use:**
- Using Terraform (not CloudFormation)
- Need pre-deployment validation
- Want reusable policies across environments
- Part of Terraform Cloud/Enterprise workflow

**Implementation:**

```rego
package terraform.policies

# Deny production resources without proper tags
deny[msg] {
    resource := input.resource_changes[_]
    resource.change.after.tags.Environment == "production"
    not resource.change.after.tags.CostCenter
    msg := sprintf("Production resource %s missing CostCenter tag", [resource.address])
}

# Deny unapproved instance types in production
allowed_prod_instances := ["t3.medium", "t3.large", "m5.large", "m5.xlarge"]

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    resource.change.after.tags.Environment == "production"
    not resource.change.after.instance_type in allowed_prod_instances
    msg := sprintf("Instance type %s not approved for production", [resource.change.after.instance_type])
}
```

**Integration:**

```bash
# Generate Terraform plan
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json

# Evaluate policies
opa eval --data policies/ --input tfplan.json "data.terraform.policies.deny"

# Block if violations found
```

## Security Governance Automation

### AWS Secrets Manager

**What it is:** Managed service for secrets with automatic rotation.

**When to use:**
- Storing database credentials, API keys, certificates
- Need automatic rotation
- Want audit trail of secret access
- Multi-environment applications

**When NOT to use:**
- Configuration values (use Parameter Store - cheaper)
- Values that rarely change (Parameter Store)
- Very high throughput requirements (cache secrets)

**.NET integration:**

```csharp
// Automatic secrets loading
public static IHostBuilder CreateHostBuilder(string[] args) =>
    Host.CreateDefaultBuilder(args)
        .ConfigureAppConfiguration((context, config) =>
        {
            config.AddSecretsManager(
                configurator: options =>
                {
                    // Only load secrets for current environment
                    options.SecretFilter = entry =>
                        entry.Name.StartsWith($"{context.HostingEnvironment.EnvironmentName}/");

                    // Refresh every 5 minutes
                    options.PollingInterval = TimeSpan.FromMinutes(5);
                });
        });

// Use in code - no changes needed
public class MyService
{
    private readonly string _apiKey;

    public MyService(IConfiguration configuration)
    {
        // Automatically from Secrets Manager
        _apiKey = configuration["Production/ExternalApi:ApiKey"];
    }
}
```

**Governance benefits:**
- No secrets in code or config files
- Automatic rotation enforced
- Audit trail via CloudTrail
- Integration with .NET configuration system

**Cost consideration:** Secrets Manager costs $0.40/secret/month + $0.05 per 10,000 API calls. Use Parameter Store for non-sensitive config.

## Cost Governance

### AWS Budgets + Cost Anomaly Detection

**What it is:** Budget alerts and automatic anomaly detection for spending.

**When to use:**
- Cloud spend > $1000/month
- Multiple teams/projects sharing accounts
- Need proactive cost alerts
- Experienced cost overruns

**Implementation priority:**

**1. Budgets (set up first):**

```csharp
// Create budget per team/environment
var budget = new Budget
{
    BudgetName = "TeamA-Production-Budget",
    BudgetType = BudgetType.COST,
    TimeUnit = TimeUnit.MONTHLY,
    BudgetLimit = new Spend { Amount = 5000, Unit = "USD" },
    CostFilters = new Dictionary<string, List<string>>
    {
        ["TagKeyValue"] = new List<string> { "Team$TeamA", "Environment$production" }
    }
};

// Alert at 80% and 100%
var notifications = new[]
{
    new { Threshold = 80, Email = "team-a-leads@company.com" },
    new { Threshold = 100, Email = "team-a@company.com" }
};
```

**2. Cost Anomaly Detection (after budgets):**
- Automatically detects unusual spending patterns
- Notifies before month-end surprises
- Works across all services

**Why this sequence:**
- Budgets prevent runaway costs
- Anomaly detection catches unexpected spikes
- Together provide comprehensive cost governance

### Tagging Strategy

**What it is:** Consistent resource tagging for cost allocation and governance.

**Required tags (enforce with IaC policies):**

| Tag | Purpose | Example Values |
|-----|---------|----------------|
| Environment | Cost segregation, policy application | dev, staging, prod |
| Owner | Accountability | team-email@company.com |
| CostCenter | Chargeback/showback | CC-1001, CC-1002 |
| Project | Initiative tracking | Migration2024, FeatureX |

**Enforcement approaches:**

**1. IaC Validation (preventive):**

```
# CloudFormation Guard
rule required_tags {
    Resources.*.Properties.Tags[*].Key == "Environment"
    Resources.*.Properties.Tags[*].Key == "Owner"
    Resources.*.Properties.Tags[*].Key == "CostCenter"
}
```

**2. Config Rule (detective):**
- `required-tags` rule checks existing resources
- Automated remediation or notification

**3. Tag Policies (AWS Organizations):**
- Enforce tag keys and allowed values
- Prevent tag removal

**Start with 3-4 tags only.** Add more as you prove value of existing tags.

## Implementation Roadmap

<blockquote class="pull-quote">
<p>Demonstrate value at each phase before moving to the next. Adjust priorities based on your specific pain points, not a generic roadmap.</p>
</blockquote>

### Phase 1: Quick Wins (Week 1-4)

**Goal:** Get immediate value with minimal setup.

1. **Deploy Roslyn analyzers**
   - Package critical security and pattern rules
   - Distribute via NuGet
   - *Why first: Fast feedback, no infrastructure, prevents bad code*

2. **Set up AWS Budgets**
   - One budget per environment
   - Alert at 80% threshold
   - *Why first: Prevents cost surprises immediately*

3. **Enable basic Config rules**
   - S3 public access
   - Encryption requirements
   - *Why first: Immediate security improvements*

### Phase 2: Foundation (Month 2-3)

**Goal:** Build governance infrastructure.

1. **Enable AWS Control Tower** (if multi-account)
   - Set up mandatory guardrails only
   - Configure account factory
   - *Why now: Foundation for all other AWS governance*

2. **Implement IaC validation**
   - CloudFormation Guard or OPA policies
   - 5-10 critical rules (encryption, tagging, public access)
   - Integrate into CI/CD
   - *Why now: Prevents non-compliant deployments*

3. **Deploy SonarQube**
   - Realistic quality gates
   - PR workflow integration
   - *Why now: Builds on Roslyn analyzers, provides trends*

### Phase 3: Expansion (Month 4-6)

**Goal:** Add comprehensive monitoring and enforcement.

1. **Enable AWS Security Hub**
   - Critical compliance rules only
   - Weekly review cadence
   - *Why now: Continuous monitoring of deployed resources*

2. **Add ArchUnit.NET** (if applicable)
   - 2-3 critical architecture rules
   - Run in CI/CD
   - *Why now: Enforces architecture maturity*

3. **Implement Secrets Manager**
   - Migrate hardcoded secrets
   - Configure automatic rotation
   - *Why now: Security improvement with proven IaC governance*

### Phase 4: Optimization (Month 7+)

**Goal:** Fine-tune and automate.

1. **Enable Cost Anomaly Detection**
   - Automated alerting
   - Anomaly investigation workflow

2. **Automated remediation**
   - Config auto-remediation for safe changes
   - EventBridge integration for custom workflows

3. **Governance metrics**
   - Compliance dashboards
   - Trend analysis
   - ROI measurement

**Critical success factor:** Demonstrate value at each phase before moving to next phase. Adjust priorities based on your specific pain points.

## Key Takeaways

**Starting point:**
- Always start with Roslyn analyzers and AWS Budgets (low cost, immediate value)
- Don't deploy all tools at once - prove value incrementally
- Choose tools based on actual problems, not hypothetical needs

**AWS governance tools:**
- Control Tower is essential for multi-account governance (start here for AWS)
- Config for continuous monitoring, Guard for pre-deployment validation (both needed, different purposes)
- Security Hub when you have multiple security tools to consolidate
- Budgets before anomaly detection (prevent before detect)

**.NET governance tools:**
- Roslyn analyzers provide fastest feedback and should always be used
- SonarQube for quality trends and PR gates (after analyzers)
- ArchUnit.NET only for applications with strict architecture patterns
- NDepend for large codebases with technical debt problems

**IaC governance tools:**
- CloudFormation Guard for AWS CloudFormation/CDK
- OPA for Terraform
- Start with 5-10 critical rules, expand based on violations
- Enforce in CI/CD, not manually

**Security governance tools:**
- Secrets Manager for credentials requiring rotation
- Parameter Store for non-sensitive configuration (cheaper)
- IAM Access Analyzer to detect unintended external access
- Automate rotation, don't rely on manual processes

**Implementation approach:**
- Phase 1: Quick wins (Roslyn, Budgets, basic Config)
- Phase 2: Foundation (Control Tower, IaC validation, SonarQube)
- Phase 3: Monitoring (Security Hub, ArchUnit, Secrets Manager)
- Phase 4: Optimization (automation, metrics, tuning)

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
