---
title: "IaC Testing Strategies"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "How to test infrastructure code at each level and what each catches: static analysis and security scanners, conditions built into modules, plan-based and mocked unit tests with terraform test and CDK assertions, integration tests against real resources, policy checks before deployment, and which check belongs at which stage of the pipeline."
tags: [practical, testing, static-analysis, policy-as-code, checkov, terratest]
---

## What Each Kind of Test Can See

Infrastructure code fails in several distinct ways, and no single check sees all of them. A typo or a wrong type fails before anything runs. A storage bucket left public deploys without complaint and is only wrong by policy. A module whose conditional picks the wrong instance size is a logic error in otherwise valid code. And some failures only happen against the real cloud: a missing permission, a quota, a value the API rejects, a resource that isn't ready when the next one needs it.

Each testing level looks at a different artifact, so each catches a different share of those failures:

| Level | Looks at | Catches | Misses | Cost |
|---|---|---|---|---|
| **Static analysis** | The code | Syntax and type errors, invalid values a linter knows about, insecure or non-compliant settings written in the code | Values only known at plan or apply time, and anything about behavior | Seconds, free |
| **Plan-based and mocked tests** | The plan, or a simulated run | Module logic: what gets created for given inputs, and whether bad inputs are rejected | Anything the real cloud API would reject | Seconds to a minute, free |
| **Policy checks on the plan** | The plan, with every value resolved that can be | Organizational rules applied to what will actually be created, including through modules | Runtime behavior | Seconds |
| **Integration tests** | Real resources in a test account | Permissions, quotas, API validation, ordering, and whether the pieces actually connect | Production-scale behavior | Minutes to an hour, plus cloud cost |
| **Smoke tests after deployment** | A deployed environment | Whether the system works as a whole | Little, but it is the latest and most expensive point to learn something | Minutes, on every deployment |

The shape that follows is the familiar test pyramid: many cheap checks that run on every change, fewer expensive ones that run less often. There is no fixed ratio between the levels, and the right mix depends on how much logic the code holds. A thin configuration calling well-tested modules needs little beyond static analysis and a plan review. A shared module used across an organization earns the full set.

---

## Static Analysis

Static analysis reads the code without running it. It gives feedback in seconds, so it belongs on every commit.

- **Formatting and validation.** `terraform fmt` and `terraform validate` (and their OpenTofu equivalents), `bicep lint`, and [cfn-lint](https://github.com/aws-cloudformation/cfn-lint){:target="_blank" rel="noopener noreferrer"} for CloudFormation catch syntax errors, wrong types, and references to things that don't exist.
- **Provider-aware linters.** [TFLint](https://github.com/terraform-linters/tflint){:target="_blank" rel="noopener noreferrer"} knows each cloud's rules through plugins, so it flags an instance type that doesn't exist, along with deprecated syntax and unused declarations.
- **Security and misconfiguration scanners** check code against libraries of rules, such as storage without encryption or a security group open to the internet. [Checkov](https://www.checkov.io/){:target="_blank" rel="noopener noreferrer"} and [KICS](https://kics.io/){:target="_blank" rel="noopener noreferrer"} cover Terraform, CloudFormation, Bicep, Kubernetes manifests, and more. [Trivy](https://trivy.dev/){:target="_blank" rel="noopener noreferrer"} covers Terraform, CloudFormation, ARM templates, and Kubernetes. [PSRule for Azure](https://azure.github.io/PSRule.Rules.Azure/){:target="_blank" rel="noopener noreferrer"} checks Bicep and ARM templates against Azure's Well-Architected guidance.

Scanners come and go, so check a tool's status before adopting it. tfsec's maintainers now direct users to Trivy, which absorbed its checks. Terrascan was archived in 2025 and no longer receives rule updates. cfn_nag, an older CloudFormation scanner, has seen little recent development.

Static analysis has a blind spot. A scanner reading code sees `encrypted = var.encrypt`, not the value the variable will have, and it may not follow a module call into the module's source. Several scanners, Checkov among them, can also read a plan exported as JSON, where those values are resolved. Scanners also produce false positives, so each tool supports suppressing a rule on a specific resource. Requiring a written reason on every suppression keeps them reviewable.

---

## Conditions Built Into the Code

Some checks belong inside the module itself, where they run on every plan and apply rather than only in a test suite. Terraform offers three kinds. A `validation` block on a variable rejects bad input. A `precondition` or `postcondition` on a resource asserts something about it before or after it is created, such as a machine image being built for the right architecture. A `check` block states something that should hold about the running infrastructure, and it warns rather than failing the run. These conditions protect every caller of the module, and tests can then confirm they fire.

---

## Unit Tests Without Real Resources

A unit test checks a module's logic: given these inputs, does it plan the right resources, and does it reject inputs it should reject? It should run in seconds and create nothing.

### Terraform's Test Framework

Terraform 1.6 added `terraform test`, and OpenTofu has the same framework as `tofu test`. Tests live in `.tftest.hcl` files made of `run` blocks, each of which runs a plan or an apply and then checks assertions. With `command = plan`, nothing is created:

```hcl
variables {
  name        = "logs"
  environment = "dev"
}

run "logs_bucket_is_versioned" {
  command = plan

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "The module must enable versioning."
  }
}

run "rejects_unknown_environment" {
  command = plan

  variables {
    environment = "qa"
  }

  expect_failures = [var.environment]
}
```

The file-level `variables` block gives every run its inputs, and a run overrides only what it tests. The second run passes only if the variable's validation rule rejects `qa`, which is how a module's input checks get tested. `expect_failures` can name preconditions, postconditions, and check blocks the same way.

A plan-mode test creates nothing, but it still configures the real provider, which needs credentials and reads the cloud for data sources. And a plan leaves values unknown when only the cloud can supply them, such as a generated ID, so assertions on those need an apply. Terraform 1.7 added *mock providers*, which return made-up values in place of real API calls, along with overrides for individual resources and data sources. With them, a test runs without credentials or cost. Mocks only return what the test author told them to, though, so they cannot reveal how the real API behaves, which is why integration tests still exist.

### Programming-Language Tools

Tools built on a general-purpose language use its own test frameworks. An AWS CDK stack can be synthesized in a test and its template checked with the assertions library:

```csharp
var app = new App();
var stack = new LoggingStack(app, "Test");
var template = Template.FromStack(stack);

template.HasResourceProperties("AWS::S3::Bucket", new Dictionary<string, object>
{
    ["VersioningConfiguration"] = new Dictionary<string, object> { ["Status"] = "Enabled" }
});
```

Pulumi supports the same idea by running the program against mocks, which stand in for the engine and the cloud, inside the language's normal test runner. CDK also supports *snapshot* tests, which compare the whole synthesized template with a stored copy. AWS's guidance is that they help most during refactoring, since any CDK upgrade that changes the generated template breaks them.

---

## Integration Tests Against Real Resources

The failures that only appear against the real cloud, such as permissions, quotas, and API rejections, need an integration test. It deploys the module into a dedicated test account, checks the result, and destroys it.

`terraform test` does this with its default `command = apply`, creating real resources and destroying them when the test file finishes. For checks beyond comparing attributes, such as calling an HTTP endpoint and retrying until it answers, [Terratest](https://terratest.gruntwork.io/){:target="_blank" rel="noopener noreferrer"} lets tests written in Go deploy with Terraform and then exercise the result with the cloud's SDKs. Kitchen-Terraform, an older option, was deprecated when `terraform test` arrived and archived in 2024.

One integration check applies to every module. After the first apply, run a second plan with nothing changed and expect it to be empty. A non-empty second plan means the module never converges, often because an attribute the provider normalizes, such as a policy document's formatting, differs from what the code wrote. Terratest has a helper for exactly this.

Integration tests cost time and money, and they fail in their own ways:

- **Parallel runs collide** unless every test gives its resources a unique name, usually with a random suffix.
- **Cleanup fails partway** when a test crashes or a destroy is blocked, leaving resources billing in the test account. A separate account for tests, swept on a schedule, contains the damage.
- **Tests go flaky** on eventual consistency, when a resource reports ready before it can be used. Retrying with a timeout is more reliable than a fixed wait.

Because of that cost, integration tests usually run when a shared module changes or before a release, not on every commit to every configuration.

---

## Policy Checks Before Deployment

A policy check tests the infrastructure against organizational rules rather than against what its author intended: encryption on, no public buckets, required tags present, only approved regions and instance sizes. Where it runs determines what it can see:

| Runs against | Tools | Sees |
|---|---|---|
| **Code or templates** | Checkov, [AWS CloudFormation Guard](https://github.com/aws-cloudformation/cloudformation-guard){:target="_blank" rel="noopener noreferrer"} on CloudFormation templates (including ones CDK synthesizes) | What is written, before any plan |
| **Synthesis, for CDK** | CDK Aspects, which visit every construct in an app, and validation plugins such as cdk-nag that CDK runs during synthesis | Constructs and the template CDK produces from them |
| **The plan or preview** | [Open Policy Agent](https://www.openpolicyagent.org/){:target="_blank" rel="noopener noreferrer"} through [Conftest](https://www.conftest.dev/){:target="_blank" rel="noopener noreferrer"} on the plan's JSON, policies HCP Terraform runs between plan and apply, or Pulumi policy packs run on preview | Every resource that will be created or changed, with resolved values, including inside modules |
| **The deployment, inside the service** | CloudFormation Hooks, including hooks that run Guard rules | Each resource as CloudFormation is about to create or update it, whoever started the deployment |

HCP Terraform, HashiCorp's hosted platform, runs policies written in Sentinel (HashiCorp's own policy language) or OPA. A failed Sentinel policy stops the run or only warns depending on its enforcement level: *advisory* warns, *soft mandatory* can be overridden by an authorized user, and *hard mandatory* blocks. A pipeline running Conftest makes the same choice through which failures it treats as errors.

All of these checks run before deployment. They cannot see a change made later in the console, which is why they are paired with controls that watch the running environment.

---

## Which Check Runs Where

| Stage | Checks | Blocks on failure? |
|---|---|---|
| **Before commit, locally** | Format, validate, lint, a fast scan, often through pre-commit hooks | No, it is a convenience. The same checks run again in CI |
| **Every pull request** | Format and validation, linting, security scanning, unit tests, a plan posted for review, policy checks on the plan, and a cost estimate from a tool such as [Infracost](https://www.infracost.io/){:target="_blank" rel="noopener noreferrer"} | Yes, for errors and high-severity findings |
| **When a shared module changes, or before release** | Integration tests in a test account | Yes |
| **Staging, before production** | The apply itself, then smoke tests of the deployed system | Yes |
| **Production** | The apply, then health checks during a gradual rollout | The rollout stops or rolls back |

Two principles shape the table. Each check runs at the earliest stage where it can see what it needs, since a problem found in a pull request costs minutes and one found in staging costs a redeploy. And a check that nobody is required to fix is noise, so each stage should block only on findings the team has agreed must stop a change, and report everything else.
