---
title: "GitHub Actions"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "CI/CD automation with GitHub Actions, covering workflow syntax, triggers, runners, reusable workflows, secrets management, and common pipeline patterns."
tags: [github, cicd, automation, devops, practical, developer-tools]
---
{% raw %}

## What GitHub Actions Is

[GitHub Actions](https://docs.github.com/en/actions){:target="_blank" rel="noopener noreferrer"} is an event-driven automation platform built directly into GitHub. When something happens in your repository (a push, a pull request, a scheduled timer, or a manual trigger), GitHub Actions can execute arbitrary automation in response. The most common use is CI/CD: automatically building, testing, and deploying your code. But GitHub Actions handles much more than that, including dependency updates, release automation, issue triage, security scanning, and any other task you'd otherwise run manually or with a separate orchestration system.

The platform is tightly integrated with GitHub's data model. Workflows live inside your repository, run in response to repository events, and produce results you see alongside your pull requests and commits. There's no separate server to operate and no pipeline definition to maintain in a different tool.

For broader CI/CD concepts like the philosophy behind pipeline design, testing strategies, and delivery principles, see the [CI/CD guide](/study-guides/sdlc/cicd.html). This guide focuses specifically on GitHub Actions: its syntax, concepts, and practical patterns.

## Core Concepts

GitHub Actions is built around six concepts that compose into a complete automation system.

A **workflow** is an automated process defined in a YAML file. Workflows live in `.github/workflows/` in your repository. You can have as many workflow files as you need: one for CI, one for deployments, one for scheduled tasks.

An **event** is what triggers a workflow. Events correspond to things that happen in GitHub: pushes, pull requests, releases, scheduled times, manual triggers, and more. A workflow defines which events activate it.

**Jobs** are the units of work inside a workflow. Each job runs on a separate machine and executes a sequence of steps. Jobs run in parallel by default; you can make them sequential using the `needs` keyword.

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

Every workflow is a YAML file in `.github/workflows/`. The filename can be anything descriptive like `ci.yml`, `deploy.yml`, or `release.yml`, and GitHub identifies the workflow by its `name` field, not the filename.

Here's a complete, realistic CI workflow to illustrate the structure:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  DOTNET_VERSION: "8.0.x"

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: ${{ env.DOTNET_VERSION }}

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore --configuration Release

      - name: Run tests
        run: dotnet test --no-build --configuration Release --logger trx

      - name: Upload test results
        uses: actions/upload-artifact@v4
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
| `pull_request` | When a PR is opened, updated, synchronized, or closed |
| `pull_request_target` | Like `pull_request`, but runs with write access (use with care) |
| `workflow_dispatch` | Manual trigger via the GitHub UI or API |
| `schedule` | On a cron schedule |
| `release` | When a GitHub Release is created, published, or updated |
| `workflow_call` | Called by another workflow (makes this workflow reusable) |
| `repository_dispatch` | HTTP webhook trigger from external systems |
| `workflow_run` | Triggered when another workflow completes |

### Event Filtering

Most events support filters that narrow when the workflow runs. This prevents unnecessary workflow executions and keeps your CI focused.

```yaml
on:
  push:
    branches:
      - main
      - "release/**"
    branches-ignore:
      - "dependabot/**"
    paths:
      - "src/**"
      - "tests/**"
    paths-ignore:
      - "docs/**"
      - "*.md"
    tags:
      - "v*"

  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main
```

`branches` and `paths` filters use glob patterns. A `paths` filter means the workflow only runs if at least one changed file matches. This is useful for monorepos where you want different pipelines for different service directories.

The `types` filter on `pull_request` controls which PR lifecycle events activate the workflow. By default, `pull_request` fires on `opened`, `synchronize`, and `reopened`. Adding `closed` lets you trigger cleanup on PR merge or close.

### Scheduled Triggers

Scheduled workflows use [POSIX cron syntax](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule){:target="_blank" rel="noopener noreferrer"}. GitHub Actions runs schedules in UTC.

```yaml
on:
  schedule:
    - cron: "0 2 * * 1"   # Every Monday at 2:00 AM UTC
    - cron: "0 6 * * *"   # Every day at 6:00 AM UTC
```

Scheduled workflows only run on the default branch. If you need branch-specific schedules, use `workflow_dispatch` or `repository_dispatch` triggered from an external scheduler.

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

`needs` accepts a single job name or a list. A job only starts when all its dependencies have succeeded (unless you override this with `if`).

### Matrix Strategies

Matrix strategies let you run a job against multiple configurations simultaneously. This is particularly useful for testing across multiple runtime versions or operating systems:

```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        dotnet: ["6.0.x", "7.0.x", "8.0.x"]
        exclude:
          - os: macos-latest
            dotnet: "6.0.x"
        include:
          - os: ubuntu-latest
            dotnet: "8.0.x"
            experimental: true
      fail-fast: false
      max-parallel: 6

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: ${{ matrix.dotnet }}
      - run: dotnet test
```

`fail-fast: false` prevents one matrix combination's failure from immediately cancelling the rest, which is useful when you want to see the full picture. `max-parallel` limits concurrent runs to avoid overwhelming self-hosted runners or external services.

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

The built-in status functions `success()`, `failure()`, `cancelled()`, and `always()` are essential for control flow. `always()` runs the step regardless of what happened before it. `failure()` runs only when a previous step failed. Without an explicit `if`, steps only run when all previous steps succeeded.

### Concurrency Groups

Concurrency groups prevent multiple workflow runs from interfering with each other. This is critical for deployments, where two simultaneous runs targeting the same environment would produce unpredictable results:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This configuration cancels any in-progress run for the same workflow and branch when a new run starts. For production deployments, you might prefer `cancel-in-progress: false` to let the current deployment finish before queuing the next one.

You can define concurrency at the workflow level or on individual jobs, and you can compose dynamic group names from any context variables.

## Steps

### Run vs. Uses

Every step either executes a shell command (`run`) or invokes an action (`uses`). These serve different purposes.

`run` executes commands directly in the runner's shell. The default shell on Linux/macOS runners is `bash`; on Windows it's PowerShell. You can override this per-step:

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
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
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
    outputs:
      version: ${{ steps.version.outputs.tag }}
    steps:
      - id: version
        run: echo "tag=v1.2.3" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.version }}"
```

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

For multi-line values or values with special characters, append to `$GITHUB_ENV` instead of using `echo`:

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

Actions are versioned and referenced by their GitHub repository and a ref. The `@v4` syntax pins to the latest `v4.x.x` release, balancing currency with stability:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: "npm"
```

### Pinning to SHA

For third-party actions where you don't control the release process, pin to a specific commit SHA rather than a mutable tag. Tags can be force-pushed to point to different commits; a SHA is immutable:

```yaml
# Risky: tag can be moved
- uses: some-org/some-action@v2

# Safe: SHA is immutable
- uses: some-org/some-action@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

Tools like [Dependabot](https://docs.github.com/en/code-security/dependabot){:target="_blank" rel="noopener noreferrer"} can automate SHA updates with human review, giving you both security and currency.

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
    default: "8.0.x"

outputs:
  cache-hit:
    description: "Whether the NuGet cache was restored"
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: "composite"
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Set up .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: ${{ inputs.dotnet-version }}

    - name: Restore NuGet cache
      id: cache
      uses: actions/cache@v4
      with:
        path: ~/.nuget/packages
        key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
        restore-keys: ${{ runner.os }}-nuget-
```

Invoke it from any workflow in the same repository:

```yaml
- uses: ./.github/actions/setup-environment
  with:
    dotnet-version: "8.0.x"
```

Composite actions live in `.github/actions/<name>/action.yml`. They're local to the repository, so they don't appear on the Marketplace, but they dramatically reduce duplication when your workflows share setup steps.

## Runners

### GitHub-Hosted Runners

GitHub provides managed runners that are provisioned fresh for each job and torn down afterward. The most commonly used runner types are:

| Label | OS | Notes |
|---|---|---|
| `ubuntu-latest` | Ubuntu 22.04 | Fastest, cheapest, recommended default |
| `ubuntu-22.04` | Ubuntu 22.04 | Pinned version for reproducibility |
| `ubuntu-20.04` | Ubuntu 20.04 | Older Ubuntu for compatibility |
| `windows-latest` | Windows Server 2022 | Required for .NET Framework, WinUI, etc. |
| `windows-2022` | Windows Server 2022 | Pinned version |
| `macos-latest` | macOS 14 (Apple Silicon) | Required for iOS/macOS builds |
| `macos-13` | macOS 13 (Intel) | For Intel-native builds |

GitHub-hosted runners come pre-installed with a wide range of tools. You can check the [runner images repository](https://github.com/actions/runner-images){:target="_blank" rel="noopener noreferrer"} for a complete list of installed software. Linux runners are the fastest and cheapest option; Windows and macOS runners cost more (billed at 2x and 10x the Linux rate respectively for private repositories).

### Self-Hosted Runners

Self-hosted runners let you bring your own machines. They're useful when:

- Your jobs need hardware that GitHub doesn't provide (specialized GPUs, specific network configurations, hardware security modules)
- You have compliance requirements preventing code from running on GitHub's infrastructure
- You need to access private network resources (internal databases, artifact registries, deployment targets)
- Your workloads are large enough that self-hosted is more cost-effective than GitHub's per-minute billing

Register a self-hosted runner through your repository or organization settings. The runner agent is a lightweight binary that polls GitHub for queued jobs. Self-hosted runners persist between jobs, which means your build environment accumulates state; GitHub-hosted runners start fresh every time. You need to manage cleanup yourself, or use ephemeral self-hosted runners that spin up on demand and terminate after each job.

Target self-hosted runners using labels:

```yaml
runs-on: [self-hosted, linux, x64]
```

Runner groups (available at the organization level) let you restrict which repositories can use which runners, preventing one team's public repository from running jobs on runners provisioned for sensitive internal workloads.

### Choosing the Right Runner

Start with `ubuntu-latest` for almost everything. Switch to Windows only when your build genuinely requires it; Windows runners are noticeably slower for most workloads and cost more. Use macOS only for Apple platform builds, given the cost differential. Add self-hosted runners only when you have a concrete reason: compliance, network access, or cost at scale.

## Secrets and Variables

### Secrets

Secrets store sensitive values like API keys, deploy credentials, and connection strings. They're encrypted at rest and masked in workflow logs; if a secret value appears in log output, GitHub replaces it with `***`.

Define secrets in your repository settings, then access them in workflows through the `secrets` context:

```yaml
steps:
  - name: Deploy
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      API_KEY: ${{ secrets.DEPLOY_API_KEY }}
    run: ./deploy.sh
```

Secrets exist at three scopes:

- **Repository secrets** — accessible only to workflows in that repository
- **Environment secrets** — accessible only when a job targets a specific environment (more on environments below)
- **Organization secrets** — accessible to multiple repositories in an organization, with repository-level allow lists controlling which repos can use each secret

### Variables

Variables (as opposed to secrets) store non-sensitive configuration values that you want to reuse without committing to source code. They're accessible through the `vars` context:

```yaml
steps:
  - name: Build
    run: dotnet build --configuration ${{ vars.BUILD_CONFIGURATION }}
```

Variables follow the same scoping hierarchy as secrets (repository, environment, organization) but their values are visible in the GitHub UI and are not masked in logs.

### The GITHUB_TOKEN

Every workflow run receives an automatically provisioned `GITHUB_TOKEN`, a short-lived token that expires when the run ends. It grants access to the repository via the GitHub API, enabling actions like creating releases, commenting on pull requests, pushing changes back to the repository, and triggering other workflows.

The token's default permissions are deliberately conservative:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

You can set permissions at the workflow level or per-job. Reducing permissions beyond the defaults follows the principle of least privilege; a job that only reads code shouldn't also have permission to write packages or manage deployments.

For `pull_request` events from forks, `GITHUB_TOKEN` has read-only permissions regardless of your settings, since the forked branch's code could be malicious. This is an intentional security constraint.

## Environments

Environments represent deployment targets like staging and production. They add protection rules and environment-scoped secrets on top of the basic job model.

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

**Required reviewers** pause deployment jobs at a waiting state until one or more designated approvers approve the deployment. This creates a manual gate before production releases.

**Wait timers** add a delay between the job queue and execution. This gives you a window to cancel a deployment you notice is problematic before it reaches production.

**Branch policies** restrict which branches can deploy to an environment. Configuring the `production` environment to only accept deployments from `main` prevents an accidental `feature/my-test` deployment from reaching production.

Combining these rules gives you a deployment pipeline where staging is automatic but production requires a reviewer's explicit approval:

```yaml
jobs:
  deploy-staging:
    environment: staging
    # No protection rules - deploys automatically

  deploy-production:
    needs: deploy-staging
    environment: production
    # Requires approval from production-approvers team
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

Reusable workflows enforce inputs and secret declarations explicitly. The calling workflow must pass required inputs; any secret not declared in `workflow_call.secrets` isn't accessible inside the reusable workflow, even if the caller has it. This makes reusable workflows self-documenting and prevents accidental secret exposure.

Organizations often move shared workflows into a dedicated `.github` repository, making them available across all repositories in the organization via `uses: org/.github/.github/workflows/deploy.yml@main`.

## Artifacts and Caching

### Artifacts

Artifacts persist files from a workflow run so you can download them afterward or share them between jobs. They're stored for 90 days by default (configurable).

Upload from one job:

```yaml
- name: Build
  run: dotnet publish -c Release -o ./publish

- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: published-app
    path: ./publish
    retention-days: 30
```

Download in a subsequent job:

```yaml
- name: Download artifact
  uses: actions/download-artifact@v4
  with:
    name: published-app
    path: ./publish

- name: Deploy
  run: ./deploy.sh ./publish
```

This pattern separates build from deploy. The build job compiles and packages; the deploy job downloads the artifact and pushes it to the target environment. Each job runs on a fresh runner, so artifacts are the only way to pass binaries between them.

### Caching Dependencies

The `actions/cache` action stores and restores directories between runs. Its value comes from caching dependency downloads that would otherwise repeat on every run, such as NuGet packages, npm modules, pip packages, and Go modules.

```yaml
- name: Cache NuGet packages
  uses: actions/cache@v4
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj', '**/*.props') }}
    restore-keys: |
      ${{ runner.os }}-nuget-

- name: Restore dependencies
  run: dotnet restore
```

The cache `key` uniquely identifies a cache entry. When the key matches exactly, the cache is restored verbatim. When there's no exact match, `restore-keys` provides fallback prefixes; GitHub restores the most recent cache whose key starts with the prefix, giving you a warm cache even when lock files change.

Cache misses cause the full step to run normally; the job doesn't fail. At the end of the job, if the cache key is new, the cached directory is saved for future runs.

Common caching strategies:

| Language/Tool | Cache Path | Key Input |
|---|---|---|
| .NET (NuGet) | `~/.nuget/packages` | Hash of `*.csproj` files |
| Node.js (npm) | `~/.npm` | Hash of `package-lock.json` |
| Python (pip) | `~/.cache/pip` | Hash of `requirements.txt` |
| Go | `~/go/pkg/mod` | Hash of `go.sum` |
| Docker layers | `/tmp/.buildx-cache` | Hash of `Dockerfile` |

Many setup actions like `actions/setup-node` and `actions/setup-dotnet` accept a `cache` input that handles all this automatically. When available, prefer that over manual `actions/cache` configuration.

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
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0.x"
          cache: true

      - run: dotnet restore
      - run: dotnet build --no-restore
      - run: dotnet test --no-build --collect:"XPlat Code Coverage"

      - name: Upload coverage
        uses: codecov/codecov-action@v4
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
      - uses: actions/checkout@v4

      - name: Log in to container registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-

      - name: Build and push
        id: push
        uses: docker/build-push-action@v5
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
      - uses: actions/checkout@v4
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
      - uses: actions/checkout@v4
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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for changelog

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0.x"

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
        uses: softprops/action-gh-release@v1
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
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0.x"
      - name: Audit NuGet packages
        run: dotnet list package --vulnerable --include-transitive

  stale-issues:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/stale@v9
        with:
          stale-issue-message: "This issue has been automatically marked as stale after 60 days of inactivity."
          days-before-stale: 60
          days-before-close: 14
```

## Security Considerations

### Third-Party Action Risks

Every action you `uses` in a workflow runs with the same permissions as your workflow. A compromised or malicious action could exfiltrate secrets, modify your repository, or push malicious code. Treat third-party actions like third-party dependencies; they're code you're executing with elevated trust.

Mitigations:

- Pin actions to full commit SHAs rather than mutable tags
- Prefer actions from well-known publishers (GitHub itself, major vendors) over unknown community actions
- Review action source code before using it, especially for actions requesting broad permissions
- Use [GitHub's dependency review action](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review){:target="_blank" rel="noopener noreferrer"} to flag new action additions in PRs
- Configure Dependabot to keep action versions updated

### The pull_request_target Danger

`pull_request_target` runs workflows in the context of the base branch with write access to the repository, even for pull requests from forks. This makes it useful for tasks that need write access (like posting PR comments from forks), but it creates a serious risk: if you check out the PR's code and run it as part of a `pull_request_target` workflow, an attacker submitting a PR could execute arbitrary code with write access to your repository.

The safe pattern separates untrusted code execution from privileged operations:

```yaml
# Trigger from pull_request (no write access) to run untrusted code
# Then use workflow_run to post results with write access
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
```

Never combine `pull_request_target` with steps that check out and execute the PR's code.

### Least-Privilege GITHUB_TOKEN

The `GITHUB_TOKEN` defaults to broader permissions than most workflows need. Restrict it explicitly:

```yaml
permissions: {}  # Deny all by default at workflow level

jobs:
  test:
    permissions:
      contents: read  # Only what this job actually needs
    steps:
      - uses: actions/checkout@v4
      - run: dotnet test

  comment:
    permissions:
      pull-requests: write  # Only what this job actually needs
    steps:
      - name: Post results
        run: gh pr comment ${{ github.event.number }} --body "Tests passed"
```

Setting `permissions: {}` at the workflow level and then granting individual jobs only what they need is the safest posture.

### Secret Handling

Secrets are masked in logs, but you can still accidentally expose them through other means. Don't echo secrets directly, pass them through files that get uploaded as artifacts, or include them in error messages. Pass secrets to steps via environment variables rather than command arguments, since arguments can sometimes appear in process listings.

GitHub scans repositories for common secret patterns like API keys and notifies you when it finds them, but prevention is better than detection.

## Cost and Performance

### Free Tier and Billing

GitHub Actions is free for public repositories with no minute limits. For private repositories, GitHub includes a free monthly allocation that depends on your plan, with additional minutes billed at per-minute rates that vary by runner type:

| Runner | Billing rate |
|---|---|
| Linux | 1x (baseline) |
| Windows | 2x |
| macOS | 10x |

The billing implications push toward Linux runners where possible. A workflow that could run on Linux but uses Windows or macOS will cost significantly more at scale.

### Optimization Strategies

**Cache aggressively.** Dependency installation is often the largest time cost in CI. A well-configured cache can reduce a 5-minute job to under a minute. Set up caching for your package manager, and use the GitHub Actions cache for Docker build layers as well.

**Use concurrency groups to avoid waste.** When a developer pushes multiple commits in quick succession, older in-progress runs are often rendered irrelevant by the new push. `cancel-in-progress: true` on CI workflows stops paying for runs that will never matter.

**Make jobs conditional.** A documentation change shouldn't trigger a full test suite run. Path filters on `push` and `pull_request` events prevent unnecessary executions. For monorepos, this is especially impactful; filter each workflow to only run on changes in its relevant directory.

**Parallelize with matrix strategies.** If your test suite takes 10 minutes to run sequentially, splitting it into 5 parallel shards can bring wall time down to 2 minutes for the same cost. The total compute consumed is the same, but developers wait less.

**Pull common setup into composite actions.** When multiple workflows each install the same tools in the same way, they each pay that setup cost independently. A composite action that's already cached is faster than repeating setup steps.

**Choose `ubuntu-latest` as the default.** Unless you specifically need Windows or macOS capabilities, Linux is the fastest and cheapest option. The time savings from Linux runners compound across hundreds of workflow runs per month.
{% endraw %}
