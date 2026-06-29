---
title: "Azure DevOps Pipelines for System Architects"
layout: guide
category: Azure
subcategory: Developer Tools & CI/CD
description: "YAML pipeline architecture including stages, environments, approvals, variable groups, self-hosted agents, and deployment patterns for building reliable CI/CD workflows on Azure DevOps."
tags: [infrastructure, azure, cicd, devops, automation, deployment, practical]
---

## What Is Azure DevOps Pipelines

[Azure DevOps Pipelines](https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines){:target="_blank" rel="noopener noreferrer"} is Microsoft's native CI/CD platform integrated with Azure DevOps. It automates the process of building artifacts from source code, running tests, and deploying to target environments. Modern pipelines are defined in YAML, stored in version control alongside your code, and support both continuous integration (commit to build) and continuous deployment (automated releases to environments).

Unlike older web-based pipeline builders, YAML pipelines give you infrastructure-as-code for CI/CD workflows. This means pipeline configuration is reviewable in pull requests, versioned with code, and portable across teams.

---

## What Problems Azure DevOps Pipelines Solves

**Without Pipelines:**
- Developers deploy manually, increasing error rates and inconsistency
- Testing is skipped or done sporadically, leading to bugs in production
- Deployment timing is unpredictable, bottlenecking releases
- Rollback and rollforward decisions are made under pressure without clear procedures
- Environments drift because changes are applied inconsistently

**With Pipelines:**
- Every build is automatically tested before becoming a candidate for deployment
- Deployments follow a consistent, repeatable process independent of who initiates them
- Approval gates and manual checks can pause deployment when needed
- Environment configuration is captured in code, reducing drift
- Audit trails show exactly what was deployed, when, and by whom
- Multiple deployment strategies (rolling, canary, blue-green) are available without manual orchestration
- Infrastructure and applications are deployed together, keeping them synchronized

---

## How Azure DevOps Pipelines Differs from AWS CodePipeline/CodeBuild

Architects familiar with AWS need to understand the conceptual differences:

| Concept | AWS CodePipeline/CodeBuild | Azure DevOps Pipelines |
|---------|---------------------------|----------------------|
| **Pipeline definition** | Separate stage definitions with complex JSON or YAML CloudFormation templates | Single YAML file defining triggers, stages, jobs, and steps in sequence |
| **Pipeline file storage** | CodeBuild projects defined in AWS console or infrastructure-as-code, not stored with code | YAML files stored in git alongside application code with full version history |
| **Compute model** | CodeBuild spins up containers per build and you pay per minute | Microsoft-hosted agents (Linux, Windows, macOS) included with self-hosted agents available for unlimited builds |
| **Deployment orchestration** | CodeDeploy handles instance or container deployment as a separate service | Deployment jobs built into the pipeline itself without a separate service |
| **Approval gates** | Manual approval stages in CodePipeline separate from deployment logic | Approval checks embedded in pipeline environments with conditional deployment |
| **Multi-environment** | Multiple CodePipeline instances or complex cross-account setup required | Single pipeline with environments; deploy to dev, staging, and production in one workflow |
| **Artifact storage** | S3 buckets for artifacts passed between stages | Azure Artifacts or external storage with built-in publish tasks |
| **Secret management** | Parameter Store or Secrets Manager integrated via IAM roles | Key Vault integration through variable groups with linked secrets |
| **Pipeline templates** | Partial automation with no first-class template reuse | Step templates, job templates, stage templates with multi-level reuse |
| **Agent model** | CodeBuild is fully managed; you specify instance size | Microsoft-hosted for standard needs, self-hosted agents for custom requirements |
| **Cost model** | Pay per CodeBuild minute plus data transfer charges | Microsoft-hosted included in Azure DevOps; self-hosted only pay for infrastructure |

---

## Core Pipeline Concepts

### YAML Pipelines vs Classic Pipelines

Azure DevOps originally provided a web-based graphical pipeline editor called "Classic Pipelines." These are now legacy. Microsoft recommends YAML pipelines as the modern standard because they are versionable, reviewable, and repeatable.

**YAML Pipelines** are defined in a `azure-pipelines.yml` file stored in version control. This file contains all pipeline logic: stages, jobs, steps, variables, triggers, and environment configuration. The entire pipeline is reviewable in a pull request before it runs, making it auditable and maintainable.

**Classic Pipelines** are built in the Azure DevOps web UI with no version history or code review process. They are harder to maintain, duplicate, and port across projects. New projects should always use YAML pipelines.

---

### Pipeline Structure: Stages, Jobs, and Steps

A YAML pipeline has a hierarchical structure:

**Stages** are the top-level organizational unit. Each stage represents a logical phase: build, test, deploy-to-dev, deploy-to-prod. Stages execute sequentially by default, though you can configure dependencies so later stages wait for earlier ones or run in parallel when specified.

**Jobs** run within stages. A job is a unit of work that executes on an agent (a machine that runs pipeline tasks). Multiple jobs within a stage can run in parallel or sequentially. A common pattern is one job per environment: a build job produces artifacts, and separate deployment jobs deploy to dev, staging, and production.

**Steps** run within jobs. A step is a single action: execute a script, run a test, publish an artifact, deploy a container. Steps in a job execute sequentially unless explicitly configured otherwise. Built-in steps are provided for common tasks like building .NET/Node/Java projects, publishing artifacts, and pushing containers.

**Task** is Azure DevOps terminology for a built-in step like "dotnet build" or "PublishBuildArtifacts". Custom scripts written in bash, PowerShell, or Python are wrapped in script tasks.

This hierarchy allows flexible orchestration. A typical pattern: a single build stage with one job that creates artifacts, followed by separate deployment stages with jobs for each environment.

---

### Triggers: CI, PR, Scheduled, and Pipeline Triggers

**CI Triggers** (Continuous Integration) automatically run the pipeline when code is committed to specific branches. By default, a YAML pipeline triggers on all branches. You can restrict triggers to specific branches like `main` and `develop`.

**PR Triggers** run the pipeline when a pull request is created or updated. This allows validation before merging. PR pipelines typically run build and test stages but skip deployment stages (you don't want a PR to deploy to production).

**Scheduled Triggers** run pipelines on a schedule like daily at midnight or weekly on Monday morning. Common uses include nightly smoke tests, periodic data refreshes, or daily infrastructure validation.

**Pipeline Triggers** (also called multi-stage pipelines or chaining) allow one pipeline to trigger another when it completes. This is useful for separating concerns: a build pipeline creates artifacts, and a separate deployment pipeline consumes them. Pipeline triggers enable loosely coupled, reusable workflows.

---

### Variable Groups and Secrets Management

Variables in pipelines store configuration values like API endpoints, database connection strings, and feature flags. Azure DevOps provides two mechanisms:

**Pipeline Variables** are defined in the YAML file and scoped to that pipeline. They are simple to use but not shared across pipelines. Variable syntax uses `$(variableName)`.

**Variable Groups** are reusable collections of variables managed in Azure DevOps. You create a variable group once (like "prod-config" containing production endpoint URLs and secrets) and reference it in multiple pipelines. This ensures all pipelines use consistent configuration values.

**Key Vault Integration** allows variable groups to link secrets stored in Azure Key Vault. Instead of storing secrets in Azure DevOps, you store them in Key Vault and configure a variable group to fetch them at pipeline runtime. The secret values are never stored in Azure DevOps itself, improving security.

Secrets in variable groups are masked in pipeline logs so they don't appear in build output. However, a malicious script can still read secret values from the environment during pipeline execution, so you still need to vet code that runs in your pipelines.

---

### Environments and Deployment Strategies

An **Environment** in Azure DevOps represents a target for deployment: dev, staging, production, a specific Kubernetes cluster, etc. Environments allow you to define approval gates, approvers, and checks that must pass before deployment proceeds.

**Approval Gates** require human approval before a deployment job targeting an environment executes. You can configure which users can approve and require approval from multiple people. This is how you prevent accidental production deployments.

**Checks** are automated validations attached to an environment. A check can query Azure REST APIs to verify infrastructure readiness, check Azure Policy compliance, or run custom validation scripts. Checks run automatically; if any fail, deployment to that environment is blocked.

**Deployment Strategies** (rolling, canary, blue-green) control how traffic shifts from old to new versions:

- **Rolling deployment**: Replace instances gradually. New instances start serving traffic immediately. If something fails mid-deployment, you have a partial rollout.
- **Canary deployment**: Route a small percentage of traffic to the new version while most traffic goes to the old version. Monitor metrics; if issues occur, rollback is quick. If metrics are healthy, gradually shift remaining traffic.
- **Blue-green deployment**: Keep two identical production environments. Deploy to the idle environment, validate it, then switch router to point to the newly deployed environment. Provides instant rollback but requires 2x capacity.

Azure DevOps doesn't enforce any of these strategies directly. Instead, you implement them through deployment jobs with manual approvals, approval checks at environment level, and conditional steps that check metrics.

---

### Self-Hosted Agents vs Microsoft-Hosted Agents

An **Agent** is a machine (physical or virtual) where pipeline jobs execute. Agents poll Azure DevOps for work, execute steps, and report results.

**Microsoft-Hosted Agents** are provided by Microsoft. They run on Azure infrastructure, come pre-installed with common tools (git, build tools, testing frameworks), and scale automatically. You don't manage infrastructure; jobs queue and run on the next available agent. They are free for public projects and include parallel job limits for private projects (typically 1 free concurrent job, more with paid licenses).

**Self-Hosted Agents** run on machines you provision and manage. They can be Windows VMs, Linux VMs, or containers. Self-hosted agents are useful when you need custom tools, specific hardware (GPUs, large memory), network access to internal systems, or unlimited concurrent builds without paying per-job costs. The trade-off is operational overhead: you provision, patch, monitor, and scale them.

**Agent Pools** group agents by capability or purpose. A pool might contain "Linux agents running on AKS", "Windows agents on premises", or "build agents with GPU". You specify which pool a job should run on, and Azure DevOps distributes the job to an available agent in that pool.

Agent selection strategy depends on your needs:
- Use Microsoft-hosted agents for standard builds unless you need custom tools or unlimited parallelism
- Use self-hosted agents when you need access to internal resources (on-premises networks, private APIs) that Microsoft-hosted agents cannot reach
- Use self-hosted agents when unlimited concurrent jobs make more economic sense than paying per-concurrent-job with Microsoft-hosted

---

### Template Reuse: Steps, Jobs, and Stages

Templates are reusable YAML fragments that reduce duplication across pipelines.

**Step Templates** define a sequence of steps that multiple jobs use. For example, a step template "build-and-test" might run `dotnet build`, `dotnet test`, and publish results. Any job can reference this template instead of repeating those steps.

**Job Templates** define a complete job with its own pool, variables, and steps. A job template might describe "run integration tests against a database" with setup and teardown steps. Multiple stages can use the same job template with different parameters.

**Stage Templates** define entire stages. A stage template might describe "deploy to an environment" with approval checks, pre-deployment validation, and rollback steps. You reference the template once per target environment, passing different parameters.

**Extends** allow a pipeline to inherit from a parent template. The parent defines the overall structure (build stage, test stage, deploy stage) and child pipelines customize specific steps. This provides guardrails: teams cannot skip security scanning or testing because those steps are enforced in the parent template.

Template reuse becomes critical at scale. When you have 50 microservices, each with its own pipeline, maintaining consistency becomes hard without templates. A central "pipeline templates" repository can define shared patterns that all services inherit.

---

### Multi-Stage Pipelines for CI and CD

A multi-stage pipeline combines CI and CD in a single YAML file. Stages execute sequentially:

1. **Build stage**: Check out code, compile, run unit tests, publish artifacts
2. **Test stage** (optional): Run integration tests, smoke tests, security scans
3. **Deploy to dev stage**: Deploy artifacts to dev environment, run smoke tests
4. **Approval stage** (optional): Require manual approval before production
5. **Deploy to staging stage**: Deploy to staging, run end-to-end tests
6. **Deploy to production stage**: Deploy to production with approval gates and health checks

Each stage can have multiple jobs running in parallel. Later stages can depend on earlier stages, or run independently. This unified approach simplifies understanding the entire flow from code to production.

---

## Architecture Patterns

### Mono-Repo vs Multi-Repo Pipeline Strategies

A **mono-repo** is a single git repository containing many services, libraries, or applications. A **multi-repo** strategy uses separate repositories for each service.

**Mono-repo pipeline strategy**: One pipeline file at the repository root. When code changes, the pipeline determines which services were affected and only builds and tests those. This requires sophisticated change detection logic. Trigger filters in YAML can restrict pipeline execution to certain paths, but this gets complex with shared libraries.

Trade-offs of mono-repo pipelines:
- Easier to ensure all services work together (they build and test together)
- Complex trigger filters and change detection
- Single pipeline must handle multiple build configurations
- Atomic commits can ensure consistency

**Multi-repo pipeline strategy**: Each service repository has its own pipeline. Services are built, tested, and deployed independently. Coordination happens through artifact sharing: one service publishes an artifact that another service consumes.

Trade-offs of multi-repo pipelines:
- Simpler individual pipelines
- Easier to scale (teams own their pipelines)
- Risk of inconsistent configurations across services
- Coordination between services requires orchestration

Most organizations start with multi-repo pipelines for simplicity. Mono-repo becomes attractive when you have many tightly coupled services with frequent cross-service changes.

---

### Shared Template Libraries

A **Shared Templates Repository** is a separate git repository containing reusable pipeline templates. Each team's service repositories reference these templates.

This pattern looks like:

```
templates/ (repository)
├── jobs/
│   ├── build-dotnet.yml
│   ├── test-dotnet.yml
│   └── deploy-container.yml
├── stages/
│   ├── build-and-test.yml
│   └── deploy-environment.yml
└── scripts/
    ├── health-check.sh
    └── smoke-test.sh

service-a/ (repository)
├── azure-pipelines.yml (references ../templates)
└── src/

service-b/ (repository)
├── azure-pipelines.yml (references ../templates)
└── src/
```

The shared templates repository defines standard patterns for building, testing, and deploying. Each service's pipeline references these templates with parameters specific to that service. This ensures consistency across all services while allowing customization.

Updating a template in the shared repository automatically applies to all services that reference it on their next pipeline run. This is powerful for rolling out security improvements (like new scanning tools) across all services at once.

---

### Environment Promotion Patterns

A typical deployment flow moves code through environments: dev, staging, production. Each stage uses deployment jobs that reference environments defined in Azure DevOps.

**Promotion with approvals:**
- Build stage runs on all commits to main
- Deploy to dev is automatic
- Deploy to staging requires approval from the release manager
- Deploy to production requires approval from the release manager and compliance officer

**Promotion with health checks:**
- Deploy to staging, then check for errors/performance issues
- If health checks pass, automatically promote to production
- If health checks fail, deployment stops and on-call team is notified

**Promotion with canary:**
- Deploy to production, but route only 1% of traffic
- Monitor for 30 minutes
- If metrics are healthy, shift traffic to 100%
- If issues detected, rollback to previous version

These patterns are implemented through a combination of approval gates on environments, conditional steps that check metrics, and custom scripts that make promotion decisions.

---

### Infrastructure Deployment Pipelines

Infrastructure pipelines deploy cloud resources using Bicep, Terraform, or Azure Resource Manager templates. They differ from application pipelines in that they must show what will change before applying changes.

**Plan-and-apply pattern:**
- Plan stage: Run infrastructure-as-code plan command, showing what resources will be created, updated, or deleted
- Require approval: Show plan output and require approval from infrastructure team
- Apply stage: Execute the deployment, creating or updating resources

This matches Terraform's plan/apply model. Bicep similarly supports what-if operations that preview changes.

**Staged environment progression:**
- Deploy to dev automatically (changes are reversible)
- Deploy to staging with approval (closer to production)
- Deploy to production with multiple approvers and health checks

Infrastructure pipelines often run on schedules (like nightly) to validate infrastructure code even when no changes are made. This catch drift: if infrastructure was changed manually outside the pipeline, the scheduled run will show those differences.

---

## Pipeline Security

### Pipeline Permissions and Security Roles

Azure DevOps uses role-based access control for pipelines. Common roles:

**Reader** can view pipeline definitions and execution history but cannot trigger or modify pipelines.

**User** can trigger pipelines and view results.

**Admin** can modify pipeline definitions, configure approvers, and manage agent pools.

Pipelines inherit security from the project. If a user has project-level admin permissions, they can modify any pipeline. Project-level security settings control who can view, create, and modify pipelines.

---

### Protected Branches and Required Reviewers

Git branch protection policies enforce that pull requests go through code review before merging. In Azure DevOps, you can configure:

- Require pull request code reviews before merging
- Require a pipeline to succeed before allowing merge
- Require approval from specific reviewers (security team, architects)
- Block automatic completion until approvals are complete

These policies prevent someone from merging directly to main, skipping tests and reviews. When combined with CI triggers that run tests on every commit, you get strong guarantees that main always has passing tests.

---

### Secure Files and Variable Groups with Key Vault

**Secure Files** in Azure DevOps store small sensitive files like SSL certificates or deployment keys. They are encrypted at rest and not visible in plain text. Pipeline jobs can download secure files during execution, but the files are not logged.

**Variable Groups** can link to Azure Key Vault. Instead of storing secrets in Azure DevOps, you create a variable group that references Key Vault. When the pipeline runs, the variable group fetches secrets from Key Vault using a managed identity. Secrets are passed to steps as environment variables, but they are masked in logs.

This pattern ensures secrets are stored in a dedicated secrets store (Key Vault) with its own audit logs and access controls, rather than mixed with pipeline configuration.

---

### Agent Pool Security Considerations

Self-hosted agents run code from your pipelines. A malicious pipeline step could steal secrets, access internal networks, or modify artifacts. Therefore:

- Keep self-hosted agents in secure network zones (separate from production systems)
- Run self-hosted agents in containers that are destroyed after each job (ephemeral agents)
- Use separate agent pools for sensitive workloads (security scans, production deployment)
- Audit which teams and projects have access to self-hosted agent pools
- Regularly patch agents to address security vulnerabilities

Agent pool isolation is critical when using self-hosted agents. If a compromised pipeline runs on a shared agent pool, it could access artifacts or environments targeted by other pipelines.

---

## Cost and Performance Considerations

### Microsoft-Hosted Agents: Parallel Job Limits and Free Tier

Microsoft-hosted agents are billed on parallel jobs, not per-minute of execution. You get a free tier with 1 concurrent job for private projects. Additional concurrent jobs require Azure DevOps licenses (typically bundled with Azure subscriptions).

**Cost optimization with Microsoft-hosted agents:**
- Reuse Microsoft-hosted agents for standard workloads
- Only pay for additional parallel jobs if your pipeline queue grows (multiple branches building simultaneously)
- For projects with infrequent builds, 1 free concurrent job is often sufficient

Public projects (open source) get 10 free concurrent jobs with Microsoft-hosted agents, incentivizing open source projects to use Azure DevOps.

---

### Self-Hosted Agents: No Per-Minute Cost But Infrastructure Overhead

Self-hosted agents have no per-minute charges. You pay only for the virtual machines or container resources they run on. This is economical if:

- You need unlimited concurrent builds (more jobs than Azure DevOps licenses support)
- Builds are frequent enough that agent utilization is high (agents are expensive if idle)
- You need custom tools not available on Microsoft-hosted agents
- You need access to internal networks or systems

The trade-off is operational overhead. You provision, patch, monitor, and auto-scale self-hosted agents. Many organizations use a hybrid approach: Microsoft-hosted for standard builds and self-hosted for specialized workloads.

---

### Pipeline Caching for Faster Builds

Pipeline caching stores build artifacts (compiled binaries, downloaded dependencies, test results) between pipeline runs. A later run on the same branch can restore the cache, avoiding re-compilation and re-downloading.

Caching is effective for:
- Downloaded NuGet packages (can be 100+ MB per build)
- Compiled intermediate objects (saves 30-50% of build time)
- Test results from previous runs

Caching does not work across branches if the cache key includes the branch name. It does work across commits on the same branch.

The trade-off is cache invalidation complexity. If you change build configuration or dependencies, you must invalidate the cache. Cache misses cost build time while cache hits save time. Most organizations implement caching for dependencies but not for compiled code (to avoid subtle cache issues).

---

### Artifact Management and Retention Policies

Artifacts are the outputs of pipeline jobs: compiled binaries, container images, packages, test results. Azure Artifacts stores these; you can set retention policies to automatically delete old artifacts.

**Retention policies** prevent artifacts from growing indefinitely. You might keep:
- Last 30 builds' artifacts
- All artifacts from the last 7 days
- All production deployment artifacts forever (for audit/compliance)

Container images pushed to Azure Container Registry have separate retention; you might keep:
- Last 10 images per branch
- All images tagged as production-release
- Images older than 30 days are deleted

These policies balance storage cost (you pay for artifact storage) against the need to retain artifacts for rollback, audits, and investigations.

---

## AWS Comparison Table

A detailed reference for architects migrating from AWS:

| Aspect | AWS | Azure DevOps |
|--------|-----|---------|
| **Pipeline definition** | CloudFormation or CDK with CodePipeline stages requiring separate service integration | YAML files in git with unified pipeline containing stages, jobs, and steps |
| **Build service** | CodeBuild as a separate service paid per minute | Pipelines included in Azure DevOps subscription |
| **Artifact storage** | S3 buckets for artifact management | Azure Artifacts or external storage |
| **Deployment service** | CodeDeploy for instances; CodePipeline stages for orchestration | Deployment jobs built into the pipeline itself |
| **Environment secrets** | Parameter Store or Secrets Manager accessed via IAM roles | Key Vault integration through variable groups |
| **Approval gates** | Manual approval actions in CodePipeline | Approval checks attached to environments in pipelines |
| **Parallelization** | Parallel stages in CodePipeline | Parallel jobs within stages |
| **Agent model** | CodeBuild fully managed; you specify compute size | Microsoft-hosted (managed) or self-hosted (you manage) |
| **Trigger types** | CodeCommit webhooks, CloudWatch events, and manual triggers | Git push, PR, scheduled, and pipeline triggers |
| **Template reuse** | SAM (Serverless Application Model) and CDK without step templates | Step, job, and stage templates with extends inheritance |
| **Scaling cost** | Pay per CodeBuild minute with no per-job licensing | Pay for concurrent job licenses or use self-hosted agents |
| **On-premises integration** | CodePipeline cannot directly access on-premises systems; requires proxies | Self-hosted agents access on-premises systems directly |
| **Branch-specific configuration** | Separate pipelines per branch or CDK conditionals | Single pipeline with branch-conditional triggers and steps |
| **Multi-environment deployment** | Multiple CodePipeline instances or complex cross-account setup | Single pipeline with multiple environments |

---

## Common Pitfalls

### Pitfall 1: Long-Running Builds Blocking Deployments

**Problem:** Build stage takes 45 minutes because you compile, test, scan, and package in a single job. Multiple developers commit simultaneously. The first commit starts a build, and the next commits queue behind it, waiting 45 minutes each for the build to complete.

**Result:** Deployments are blocked behind slow builds. Developers are frustrated. Hot fixes cannot deploy quickly.

**Solution:** Parallelize. Create multiple jobs in the build stage: one job compiles and unit tests, another runs integration tests, another runs security scans. These jobs run in parallel, reducing total build time. If tests are independent, use job matrix to spawn multiple test jobs parameterized by test category.

---

### Pitfall 2: Secrets Leaked in Logs or Artifacts

**Problem:** A PowerShell script logs connection strings during troubleshooting. A test output file contains API keys. The secrets are captured in pipeline logs or published artifacts.

**Result:** Secrets are visible in build history. Anyone with read access to the pipeline sees the secrets. If artifacts are stored in a blob, anyone with container access sees secrets in files.

**Solution:** Use Azure DevOps secret masking for variables. Mask secrets in outputs. Use Key Vault variable groups so secrets are never stored in Azure DevOps. Audit what gets published as artifacts; sanitize test outputs before publishing.

---

### Pitfall 3: No Approval Gates Between Environments

**Problem:** The same pipeline deploys to dev, staging, and production. No approval gates. A developer merges a bug to main, the pipeline runs, and production is deployed automatically before anyone notices the bug.

**Result:** Production incidents from untested code.

**Solution:** Add approval gates to production environments. Configure the production environment to require approval from at least two people. Require a manual check that staging tests passed before approving production deployment.

---

### Pitfall 4: Tightly Coupled Pipeline Configuration to Secrets

**Problem:** Connection strings, API keys, and credentials are hardcoded in YAML or stored in variable groups without backing Key Vault. When rotating secrets, you update the variable group, but there is no audit trail or versioning.

**Result:** Secret rotation is manual and error-prone. Audit logs do not show secret changes. If a secret is compromised, you cannot determine when it was leaked.

**Solution:** Store all secrets in Key Vault, never in Azure DevOps. Configure variable groups to fetch from Key Vault. This adds an audit trail in Key Vault. Rotation becomes a Key Vault operation, not a pipeline operation.

---

### Pitfall 5: Ignoring Agent Capacity When Scaling

**Problem:** You have one self-hosted agent running builds for 20 microservices. Builds queue up, and deployment times increase as the queue grows. Developers complain about slow feedback.

**Result:** Bottleneck at the agent. Developers lose productivity waiting for builds.

**Solution:** Monitor agent queue depth. When queue depth consistently exceeds 3-5 jobs, add more agents. Use auto-scaling (VMS scale sets) to dynamically add agents when queue depth is high and remove them when idle. Alternatively, switch to Microsoft-hosted agents if the cost justifies the removal of capacity management burden.

---

### Pitfall 6: Not Testing the Deployment Pipeline Itself

**Problem:** The deployment pipeline only runs when deploying to production. No one tests the pipeline until it runs in production.

**Result:** Pipeline bugs are discovered in production. The deployment fails, production is broken, and the on-call team scrambles.

**Solution:** Test deployment pipelines in dev and staging environments first. Every time you update the deployment pipeline, test it in a non-production environment. Use scheduled nightly deployments to staging to catch pipeline bugs before production runs.

---

### Pitfall 7: Stateful Agents Causing Flaky Pipelines

**Problem:** A self-hosted agent accumulates build artifacts, temporary files, and installed packages over multiple builds. One build leaves state that affects the next build. Tests pass on one agent but fail on another.

**result:** Flaky pipelines are hard to debug. You cannot reproduce failures consistently.

**Solution:** Use ephemeral agents in containers. Each pipeline job runs on a fresh container that is destroyed afterward. This eliminates state accumulation. Alternatively, regularly reset self-hosted agents by clearing temporary directories and reinstalling tools.

---

## Key Takeaways

1. **YAML pipelines are the modern standard.** They are versionable, reviewable, and repeatable. Classic pipelines are legacy; use YAML for all new projects.

2. **Multi-stage pipelines unify CI and CD in one workflow.** Build once, deploy to multiple environments through stages with approval gates. This is cleaner than separate CI and CD pipelines.

3. **Stages provide orchestration, jobs provide parallelization, steps provide actions.** Understand this hierarchy to design efficient pipelines. Parallelize jobs that are independent to reduce total pipeline duration.

4. **Approval gates and environment checks provide safety.** Require approval for production deployments. Use automated health checks to block bad deployments without human approval.

5. **Template libraries enforce consistency across teams.** Define shared patterns in a central repository. All services reference these templates, ensuring consistent build, test, and deploy logic.

6. **Self-hosted agents are economical for unlimited builds but operationally complex.** Use Microsoft-hosted for standard workloads. Self-host only when you need custom tools, internal network access, or unlimited parallelism.

7. **Key Vault integration is non-negotiable for secrets.** Never store secrets in Azure DevOps or pipeline YAML. Use Key Vault variable groups to fetch secrets at runtime with full audit trails.

8. **Branch protection policies and required CI gates prevent bad code from reaching main.** Require pull request review and passing tests before merge. This keeps main deployable at all times.

9. **Cache dependencies to speed builds, but invalidate cache carefully.** Downloaded packages and compiled intermediate objects can save significant build time. Cache invalidation complexity can create subtle pipeline bugs.

10. **Artifact retention policies manage storage costs.** Keep recent artifacts for rollback capability and compliance, but delete old artifacts automatically. This balances storage cost against retention requirements.
