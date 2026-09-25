---
title: "AWS CodePipeline & CodeBuild for System Architects"
layout: guide
category: AWS
subcategory: Developer Tools & CI/CD
description: "How CodePipeline orchestrates releases and CodeBuild runs builds: stages, actions, artifacts, and variables; V2 triggers, execution modes, stage conditions, and rollback; build compute, the buildspec, caching, and Docker builds; cross-account and cross-Region pipelines; and when to use them over another CI/CD system."
tags: [codepipeline, codebuild, buildspec, cross-account, cicd, practical]
---

## What CodePipeline and CodeBuild Do

**AWS CodePipeline** orchestrates a release. It watches a source, such as a Git repository, and moves each change through an ordered set of steps, such as building, testing, approving, and deploying, recording what happened at each. It doesn't compile code or run tests itself. It calls other services to do the work.

**AWS CodeBuild** is one of those services, and the most common. It runs each build in a fresh, managed environment. It fetches the source, runs the commands in a **buildspec** file, and uploads the results. It runs on its own too, triggered by a repository webhook, or as the runner for another CI system's jobs.

Together they form AWS's managed CI/CD. Both are pay-per-use with no servers to run, and both act through IAM roles, which is what makes them a natural fit for deploying into AWS accounts.

---

## CodePipeline

### Pipelines, stages, and actions

A **pipeline** is a sequence of **stages**, such as Source, Build, Staging, and Production. Each stage holds one or more **actions**. Actions with the same run order run in parallel, and higher run orders wait for lower ones, so a stage can run unit tests and a security scan side by side and then deploy. Each action belongs to a category and has a provider:

| Category | Common providers |
| --- | --- |
| Source | GitHub, GitLab, and Bitbucket through CodeConnections; CodeCommit; S3; ECR |
| Build and test | CodeBuild, `ECRBuildAndPublish` (V2), Jenkins, Device Farm |
| Compute | `Commands` (V2), shell commands run on CodeBuild compute without a build project |
| Deploy | CloudFormation and StackSets, CodeDeploy, ECS, S3, Elastic Beanstalk, AppConfig, and EKS, Lambda, and EC2 (V2) |
| Approval | Manual approval |
| Invoke | Lambda, Step Functions, Amazon Inspector scan, another pipeline |

**AWS CodeConnections**, formerly CodeStar Connections, is how CodePipeline and CodeBuild reach third-party Git hosts. A connection is an AWS resource authorized once through the provider's app installation, so no personal access token sits in the pipeline. The source action that uses a connection keeps the old name, `CodeStarSourceConnection`.

A stage is also the unit of locking. Except in the `PARALLEL` execution mode described below, only one execution can be inside a stage at a time, so actions grouped in one stage are guaranteed to act on the same change. Deploying to an environment and then testing it belongs in one stage for that reason, and each environment gets its own stage.

### Artifacts and variables

Actions pass files to each other as **artifacts**, zip files stored in an S3 bucket that the pipeline owns. A source action outputs the repository contents, a build action takes that as input and outputs its build results, and a deploy action takes the build output. Artifacts are named, and an action lists the ones it consumes and produces.

Actions also pass values as **variables**. An action that sets a `Namespace` exports its variables under that name, and later actions reference them with `#{namespace.name}` syntax, such as `#{SourceVariables.CommitId}` for a source action whose namespace is `SourceVariables`. A CodeBuild action exports the environment variables listed under `exported-variables` in its buildspec. V2 pipelines also have **pipeline-level variables**, set when an execution starts, which suit values like a target version or a feature flag for the run.

### Triggers

A V2 pipeline with a CodeConnections source starts on **triggers** filtered by Git event. A push trigger can filter on branches, file paths, and tags. A pull request trigger fires when a pull request is opened, updated, or merged, filtered by destination branch and file path. File path filters let several pipelines share one repository, each starting only when its own directory changes. V1 pipelines can only start on every push to the one branch the source action names.

A pipeline can also start manually, or from Amazon EventBridge, AWS's event bus, on a schedule or when a matching event occurs. ECR and S3 sources start through EventBridge events when an image is pushed or an object changes.

### Execution modes

When a new change arrives while an earlier execution is still running, the **execution mode** decides what happens:

| Mode | Behavior | Suits |
| --- | --- | --- |
| `SUPERSEDED` (default) | A newer execution waiting at a stage replaces the older one waiting there. Running stages are never interrupted. | Most release pipelines, where only the latest change matters |
| `QUEUED` (V2) | Executions wait in order and none is skipped. | Pipelines where every change must be deployed and verified in turn |
| `PARALLEL` (V2) | Executions run independently, without locking stages. | Feature-branch pipelines that deploy to separate targets |

Superseding happens only between stages, so a running stage is never interrupted, and it loses no code, because the newer execution contains the older commits. What's lost is testing each change on its own. Two changes that arrive close together reach staging and production as one. `PARALLEL` pipelines can't use stage rollback.

{% include figure.html id="aws-codepipeline-execution-modes" %}

### Approvals, conditions, and rollback

A **manual approval** action stops the pipeline until someone with permission approves or rejects it, optionally notifying an SNS topic. The stage stays locked while it waits, and an approval that gets no answer in seven days fails.

V2 pipelines add **stage conditions**, automated checks that run at a stage's boundaries. Each condition holds rules, such as a CloudWatch alarm check, a deployment window defined by a cron expression, a variable check, a Lambda function, or shell commands:

- An **entry condition** runs before the stage starts, and fails or skips the stage if a rule fails. Blocking a production deployment while production alarms are firing is the usual use.
- An **on-success condition** runs after the stage succeeds, and can fail it or roll it back, for example if an alarm fires within an hour of deploying.
- An **on-failure condition** runs when the stage fails, and can roll it back or retry it.

**Stage rollback** reruns a stage's actions with the artifacts and variables of an earlier execution that completed it successfully. It helps most where the actions redeploy cleanly from artifacts, such as CloudFormation and ECS deployments. A source stage can't be rolled back, and the target execution must have run on the current version of the pipeline's structure. A stage can also retry failed actions automatically.

### Pipeline types and pricing

New pipelines are **V2** unless you choose otherwise. Triggers, pipeline variables, the `QUEUED` and `PARALLEL` modes, stage conditions, rollback, automatic retry, and the actions marked V2 above are V2 only. The two types are priced differently:

- **V1** costs $1 per active pipeline per month, where active means it has existed for more than 30 days and ran a change that month. One active V1 pipeline a month is free.
- **V2** costs $0.002 per action execution minute, rounded up per action, with manual approval and custom actions free. The first 100 minutes each month, shared across all V2 pipelines, are free.

A V2 pipeline that runs a few short actions a few times a day costs pennies. Long-running actions change that. A deployment action that bakes for an hour costs $0.12 per run, so nine or more such runs a month cost more than V1's $1, once the free minutes are used. CodeBuild and the other services the actions call are billed separately.

A V2 pipeline defined in CloudFormation, with a filtered trigger, queued executions, and an entry condition guarding production:

```yaml
Pipeline:
  Type: AWS::CodePipeline::Pipeline
  Properties:
    PipelineType: V2
    ExecutionMode: QUEUED
    RoleArn: !GetAtt PipelineRole.Arn
    ArtifactStore:
      Type: S3
      Location: !Ref ArtifactBucket
      EncryptionKey:
        Id: !GetAtt ArtifactKey.Arn
        Type: KMS
    Triggers:
      - ProviderType: CodeStarSourceConnection
        GitConfiguration:
          SourceActionName: Source
          Push:
            - Branches:
                Includes: [main]
              FilePaths:
                Includes: ['services/orders/**']
    Stages:
      - Name: Source
        Actions:
          - Name: Source
            ActionTypeId: { Category: Source, Owner: AWS, Provider: CodeStarSourceConnection, Version: '1' }
            Configuration:
              ConnectionArn: !Ref GitHubConnectionArn
              FullRepositoryId: example-org/platform
              BranchName: main
            OutputArtifacts: [{ Name: SourceOutput }]
      - Name: Build
        Actions:
          - Name: Build
            ActionTypeId: { Category: Build, Owner: AWS, Provider: CodeBuild, Version: '1' }
            Configuration:
              ProjectName: !Ref OrdersBuild
            InputArtifacts: [{ Name: SourceOutput }]
            OutputArtifacts: [{ Name: BuildOutput }]
      - Name: Production
        BeforeEntry:
          Conditions:
            - Result: FAIL
              Rules:
                - Name: ProductionHealthy
                  RuleTypeId: { Category: Rule, Owner: AWS, Provider: CloudWatchAlarm, Version: '1' }
                  Configuration:
                    AlarmName: orders-prod-errors
        Actions:
          - Name: Deploy
            ActionTypeId: { Category: Deploy, Owner: AWS, Provider: CloudFormation, Version: '1' }
            RoleArn: arn:aws:iam::111122223333:role/PipelineDeployRole
            Configuration:
              ActionMode: CREATE_UPDATE
              StackName: orders
              TemplatePath: BuildOutput::template.yaml
              Capabilities: CAPABILITY_IAM
              RoleArn: arn:aws:iam::111122223333:role/CloudFormationExecutionRole
            InputArtifacts: [{ Name: BuildOutput }]
```

The pipeline's top-level `RoleArn` is its **service role**, which it runs as. The deploy action has two more role ARNs. The action's own `RoleArn` is the role the pipeline assumes in the target account to run the action. The `RoleArn` inside `Configuration` is the execution role that CloudFormation uses to create the stack's resources. The sample assumes a build that outputs the stack's `template.yaml`, which the buildspec below doesn't produce.

---

## CodeBuild

### Build environments

A **build project** defines where the source comes from, which environment runs the build, which buildspec to use, the service role the build runs as, and optionally a VPC to run in. Each build runs in a new container, so nothing carries over between builds except what a cache restores. Builds can run on three kinds of compute:

| Compute | What it is | Suits |
| --- | --- | --- |
| On-demand EC2 | Predefined sizes, from `BUILD_GENERAL1_SMALL` (2 vCPUs, 4 GiB) to `2XLARGE` (72 vCPUs, 144 GiB), on Linux x86, Arm, Windows, and GPU | Most builds, and anything needing Docker, root, or a VPC |
| Lambda | 1 to 10 GiB of memory, starting in seconds and billed per second | Short builds of interpreted or managed-runtime code, such as linting, unit tests, and packaging |
| Reserved capacity fleet | Instances CodeBuild keeps provisioned for your builds, including macOS, sized by vCPU, memory, and disk | High build volume, no queueing or startup wait, and builds that benefit from a warm host |

Lambda compute is fast to start but restricted. It can't build or run Docker images, use root, run in a VPC, use a cache, or run longer than 15 minutes. On-demand EC2 builds can run for up to 36 hours.

On-demand Linux builds cost from $0.005 per minute for `BUILD_GENERAL1_SMALL`, rising with size, and the free tier includes 100 minutes a month on the small x86 or Arm instance. Reserved fleets are billed per instance-minute from provisioning until termination, whether or not builds are running, with a 60-minute minimum per instance, or 24 hours for macOS. The default concurrent build quota is low, often one build per compute type, and zero for `2XLARGE` and GPU, which can't run at all until the quota is raised. Parallel actions and batch builds wait behind it, so request an increase before relying on them.

CodeBuild provides curated images with common runtimes preinstalled. Pin the major image version, such as `aws/codebuild/amazonlinux-x86_64-standard:6.0`, rather than a patch version, because CodeBuild caches the latest patch of each major version on its hosts and other versions must be downloaded at the start of each build. A custom image from ECR suits builds that need tools the curated images lack.

### The buildspec

The **buildspec** is a YAML file, usually `buildspec.yml` at the repository root, that tells CodeBuild what to run. A build for a .NET service that restores, builds, tests, and publishes looks like this:

```yaml
version: 0.2

env:
  variables:
    CONFIGURATION: Release
  secrets-manager:
    NUGET_TOKEN: build/nuget-feed:token
  exported-variables:
    - BUILD_VERSION

phases:
  install:
    runtime-versions:
      dotnet: 10.0
  pre_build:
    commands:
      - dotnet restore
  build:
    commands:
      - dotnet build --no-restore -c $CONFIGURATION
      - dotnet test --no-build -c $CONFIGURATION --logger trx --results-directory ./TestResults
      - dotnet publish src/Orders.Api --no-build -c $CONFIGURATION -o ./publish
  post_build:
    commands:
      - export BUILD_VERSION=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c1-8)

reports:
  unit-tests:
    files: ['**/*.trx']
    file-format: VisualStudioTrx

artifacts:
  base-directory: publish
  files: ['**/*']

cache:
  paths:
    - '/root/.nuget/packages/**/*'
```

The phases run in order, `install`, `pre_build`, `build`, then `post_build`. A failing command fails its phase. A failure in `install` or `pre_build` skips the later phases, but `post_build` still runs after a failed `build` phase. The `env` section reads values from Secrets Manager and Parameter Store at the start of the build. CodeBuild masks those values in the logs, but only where they appear exactly as stored, so an encoded or transformed secret prints in full. The `reports` section turns test result files into test reports in the console, and `artifacts` defines what the build uploads for the next pipeline action.

For large test suites or multi-platform builds, **batch builds** run several builds from one buildspec, as a list, a matrix of environment and variable combinations, a dependency graph, or a fanout that splits the test suite across parallel builds.

### Caching

A cache keeps downloaded dependencies and intermediate output between builds. There are two kinds, set on the build project:

- An **S3 cache** stores the paths listed under `cache` in the buildspec as an archive in an S3 bucket, and downloads it at the start of the next build. It's available to every build, at the cost of the transfer time.
- A **local cache** keeps data on the build host, which is faster, but a later build only finds it if it lands on the same host. It has three modes: source cache for the Git metadata, Docker layer cache for image builds, and custom cache for the buildspec's paths. Local caching suits frequent builds, where hosts get reused. It isn't available for builds in a VPC or on `2XLARGE` and GPU compute.

### Docker builds

Building Docker images on on-demand EC2 compute needs the project's **privileged mode**, because the build runs a Docker daemon inside its container. Privileged mode gives the build container access to the host's devices, so enable it only on projects that build images. Pushing to ECR also needs `ecr:GetAuthorizationToken` and the push permissions on the service role. For faster repeated image builds, CodeBuild can run a dedicated **Docker server** for the project, which keeps its layer cache between builds and is recycled after a month. In a pipeline, the `ECRBuildAndPublish` action builds and pushes an image without a buildspec at all.

### CodeBuild as a runner

CodeBuild can run another CI system's jobs on its compute. A project configured as a **GitHub Actions runner** or a **GitLab runner** receives jobs from that system, runs each on a fresh CodeBuild host, and reports back. The workflow stays in GitHub or GitLab, while the jobs run inside AWS with an IAM role, VPC access, and CodeBuild's compute types, including Arm, GPU, and Lambda. It suits teams that keep their workflows in GitHub Actions or GitLab CI but need their builds to reach private AWS resources without long-lived credentials.

---

## Cross-Account and Cross-Region Pipelines

The usual layout keeps the pipeline and its builds in a **tooling account** and deploys into separate accounts for each environment. The pipeline's service role assumes a role in each target account, and that role starts the deployment there:

{% include figure.html id="aws-codepipeline-cross-account" %}

Making it work takes four pieces:

1. **A customer managed KMS key** encrypting the artifact bucket, with a key policy that lets each target account's role decrypt. The default AWS managed key can't be shared across accounts, so a cross-account pipeline can't use it.
2. **A bucket policy** on the artifact bucket letting each target account's role read artifacts, and write them where an action in that account produces output.
3. **A cross-account role in each target account**, trusted only by the pipeline's service role, with permission to start deployments, read the artifacts, and pass the deployment execution role.
4. **A deployment execution role in each target account**, such as the CloudFormation execution role, holding the permissions to create the actual resources.

An action in another account can only use artifacts produced in the pipeline account, or by an earlier action in its own account. Artifacts never pass directly between two target accounts.

A pipeline can also run actions in other Regions. It needs an artifact bucket in each Region where it runs actions, and CodePipeline copies artifacts to those buckets automatically. Each action names its Region in its `Region` field. In CloudFormation, a cross-Region pipeline lists its buckets under `ArtifactStores`, one per Region, in place of the single `ArtifactStore` in the sample above. Jenkins actions can't run in another account.

---

## Security

**Scope the service roles.** The pipeline's service role needs to read and write its artifact bucket, use the key, start its actions, and assume the cross-account roles, and nothing more. The CodeBuild service role needs its logs, its artifacts, and whatever the build itself calls. Console-created roles are broader than this, so review them before production use.

**Keep secrets out of buildspecs and environment variables.** Reference them from Secrets Manager or Parameter Store in the buildspec's `env` section. Anyone who can edit a buildspec or a pipeline can still print a secret the build can read, so treat edit access to build definitions as access to their secrets, and give production deployment credentials only to the roles that deploy to production.

**Run builds that need private resources in a VPC.** A project with a VPC configuration runs in your subnets and can reach private databases and internal package feeds. It then has no internet access of its own, so it needs a NAT gateway or VPC endpoints for S3, ECR, CloudWatch Logs, and anything else the build calls.

**Pull request builds run untrusted code.** A build triggered by a pull request from a fork runs code anyone can write. CodeBuild's **pull request comment approval**, on by default for new projects, holds such builds until a contributor with an approver role in the repository comments to allow them. Keep it on, run pull request builds in a separate project with a role that can't reach deployment credentials or production resources, and anchor any webhook filter patterns with `^` and `$` so they can't be matched by a longer name.

---

## Common Pitfalls

- **`post_build` pushes after failed tests.** A `post_build` step that pushes an image or publishes a package runs even when the tests in `build` failed. Check `$CODEBUILD_BUILD_SUCCEEDING` in the step. Setting `on-failure: ABORT` on the build phase also works, but not on Lambda compute or reserved fleets.
- **Superseded executions batch changes.** In `SUPERSEDED` mode, a change that was superseded is never verified on its own in staging, because it arrives there bundled with the change that replaced it. When staging shows a regression, the culprit can be any of the bundled commits. Use `QUEUED` mode where each change must be verified alone.
- **Stop and abandon leaves work running.** Stopping an execution with the abandon option marks its in-progress actions abandoned, but the services doing the work carry on. A CloudFormation update keeps going, and the next execution can collide with it. Prefer stop and wait.
- **Moving a build into a VPC.** A build moved into a VPC loses its internet access, so dependency downloads, ECR pulls, and log delivery fail until NAT or endpoints are added, and it loses local caching, so it also slows down.

---

## CodePipeline or Another CI/CD System

CodePipeline's advantage is that it lives in AWS. It deploys through IAM roles rather than stored credentials, reaches across accounts and Regions natively, integrates with CloudFormation, CodeDeploy, ECS, and Lambda without plug-ins, and gates on CloudWatch alarms. It fits organizations whose releases are mostly AWS deployments and that want the pipeline governed like any other AWS resource. The CDK's CDK Pipelines construct builds one for a CDK app.

Its disadvantage is the developer experience around the code. Hosted CI systems such as GitHub Actions and GitLab CI keep workflows next to the code, with pull request checks and large ecosystems of reusable steps that CodePipeline doesn't replicate. They reach AWS through OIDC federation, where the CI system issues a short-lived identity token that IAM exchanges for a role's credentials, which removes the stored-credential argument for CodePipeline.

The choice is often a split rather than one or the other. Teams run pull request checks and builds in their Git host's CI, optionally on CodeBuild runners for AWS network access, and use CodePipeline, or the Git host's own deployment workflows, for promotion through accounts. Choose by where the release logic is easiest to govern. A pipeline that must enforce alarms, approvals, and account boundaries for many teams suits CodePipeline, and a team-owned service that deploys to one account suits the Git host's CI.

---

## Key Takeaways

- CodePipeline orchestrates releases and CodeBuild runs builds. A pipeline is stages of actions, passing artifacts through S3 and values through variables.
- Use V2 pipelines for triggers with branch, tag, and path filters, queued or parallel execution, pipeline variables, stage conditions, and rollback. V2 is billed per action minute, so long-waiting actions cost more.
- Choose the execution mode deliberately. `SUPERSEDED` batches changes that arrive close together, and `QUEUED` verifies and deploys each change in order.
- Use entry conditions on production stages to block deployments while alarms fire, and on-success or on-failure conditions to roll back automatically.
- Choose CodeBuild compute by the build. Lambda for short builds without Docker, on-demand EC2 for most builds, and reserved fleets for high volume, remembering that fleets bill while idle. Raise the concurrent build quota early.
- In buildspecs, pull secrets from Secrets Manager or Parameter Store, guard `post_build` steps against failed builds, and cache dependencies.
- Deploy across accounts from a tooling account, with a customer managed key on the artifact bucket and a narrowly trusted role in each target account.
