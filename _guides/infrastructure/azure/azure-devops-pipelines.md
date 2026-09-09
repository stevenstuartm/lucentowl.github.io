---
title: "Azure DevOps Pipelines for System Architects"
layout: guide
category: Azure
subcategory: Developer Tools & CI/CD
description: "YAML pipeline architecture including stages, deployment jobs and strategies, environments, approvals and checks, service connections with workload identity federation, agents, and parallel job licensing."
tags: [cicd, yaml-pipelines, deployment-jobs, service-connections, workload-identity, pipeline-templates, practical]
---

## What Is Azure DevOps Pipelines

[Azure DevOps Pipelines](https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines){:target="_blank" rel="noopener noreferrer"} is Microsoft's CI/CD platform inside Azure DevOps. It builds artifacts from source, runs tests, and deploys to target environments. Modern pipelines are defined in YAML, stored in version control alongside code, and cover both continuous integration (commit to build) and continuous deployment (automated releases to environments).

YAML pipelines give you infrastructure-as-code for CI/CD workflows. Pipeline configuration becomes reviewable in a pull request, versioned with the code it builds, and portable across teams.

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
- Deployments follow a repeatable process independent of who initiates them
- Approvals and automated checks can pause a deployment before it touches an environment
- Environment configuration is captured in code, reducing drift
- Audit trails show what was deployed, when, and by whom
- Rolling and canary rollouts are built into deployment jobs rather than hand-orchestrated
- Infrastructure and applications are deployed together, keeping them synchronized

---

## How Azure DevOps Pipelines Differs from AWS CodePipeline/CodeBuild

Architects familiar with AWS need to understand the conceptual differences:

| Concept | AWS CodePipeline/CodeBuild | Azure DevOps Pipelines |
|---------|---------------------------|----------------------|
| **Pipeline definition** | Separate stage definitions with JSON or YAML CloudFormation templates | Single YAML file defining triggers, stages, jobs, and steps in sequence |
| **Pipeline file storage** | CodeBuild projects defined in the AWS console or infrastructure-as-code, not stored with code | YAML files stored in git alongside application code with full version history |
| **Compute billing** | CodeBuild spins up containers per build and you pay per minute | Billed by *parallel job* (how many jobs run at once), not per minute of execution |
| **Deployment orchestration** | CodeDeploy handles instance or container deployment as a separate service | Deployment jobs built into the pipeline, with runOnce, rolling, and canary strategies |
| **Approval gates** | Manual approval stages in CodePipeline, separate from deployment logic | Approvals and checks attached to resources, configured outside the YAML |
| **Multi-environment** | Multiple CodePipeline instances or cross-account setup required | Single pipeline with environments; deploy to dev, staging, and production in one workflow |
| **Artifact storage** | S3 buckets for artifacts passed between stages | Pipeline artifacts stored by Azure Pipelines, exempt from storage billing |
| **Secret management** | Parameter Store or Secrets Manager integrated via IAM roles | Key Vault secrets mapped into variable groups through a service connection |
| **Cloud authentication** | IAM roles assumed by the build service | Service connections, with workload identity federation as the recommended credential |
| **Pipeline templates** | Partial automation with no first-class template reuse | Step, job, and stage templates plus `extends` inheritance |
| **Parallelization** | Parallel actions within a CodePipeline stage | Parallel jobs within a stage, bounded by purchased parallel jobs |
| **Trigger types** | CodeCommit webhooks, EventBridge events, and manual triggers | Git push, pull request, scheduled, and resource triggers (pipelines, containers, packages, webhooks) |
| **Agent model** | CodeBuild is fully managed; you specify compute size | Microsoft-hosted for standard needs, self-hosted or scale set agents for custom requirements |
| **On-premises integration** | CodeBuild cannot reach on-premises systems directly; requires proxies or VPC plumbing | Self-hosted agents run inside your network and reach on-premises systems directly |

---

## Core Pipeline Concepts

### Where Pipeline Objects Live

Azure DevOps nests objects as organization → project → pipeline, and the scope of a given object determines who can share it and how it is billed. Getting this wrong produces surprises during capacity planning.

| Object | Scope | Consequence |
|---|---|---|
| **Parallel jobs** | Organization | Shared across every project. You cannot dedicate capacity to a specific project or pool. |
| **Agent pools** | Organization or project | Organization-scoped pools are available to all projects. Every organization starts with two: `Azure Pipelines` (Microsoft-hosted) and `Default`. |
| **Service connections** | Project, optionally shared across projects | A cross-project connection cannot be converted to workload identity federation with the automated tool. |
| **Variable groups and secure files** | Project (the Library) | Roles set at the Library level flow down to individual assets. |
| **Environments** | Project | Approvals and checks are configured on the environment, not in the YAML. |
| **Retention settings** | Project | Per-pipeline retention rules no longer exist; the project setting is the only control. |

The parallel job scope is the one that most often surprises teams. Buying two parallel jobs and then starting two runs in one project leaves nothing for a second project until one finishes.

---

### YAML Pipelines vs Classic Pipelines

Azure DevOps originally provided a web-based graphical pipeline editor, now called Classic Pipelines, split into classic build pipelines and classic release pipelines. Microsoft recommends YAML for new work and directs new feature investment there. Classic pipelines remain documented and supported, and Microsoft has not published a retirement date, so an existing classic release pipeline is not under an immediate deadline.

**YAML Pipelines** live in an `azure-pipelines.yml` file in version control. That file holds stages, jobs, steps, variables, triggers, and environment references. The whole pipeline is reviewable in a pull request before it runs.

**Classic Pipelines** are built in the Azure DevOps web UI. They keep a revision history in the UI but sit outside pull request review, and they are harder to duplicate and port across projects. Some newer capabilities never reached them: pipeline caching, for example, is unsupported in classic release pipelines, and publishing pipeline artifacts is unsupported in release pipelines. New projects should use YAML.

---

### Pipeline Structure: Stages, Jobs, and Steps

A YAML pipeline has a hierarchical structure:

**Stages** are the top-level organizational unit. Each stage represents a logical phase: build, test, deploy-to-dev, deploy-to-prod. Stages run sequentially by default, and `dependsOn` lets you fan them out or serialize them explicitly.

**Jobs** run within stages. A job is a unit of work that executes on an agent. Jobs within a stage can run in parallel or sequentially, bounded by how many parallel jobs the organization has. A **deployment job** is a special job type that targets an environment, records deployment history against it, and applies a deployment strategy.

**Steps** run within jobs. A step is a single action: run a script, run tests, publish an artifact, deploy a container. Steps run sequentially within a job.

**Tasks** are the packaged steps Azure DevOps ships, referenced as `- task: DotNetCoreCLI@2` or similar. Scripts written in bash, PowerShell, or Python go through `script`, `bash`, `pwsh`, or `powershell` shortcuts.

Artifacts move between stages through the pipeline artifact shortcuts:

```yaml
steps:
- publish: $(Build.ArtifactStagingDirectory)/app
  artifact: drop
```

```yaml
steps:
- download: current
  artifact: drop
```

`publish` and `download` are shortcuts for the `PublishPipelineArtifact@1` and `DownloadPipelineArtifact@2` tasks. Pipeline artifacts superseded build artifacts. `PublishBuildArtifacts@1` still works, but Microsoft recommends the pipeline artifact tasks for new pipelines. Downloads happen automatically only in deployment jobs, and only within the `deploy` lifecycle hook. A regular build job has to ask for its artifacts explicitly.

---

### Triggers: CI, PR, Scheduled, and Resource Triggers

**CI Triggers** run the pipeline when code lands on specified branches. A YAML pipeline triggers on all branches by default, so most pipelines restrict this to `main` and release branches.

**PR Triggers** run the pipeline when a pull request is opened or updated. PR runs typically execute build and test stages and skip deployment stages.

**Scheduled Triggers** run pipelines on a cron schedule. Common uses include nightly smoke tests, periodic data refreshes, and daily infrastructure drift checks.

**Resource Triggers** fire when something outside the pipeline changes. Azure Pipelines supports six resource types: `pipelines`, `builds`, `containers`, `packages`, `repositories`, and `webhooks`. A `pipelines` resource lets a CD pipeline consume artifacts from a CI pipeline and start when that pipeline finishes:

```yaml
resources:
  pipelines:
  - pipeline: smartHotel          # alias used in this pipeline
    project: otherDevOpsProject
    source: SmartHotel-CI         # name of the producing pipeline
    trigger:
      branches:
        include:
        - main
        - releases/*
      stages:
      - Production
```

Two behaviors catch people out. Without a `trigger` property the resource is consume-only and never starts a run, and when the resource pipeline lives in a different repository the trigger fires against that repository's *default branch* rather than the branch that raised the event. Trigger evaluation for container resources also happens only on the default branch, so a trigger added on a feature branch does nothing until it merges.

---

### Variables and Variable Groups

Variables hold configuration values like endpoints, connection strings, and feature flags. Three syntaxes exist and they resolve at different times:

| Syntax | Name | Resolved | Use for |
|---|---|---|---|
| `$(name)` | Macro | Runtime, just before a task runs | Task inputs and script arguments |
| `$[ ... ]` | Runtime expression | Start of a run, or start of a job for dependency output | Conditions and variables that depend on earlier jobs |
| `${{ ... }}` | Template expression | Compile time, before the run starts | Template parameters and structural branching in YAML |

A template expression cannot read anything produced during the run, which is why `${{ }}` around an output variable silently yields nothing.

**Pipeline Variables** are declared in the YAML and scoped to that pipeline.

**Variable Groups** are reusable collections managed under **Pipelines > Library** and referenced by name:

```yaml
variables:
- group: prod-config
- name: buildConfiguration
  value: Release
```

A YAML pipeline must be explicitly authorized to use a variable group. Without that authorization the run fails with a resource authorization error rather than silently proceeding, which prevents anyone who can push YAML from reading another team's secrets.

Secret variables in a variable group are protected resources and can carry their own approvals, checks, and pipeline permissions. Non-secret variables in the same group carry none of that. Secret values also cannot be read directly inside a script. They have to be passed in as task arguments or mapped into `env`.

---

### Key Vault Integration

A variable group can map secrets out of an Azure Key Vault rather than storing them in Azure DevOps.

The link runs through an **Azure Resource Manager service connection**, not a managed identity attached to the agent. The service connection's identity needs **Get** and **List** on the vault's secrets, either through an access policy or the *Key Vault Secrets User* role on an RBAC vault.

Four constraints shape how this is used:

- **Only names are mapped, not values.** Values are fetched from the vault at run time, so rotating a secret in Key Vault reaches every pipeline that uses the group without any pipeline change.
- **Adding or deleting a secret in the vault does not update the group.** New secrets have to be selected into the variable group explicitly.
- **Secrets only.** Cryptographic keys and certificates in the vault cannot be mapped into a variable group.
- **RBAC vaults behind a private endpoint are unsupported.** Azure DevOps is not a Key Vault trusted service. A vault reachable only through a private endpoint has to use the vault access policy permission model instead.

---

### Service Connections and Workload Identity Federation

A **service connection** is how a pipeline authenticates to something outside Azure DevOps. The Azure Resource Manager (ARM) service connection is the one that matters for deploying to Azure, and its credential model has changed materially.

**Workload identity federation is the recommended credential.** The service connection exchanges a short-lived pipeline token for an Azure access token against a federated credential on an app registration or a user-assigned managed identity. Nothing long-lived is stored in Azure DevOps, so there is no secret to rotate and no expiry to be paged about.

Three creation paths exist:

| Option | When to use |
|---|---|
| **App registration (automatic) with workload identity federation** | Default choice. Requires Owner on the subscription. Unsupported for Azure Stack and Azure US Government. |
| **Managed identity** (federated credential on an existing user-assigned managed identity) | When your directory does not let you create app registrations. |
| **Manual configuration** | Fallback when neither automatic path completes. |

Secret-based options (automatic app registration with a secret, agent-assigned managed identity, publish profile) still exist for backwards compatibility and are not recommended for new connections.

Four operational details:

- **The Azure DevOps issuer retires 1 July 2027.** Federated credentials issued by `https://vstoken.dev.azure.com` are being replaced by the Microsoft Entra issuer (`https://login.microsoftonline.com/`). New connections already default to the Entra issuer. This applies to Azure public cloud connections that use single-tenant Entra applications or managed identities; non-public clouds and multitenant applications are excluded.
- **Existing secret-based connections can be converted in place.** The conversion tool works only on connections Azure DevOps created itself and only on single-project connections. A converted connection can be reverted for seven days, after which you create a new secret manually.
- **Unused connections get disabled.** Azure Pipelines may automatically disable a connection that has gone 100 days without use, and pipelines referencing it fail until it is re-enabled.
- **Do not grant access to all pipelines.** The *Grant access permission to all pipelines* checkbox is convenient and defeats the point of scoping the connection. Authorize individual pipelines instead.

Scale set agent pools are the exception to the workload identity recommendation. Configuring one still requires an ARM service connection based on a service principal key. Certificate and managed identity credentials fail when Azure Pipelines tries to enumerate scale sets.

---

### Environments and Deployment Strategies

An **Environment** is a named deployment target in a project: dev, staging, production, or a specific Kubernetes namespace. Environments record deployment history, and they are where approvals and checks are configured. An environment can hold Kubernetes or virtual machine resources, or hold none at all and act purely as a history and gating surface.

A **deployment job** targets an environment and declares a strategy. Azure DevOps implements three:

| Strategy | Behavior | Constraint |
|---|---|---|
| `runOnce` | Each lifecycle hook runs once | Default; works against any environment |
| `rolling` | Hooks run per batch of targets, batch size set by `maxParallel` (a count or a percentage) | **VM resources only** |
| `canary` | `preDeploy` runs once, then `deploy`/`routeTraffic`/`postRouteTraffic` repeat per entry in `increments` | Increment percentage exposed as `$(strategy.increment)` |

Blue-green is not a built-in strategy. You build it from two environments plus a `routeTraffic` step that repoints a load balancer or App Service slot.

Every strategy runs the same lifecycle hooks, and the hooks are where health checks and rollback live:

```
                 ┌──────────────┐
                 │  preDeploy   │  initialize, back up, install certs
                 └──────┬───────┘
                        v
                 ┌──────────────┐
                 │    deploy    │  artifacts auto-download here
                 └──────┬───────┘
                        v
                 ┌──────────────┐
                 │ routeTraffic │  shift traffic to the new version
                 └──────┬───────┘
                        v
                 ┌──────────────┐
                 │postRouteTraf.│  watch metrics for a defined interval
                 └──────┬───────┘
                        │
             ┌──────────┴──────────┐
             v                     v
      ┌─────────────┐       ┌─────────────┐
      │ on: success │       │ on: failure │  restore last known good
      └─────────────┘       └─────────────┘
```

A canary rollout against AKS looks like this:

```yaml
jobs:
- deployment: DeployBookings
  environment: smarthotel-prod.bookings
  pool:
    vmImage: ubuntu-latest
  strategy:
    canary:
      increments: [10, 20]
      deploy:
        steps:
        - task: KubernetesManifest@1
          inputs:
            action: $(strategy.action)
            strategy: $(strategy.name)
            percentage: $(strategy.increment)
            manifests: manifest.yml
      postRouteTraffic:
        pool: server
        steps:
        - script: echo monitor application health
      on:
        failure:
          steps:
          - script: echo rollback
```

Three behaviors of deployment jobs differ from regular jobs. The repository is not cloned automatically, so add `checkout: self` if steps need source. Artifacts download automatically, but only inside the `deploy` hook, and `- download: none` opts out. And retrying a failed rolling deployment re-runs against every VM in the set rather than only the failed targets.

---

### Approvals and Checks

Approvals and checks are configured by the owner of a resource, in the web UI, and deliberately not in the YAML. Someone who can edit the pipeline file cannot weaken the gates protecting an environment.

Checks attach to six resource types: environments, service connections, repositories, variable groups, secure files, and agent pools. A stage cannot start until every check on every resource it consumes is satisfied.

Evaluation runs in five ordered categories, and within a category checks run in the order they were created:

1. **Static checks**: Branch control, Required template, Evaluate artifact
2. **Pre-check approvals**
3. **Dynamic checks**: Approval, Invoke Azure Function, Invoke REST API, Business Hours, Query Azure Monitor alerts
4. **Post-check approvals**
5. **Exclusive lock**

What each is for:

- **Approval** pauses for a named set of users or groups. If a group is the approver, one member of it is enough. The approver list freezes when checks begin, so adding someone mid-wait does not help. A timeout marks the stage skipped rather than failed, and approvers can defer an approval so it takes effect at a chosen later time.
- **Branch control** requires that every resource in the run came from an allowed branch, optionally requiring that branch to have protection enabled. Branch names must be fully qualified as `refs/heads/<name>`.
- **Required template** fails any pipeline that does not extend from a named YAML template. This is the check that turns a template from a convention into an enforced control.
- **Evaluate artifact** applies a custom policy to the artifact being deployed. It currently supports container images only.
- **Invoke Azure Function** and **Invoke REST API** call out to your own logic and parse the response. Setting a non-zero *Time between evaluations* makes the decision non-final and re-evaluates on a cycle.
- **Query Azure Monitor alerts** passes only when no alert rule is firing, which pairs naturally with the `postRouteTraffic` hook of a canary rollout.
- **Business hours** holds the stage until a permitted time window.
- **Exclusive lock** allows one run at a time through a resource. `lockBehavior: runLatest` (the default) lets the newest run take the lock and discards the queue; `lockBehavior: sequential` runs them in order.

**ServiceNow Change Management** is available as a marketplace extension and opens a change request automatically at the start of a stage.

A pipeline waiting on an approval does not consume a parallel job, so gates cost queue time but not licensed capacity.

---

### Microsoft-Hosted vs Self-Hosted Agents

An **Agent** is a machine where pipeline jobs execute. Agents poll Azure DevOps for work, run steps, and report results.

**Microsoft-Hosted Agents** run on Azure infrastructure Microsoft manages, come preloaded with common toolchains, and are recycled after every job. You manage no infrastructure. They cannot reach private networks, and jobs are capped in duration by your parallel job tier.

**Self-Hosted Agents** run on machines you provision: VMs, physical machines, or containers. They suit custom tooling, specific hardware, access to internal systems, and workloads that need state warmed between jobs. You provision, patch, monitor, and scale them.

**Scale Set Agents** are self-hosted agents backed by an Azure virtual machine scale set that Azure Pipelines itself scales. You disable the scale set's own autoscaling and overprovisioning, and Azure Pipelines samples the pool every five minutes and grows or shrinks it toward a standby count you configure. Enabling tear-down after every use reimages each VM between jobs, which gives Microsoft-hosted-style isolation on your own network and image. Scale set agents support Ubuntu, Windows Server, and Windows 10 client only, no macOS, and only in Azure public cloud. **Managed DevOps Pools** is the successor Microsoft now points at for autoscaling self-hosted pools, running the VMs in a Microsoft-managed subscription instead of yours.

**Agent Pools** group agents by capability. Pools are scoped to the organization or to a single project, and every organization starts with `Azure Pipelines` (the Microsoft-hosted pool) and `Default`.

```
                     Do jobs need to reach a private
                     network or internal system?
                              │
                 ┌────────────┴────────────┐
                yes                        no
                 │                          │
                 v                          v
      Do you want to manage        Do you need custom tools,
      VMs and images?              specific hardware, or jobs
                 │                 longer than the tier limit?
        ┌────────┴────────┐                 │
       no                yes         ┌──────┴──────┐
        │                 │         no            yes
        v                 v          │             │
   Managed DevOps    Scale set or    v             v
   Pools             plain self-  Microsoft-   Scale set
                     hosted       hosted       agents
```

---

### Template Reuse: Steps, Jobs, and Stages

Templates are reusable YAML fragments that reduce duplication across pipelines.

**Step Templates** define a sequence of steps that multiple jobs use. A `build-and-test` template might run `dotnet build`, `dotnet test`, and publish results.

**Job Templates** define a complete job with its own pool, variables, and steps, parameterized for the caller.

**Stage Templates** define entire stages. A `deploy-environment` template can carry the deployment job, its strategy, and its rollback steps, referenced once per target environment with different parameters.

**Extends** makes a pipeline inherit from a parent template. The parent fixes the overall shape (build, scan, test, deploy) and child pipelines fill in the parts the parent exposes as parameters.

`extends` on its own is a convention, not a control. Anyone who can edit the pipeline file can remove the `extends` line and skip the security scanning it enforced. Pairing it with a **Required template** check on the environment or service connection is what makes it binding: a pipeline that does not extend from the named template cannot consume the resource at all.

Template reuse becomes load-bearing at scale. Fifty microservices each with a hand-written pipeline drift apart within a quarter.

---

### Multi-Stage Pipelines for CI and CD

A multi-stage pipeline combines CI and CD in a single YAML file:

1. **Build stage**: Check out code, compile, run unit tests, publish artifacts
2. **Test stage** (optional): Run integration tests, smoke tests, security scans
3. **Deploy to dev stage**: Deploy artifacts to dev, run smoke tests
4. **Deploy to staging stage**: Deploy to staging, run end-to-end tests
5. **Deploy to production stage**: Deploy to production behind approvals and health checks

There is no separate "approval stage" in this list because approvals are not stages. They attach to the environment a deployment stage targets and pause that stage before its first job starts.

Each stage can run multiple jobs in parallel, and `dependsOn` controls which stages wait on which.

---

## Architecture Patterns

### Mono-Repo vs Multi-Repo Pipeline Strategies

A **mono-repo** is a single git repository containing many services, libraries, or applications. A **multi-repo** strategy uses separate repositories per service.

**Mono-repo pipeline strategy**: pipelines at the repository root use path filters on their triggers so a change to one service does not rebuild everything. Path filters handle the simple cases; shared libraries make the change detection harder, because a change to a common package should rebuild every consumer.

Trade-offs of mono-repo pipelines:
- Easier to guarantee services work together, since they build and test together
- Complex trigger filters and change detection
- A single pipeline handles multiple build configurations
- Atomic commits keep cross-service changes consistent

**Multi-repo pipeline strategy**: each service repository owns its pipeline. Services build, test, and deploy independently, and coordination happens through `pipelines` resources that pass artifacts between them.

Trade-offs of multi-repo pipelines:
- Simpler individual pipelines
- Easier to scale, because teams own their pipelines
- Risk of configurations drifting apart across services
- Cross-service coordination needs explicit orchestration

Most organizations start multi-repo. Mono-repo becomes attractive when many tightly coupled services change together often.

---

### Shared Template Libraries

A **shared templates repository** holds reusable pipeline templates that every service repository references. Templates in another repository are reached through a `repositories` resource:

```yaml
resources:
  repositories:
  - repository: templates
    type: git
    name: platform/pipeline-templates
    ref: refs/tags/v3

extends:
  template: stages/build-and-deploy.yml@templates
  parameters:
    serviceName: bookings
    environments: [dev, staging, prod]
```

```
  platform/pipeline-templates          service-a
  ┌───────────────────────────┐        ┌──────────────────────────┐
  │ jobs/                     │<───────┤ azure-pipelines.yml      │
  │   build-dotnet.yml        │  @templates  (extends, ref v3)    │
  │   deploy-container.yml    │        └──────────────────────────┘
  │ stages/                   │        service-b
  │   build-and-deploy.yml    │<───────┤ azure-pipelines.yml      │
  │ scripts/                  │  @templates  (extends, ref v3)    │
  │   health-check.sh         │        └──────────────────────────┘
  └───────────────────────────┘
```

The `ref` on the resource is what makes this safe. Pointing at a tag or a release branch means template changes roll out when consumers move their ref, not the instant someone merges to the template repo's main branch. Pointing at `main` gives you the opposite property: a security scanning step added centrally reaches every service on its next run, and so does a mistake.

---

### Environment Promotion Patterns

A typical deployment flow moves a build through dev, staging, and production, with each stage using a deployment job that targets the matching environment.

**Promotion with approvals:**
- Build runs on every commit to main
- Deploy to dev is automatic
- Staging carries an approval check naming the release manager
- Production carries an approval check naming the release manager and a compliance officer

**Promotion with health checks:**
- Deploy to staging, then let a Query Azure Monitor alerts check watch for firing alerts
- Production proceeds if no alerts fire within the evaluation window
- A firing alert blocks the stage and the on-call team is notified

**Promotion with canary:**
- A canary deployment job with `increments: [1, 10, 50]` against production
- `postRouteTraffic` holds at each increment while metrics are observed
- `on: failure` runs the rollback steps

The first two are configured on the environment. The third lives in the deployment job's strategy.

---

### Infrastructure Deployment Pipelines

Infrastructure pipelines deploy cloud resources with Bicep, Terraform, or ARM templates. They differ from application pipelines in needing to show what will change before changing it.

**Plan-and-apply pattern:**
- Plan stage runs `terraform plan` or `az deployment group what-if` and publishes the output
- The apply stage targets an environment carrying an approval check, so the reviewer sees the plan before approving
- Apply stage executes the deployment

**Staged environment progression:**
- Deploy to dev automatically, where changes are cheap to reverse
- Deploy to staging behind an approval
- Deploy to production behind multiple approvers and health checks

Scheduling these pipelines nightly catches drift. If someone changed infrastructure by hand in the portal, the next scheduled plan shows the difference before a real deployment collides with it.

Deleting orphaned resources is a separate problem from deploying declared ones. ARM complete mode used to be the answer and Microsoft has documented it as gradually deprecating in favor of **deployment stacks**, which track a resource set explicitly and can delete or detach what leaves the set.

---

## Pipeline Security

### Protected Resources and Permissions

Azure Pipelines splits resources into open and protected. Artifacts, pipelines, test plans, and work items are open, and pipelines reach them freely. Six resource types are **protected**: repositories, environments, service connections, agent pools, secure files, and secret variables in variable groups.

Protected resources carry two independent permission surfaces:

**User permissions** use a four-role model, consistent across the Library, service connections, and environments:

| Role | Can |
|---|---|
| **Reader** | View the resource |
| **User** | Consume the resource in a pipeline, and manage its approvals and checks |
| **Creator** | Create resources of that type. Project-level only. |
| **Administrator** | Everything above, plus edit, delete, and manage roles. The creator of a resource gets this role on it. |

Note what the **User** role carries. Granting someone User on an environment so their pipeline can deploy also lets them manage the approvals on it, so grant it narrowly.

**Pipeline permissions** are separate and answer a different question: which pipelines may use this resource. They exist so that copying a YAML file into a new pipeline does not carry access to production along with it. *Open access* grants every pipeline in the project access and requires the Project Administrator role to enable. Leave it off for anything holding a secret.

---

### Protected Branches and Required Reviewers

Branch policies in Azure Repos enforce review before merge. Useful ones:

- Require pull request review before completing
- Require a build to succeed before allowing completion
- Require approval from specific reviewers, such as a security team or the owners of touched paths
- Block automatic completion until all approvals land

These stop someone merging straight to main past the tests. Combined with the Branch control check on the production environment, they also stop a run originating from an unprotected branch from deploying at all.

---

### Secure Files and Secret Masking

**Secure Files** hold small sensitive files that do not belong in the repository: signing certificates, provisioning profiles, SSH keys. They are stored encrypted, are protected resources with the same four-role model as variable groups, and are downloaded to the agent during a job without appearing in logs. A file whose contents are a credential rather than a document belongs in Key Vault instead, mapped in through a variable group.

Secret masking is a safety net, not a boundary. Azure DevOps masks known secret values in logs, but a script running in the job can read the value and print it in a form the masker does not recognize. Code that runs in a pipeline with production secrets deserves the same review as code that runs in production.

---

### Agent Pool Security

Self-hosted agents run whatever your pipelines tell them to. A malicious or merely careless pipeline step can read secrets from the environment, reach internal networks, or tamper with artifacts left behind by an earlier job. Practices that contain this:

- Keep self-hosted agents in network zones separated from production systems
- Run jobs on ephemeral agents, either containers destroyed after each job or scale set agents configured to reimage after every use
- Use separate pools for sensitive workloads, and keep the production deployment pool distinct from the general build pool
- Restrict which projects and pipelines can reach a pool using its Administrator role and pipeline permissions
- Keep agents patched, and keep the agent software current

Pool isolation matters most on shared pools. A compromised pipeline running on the same pool as production deployments can reach artifacts and credentials cached on disk from other jobs.

---

## Cost and Performance Considerations

### Parallel Jobs and the Free Tier

Azure Pipelines bills concurrency, not minutes. One parallel job means one pipeline job runs at a time, and everything else queues. Parallel jobs live at the organization level and cannot be partitioned per project or pool.

Microsoft-hosted and self-hosted parallel jobs are licensed separately:

| | Free grant (private projects) | Job time limit | Monthly time limit |
|---|---|---|---|
| **Microsoft-hosted** | 1 parallel job, after you enable it | 60 minutes free, 360 minutes paid | 1,800 minutes free, none paid |
| **Self-hosted** | 1 parallel job, plus 1 per active Visual Studio Enterprise subscriber in the organization | None | None |

Four consequences of this model:

- **The Microsoft-hosted free tier has to be enabled.** It arrives only after you link the organization to an Azure subscription and set up billing.
- **Self-hosted agents are not unlimited concurrency.** You may register any number of agents for free, but running more than the licensed number of jobs at once still requires purchasing self-hosted parallel jobs. What self-hosted buys you is no per-job time limit and no per-minute charge, not free parallelism.
- **The first purchased Microsoft-hosted job does not add concurrency.** It removes the time limits from the job you already had. Running two jobs at once means buying two.
- **New organizations cap at 25 Microsoft-hosted parallel jobs** until they request an increase.

Runs waiting on an approval or manual intervention release their parallel job, as do server jobs. A pipeline that spends an hour in an approval queue costs nothing in licensed capacity.

Public projects are retired. New ones can no longer be created, existing ones convert to private in 2027, and after that conversion they receive the private-project allocation. Any capacity plan built on the old free grant for open source projects needs revisiting.

The **Pool consumption report** on an agent pool's Analytics tab charts running and queued jobs against your concurrency limit for the previous 30 days, which is the evidence to bring to a purchasing decision. Microsoft's own rule of thumb is roughly one parallel job per four to five users.

---

### Self-Hosted Agents: Infrastructure Cost Instead of Per-Job Cost

Self-hosted agents carry no per-minute charge. You pay for the VMs or container hosts they run on, plus the parallel job licenses above the free grant. This makes sense when:

- Jobs exceed the Microsoft-hosted time limit
- Agent utilization is high enough that always-on machines beat queueing (an idle VM is pure cost)
- You need tools, hardware, or images Microsoft-hosted agents do not offer
- Jobs need access to internal networks or private endpoints

The trade-off is operational overhead. Many organizations run a hybrid: Microsoft-hosted for open-ended build work, self-hosted or scale set agents for deployments that need network reachability.

---

### Pipeline Caching for Faster Builds

The `Cache@2` task saves a directory at the end of a job and restores it at the start of a later one. It takes a `path` and a `key`, where the key is `|`-separated segments: literal strings, file paths whose contents get hashed, or glob patterns.

```yaml
- task: Cache@2
  inputs:
    key: 'nuget | "$(Agent.OS)" | **/packages.lock.json'
    restoreKeys: |
      nuget | "$(Agent.OS)"
      nuget
    path: $(NUGET_PACKAGES)
```

`restoreKeys` are prefix fallbacks, tried top to bottom, each returning the most recently created matching entry. `cacheHitVar` names a variable set to `true`, `inexact`, or `false` so later steps can skip work on a hit.

Caching suits downloaded dependencies: NuGet packages, npm modules, Gradle and Maven caches, ccache output. It does not suit anything a later job would fail without. Those are artifacts. The dividing line Microsoft draws is whether missing the files breaks the job (artifact) or merely slows it (cache).

Five behaviors that shape how caching is used:

- **Caches are immutable and cannot be cleared.** Once a key exists in a scope, that content is fixed. Invalidating means changing the key, usually by prefixing a version literal like `v2 | nuget | ...`.
- **Caches are already scoped by project, pipeline, and branch**, so putting a branch name in the key is redundant and fragments the cache. The source branch reads and writes its own scope; `main` and `master` are readable by every branch but writable only by themselves. A pull request run can read the source, target, and default branch scopes but writes only to its own `refs/pull/N/merge` scope, which stops a PR from poisoning the cache its target branch will restore.
- **Caches expire after seven days of no activity.**
- **There is no size limit, and caching is free on every tier.** Pipeline caching and pipeline artifacts are both exempt from storage billing.
- **Self-hosted agents need the archive tool on PATH**: GNU tar on Windows and Linux, BSD tar on macOS.

Caching only pays off when restoring and saving costs less than regenerating. Whether it helps depends entirely on the ratio between dependency restore time and cache transfer time for your project, so measure before and after rather than assuming.

---

### Artifact and Run Retention

Retention in Azure Pipelines is configured **at the project level only** under **Project settings > Pipelines > Settings**. Per-pipeline retention rules were removed, so a pipeline cannot define its own policy. Four settings exist: days to keep artifacts, symbols, and attachments; days to keep runs; days to keep pull request runs; and the number of recent runs to keep per pipeline.

For pipelines on Azure Repos, "recent runs to keep" is applied three ways at once: the latest N for the default branch, the latest N for each protected branch (any branch with a policy), and the latest N for the pipeline overall.

A run is deleted only when it exceeds the day count, is not among the recent runs kept, is not marked for indefinite retention, and is not held by a release. Retention policies process once per day. Retention keeps only succeeded and partially-succeeded runs, so a failed run is not protected by the recent-runs setting.

Deleting a run deletes everything attached to it: logs, pipeline and build artifacts, symbols, binaries, test results, run metadata, and git tags the Sources task created. Anything that must outlive the retention window has to be copied somewhere you own, using the Copy files task rather than published as an artifact.

Two ways to keep something longer:

- **Retain indefinitely**, set from the run's More actions menu, which exempts the run from every retention policy until someone turns it off.
- **Retention leases**, set through the Lease API for a specific duration. A pipeline can call this on itself, so a stage that deployed to production can extend its own run's lifetime without pinning it forever.

Storage cost is not the reason to prune pipeline runs, since pipeline artifacts and caches are exempt from storage billing. Container images in Azure Container Registry and packages in Azure Artifacts feeds are billed separately and are not governed by run retention at all, so they need their own retention rules:

- Keep the last N images per repository, plus everything tagged as a production release
- Untagged manifests deleted after a short window

---

## Common Pitfalls

### Pitfall 1: Long-Running Builds Blocking Deployments

**Problem:** The build stage takes 45 minutes because it compiles, tests, scans, and packages in a single job. Several developers commit at once, and with one parallel job each commit waits behind the last.

**Result:** Deployments queue behind slow builds. Hot fixes cannot ship quickly.

**Solution:** Split the stage into independent jobs, one compiling and unit testing, another running integration tests, another running security scans, and let them run in parallel. Use a matrix to fan out test jobs by category. This only helps if the organization has parallel jobs to spend, so check the pool consumption report before splitting: on a single free parallel job, four jobs run one after another and total build time goes up rather than down.

---

### Pitfall 2: Secrets Leaked in Logs or Artifacts

**Problem:** A troubleshooting script echoes a connection string. A test output file contains an API key. Both land in pipeline logs or a published artifact.

**Result:** Secrets are visible in build history to anyone with read access to the pipeline, and remain in the artifact for as long as retention keeps the run.

**Solution:** Treat masking as a backstop rather than a control. Map secrets in from Key Vault so they never live in Azure DevOps, pass them as task inputs rather than into scripts that can reformat them, and review what gets published as an artifact. Sanitize test output before publishing it.

---

### Pitfall 3: No Gates Between Environments

**Problem:** One pipeline deploys to dev, staging, and production with nothing between the stages. A bug merges to main and reaches production before anyone reads the build summary.

**Result:** Production incidents from code that never got looked at.

**Solution:** Put an approval check on the production environment naming at least two approvers. Add a Branch control check so only runs from `refs/heads/main` can deploy there at all. Where the signal is automatable, a Query Azure Monitor alerts check blocks the stage without waiting on a human.

---

### Pitfall 4: Secrets Stored in Azure DevOps Instead of Key Vault

**Problem:** Connection strings and API keys are typed into a variable group as secret variables. Rotating one means editing the variable group, with no version history and no record of who read it.

**Result:** Rotation is manual and error-prone. If a secret is compromised, there is no way to establish when.

**Solution:** Move the values into Key Vault and link the variable group to it, so rotation happens in a store that has an audit log and version history. The same argument applies one level up, to the credential the pipeline uses to reach Azure at all: workload identity federation has no stored secret to rotate or leak.

---

### Pitfall 5: Ignoring Agent Capacity When Scaling

**Problem:** One self-hosted agent serves builds for 20 microservices. Queue depth grows through the morning and feedback slows to hours.

**Result:** A bottleneck at the agent, and developers idle waiting on builds.

**Solution:** Read the pool consumption report before adding hardware, because the constraint may be licensed parallel jobs rather than machines. Registering ten more agents changes nothing if the organization owns two self-hosted parallel jobs. Once concurrency is licensed, move to scale set agents or Managed DevOps Pools so capacity follows queue depth instead of sitting idle overnight. Scale set pools converge slowly, sampling every five minutes and taking up to an hour to reach a new size, so set the standby count for your morning peak rather than expecting it to react to a spike.

---

### Pitfall 6: Not Testing the Deployment Pipeline Itself

**Problem:** The deployment stage only runs against production. Nobody exercises it until it matters.

**Result:** Pipeline bugs surface during a production deployment, with the on-call team debugging YAML instead of the application.

**Solution:** Run the same deployment logic against dev and staging environments through a stage template, so the production stage is the same code with different parameters. Schedule a nightly deployment to staging to catch breakage introduced by task version updates or template changes.

---

### Pitfall 7: Stateful Agents Causing Flaky Pipelines

**Problem:** A self-hosted agent accumulates build output, temporary files, and globally installed packages across jobs. One job leaves state that changes the next one's result. Tests pass on one agent and fail on another.

**Result:** Flaky pipelines that cannot be reproduced on demand, and time lost to debugging the agent rather than the code.

**Solution:** Make agents ephemeral. Run jobs in container jobs, or use scale set agents with tear-down after every use so each VM is reimaged between jobs. Where agents must persist, set `workspace: clean: all` on the job and treat any globally installed tool as part of the image rather than something a pipeline installs.

---

## Key Takeaways

1. **YAML pipelines are the recommended standard.** They are versionable, reviewable, and repeatable. Classic pipelines still work and have no announced retirement date, but new capability lands in YAML.

2. **Deployment jobs implement rolling and canary directly.** `runOnce`, `rolling`, and `canary` strategies with `preDeploy`, `deploy`, `routeTraffic`, `postRouteTraffic`, and `on: failure` hooks cover most rollouts without hand-orchestration. Rolling works only against VM resources, and blue-green is something you assemble rather than declare.

3. **Approvals and checks live outside the YAML on purpose.** They are configured by resource owners on environments, service connections, repositories, variable groups, secure files, and agent pools, so someone who can edit the pipeline file cannot weaken them.

4. **Workload identity federation is the credential to use for Azure.** It removes the stored secret entirely. The Azure DevOps issuer retires 1 July 2027, so existing federated connections in Azure public cloud need to move to the Microsoft Entra issuer.

5. **Key Vault holds the values; the variable group holds only the names.** Rotation becomes a vault operation. RBAC vaults behind a private endpoint cannot be used this way, because Azure DevOps is not a Key Vault trusted service.

6. **Parallel jobs are licensed at the organization level, for self-hosted agents too.** Self-hosted removes per-minute cost and job time limits, not the concurrency license. The Microsoft-hosted free tier has to be enabled by linking an Azure subscription, and gives one job at 60 minutes and 1,800 minutes a month.

7. **`extends` is a convention until a Required template check makes it a control.** Pair the two when a parent template is enforcing something that matters, like a security scan.

8. **Branch policies plus a Branch control check cover both halves of the problem.** Policies stop bad code reaching main; the check stops a run from an unexpected branch reaching production.

9. **Cache dependencies, publish artifacts.** Cache what merely slows the job when missing, publish what breaks it. Caches are immutable, already scoped per branch, and expire after seven days of inactivity, so version the key rather than trying to clear it.

10. **Retention is a project-level setting and protects only successful runs.** Deleting a run deletes its artifacts and logs. Pipeline artifacts and caches are exempt from storage billing, so retention is about traceability and compliance rather than cost. Container images and package feeds need their own retention rules.
