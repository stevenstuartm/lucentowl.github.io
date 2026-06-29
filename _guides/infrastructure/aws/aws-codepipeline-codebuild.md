---
title: "AWS CodePipeline & CodeBuild for System Architects"
layout: guide
category: AWS
subcategory: Developer Tools & CI/CD
description: "Comprehensive guide to AWS CodePipeline and CodeBuild covering pipeline orchestration, build automation, cross-account deployments, integration patterns, cost optimization, and CI/CD best practices"
tags: [aws, cicd, codepipeline, codebuild, automation, devops, deployment, fundamentals]
---

## What Problems CodePipeline & CodeBuild Solve

AWS CodePipeline and CodeBuild automate software delivery from code commit to production deployment:

**Eliminate manual deployments**: Before CI/CD, deploying code requires 15 manual steps: pull code, run tests, build artifacts, SSH into servers, copy files, restart services. One missed step causes production outage. CodePipeline automates all steps, ensuring consistency and reducing human error.

**Accelerate release cycles**: Manual testing and deployment take 4 hours. Developers hesitate to deploy frequently, batching changes into risky monthly releases. CodePipeline reduces deployment to 15 minutes, enabling multiple daily deployments with smaller, safer changes.

**Consistent build environments**: "It works on my machine" problems arise from environment differences. Developer has Node 18, production has Node 16. CodeBuild provides consistent Docker-based build environments, eliminating environment drift.

<div class="callout callout--tip">
<p class="callout__title">Docker-Based Consistency</p>
<p>CodeBuild runs every build in a fresh Docker container, ensuring identical environments across all builds. No more environment drift between developer machines and production.</p>
</div>

**Multi-environment deployment**: Deploying to dev, staging, and production requires repeating deployment steps three times. CodePipeline orchestrates sequential deployments with approval gates, ensuring changes flow through all environments consistently.

**Cross-account isolation**: Security requires separating development, staging, and production in different AWS accounts. CodePipeline supports cross-account deployments, maintaining account isolation while automating the delivery pipeline.

**Testing automation**: Manual QA testing finds bugs days after code commit. CodePipeline integrates automated tests (unit, integration, E2E) that run on every commit, catching bugs within minutes.

**Artifact management**: Build artifacts scattered across developer machines and build servers. CodePipeline stores artifacts in S3, providing single source of truth for deployments and rollbacks.

## Service Fundamentals

### CodePipeline Overview

CodePipeline orchestrates the software release process:

**Pipeline**: Workflow consisting of stages executed sequentially
**Stage**: Logical grouping of actions (e.g., Source, Build, Test, Deploy)
**Action**: Individual task within a stage (e.g., pull code from GitHub, run CodeBuild, deploy to EC2)
**Transition**: Connection between stages (can be disabled for manual control)
**Artifact**: File or set of files passed between stages (source code, build output, test results)

**Execution**: Single run of the pipeline from start to finish, triggered by source change or manual trigger.

### CodeBuild Overview

CodeBuild compiles source code, runs tests, and produces deployable artifacts:

**Build project**: Configuration defining how to build code (source, environment, build commands)
**Build environment**: Docker container where build executes (compute type, OS, runtime)
**Buildspec**: YAML file defining build commands and artifacts
**Build phase**: Section of build (install, pre_build, build, post_build)
**Artifact**: Output produced by build (JAR file, Docker image, static website)

### How They Work Together

**Typical pipeline flow**:
1. **Source stage**: CodePipeline detects code change in GitHub/CodeCommit
2. **Build stage**: CodePipeline triggers CodeBuild project
3. **CodeBuild**: Pulls source code, runs buildspec commands, uploads artifacts to S3
4. **Test stage**: CodePipeline runs tests (unit, integration, E2E)
5. **Deploy stage**: CodePipeline deploys artifacts to EC2, Lambda, ECS, etc.

**Artifact flow**: Source code → Build artifact → Test results → Deployment package

## CodePipeline Deep Dive

### Pipeline Structure

**Source stage**:
- Source provider: GitHub, Bitbucket, CodeCommit, S3, ECR
- Trigger: Webhook (push to branch), polling (deprecated), EventBridge
- Output: Source code as artifact

**Build stage**:
- Build provider: CodeBuild, Jenkins, CloudBees
- Input: Source artifact
- Output: Build artifact (compiled code, Docker image, etc.)

**Test stage**:
- Test provider: CodeBuild (running tests), third-party testing tools
- Input: Build artifact
- Output: Test results

**Deploy stage**:
- Deploy provider: CodeDeploy, ECS, Lambda, S3, CloudFormation, Elastic Beanstalk
- Input: Build artifact
- Output: Deployed application

**Approval stage**:
- Manual approval action
- SNS notification sent to approvers
- Pipeline waits until approved or rejected

### Actions

**Action types**:
- **Source**: Pull code from repository
- **Build**: Execute CodeBuild project or Jenkins job
- **Test**: Run tests via CodeBuild or third-party
- **Deploy**: Deploy to target environment
- **Approval**: Manual approval gate
- **Invoke**: Trigger Lambda function or Step Functions workflow

**Action configuration**:
```yaml
ActionTypeId:
  Category: Build
  Owner: AWS
  Provider: CodeBuild
  Version: '1'
Configuration:
  ProjectName: my-build-project
InputArtifacts:
  - Name: SourceOutput
OutputArtifacts:
  - Name: BuildOutput
```

### Parallel Actions

Execute multiple actions simultaneously within a stage:

**Use case**: Run unit tests and integration tests in parallel
```
Stage: Test
  Action 1: Unit tests (CodeBuild project A)
  Action 2: Integration tests (CodeBuild project B)
  Action 3: Security scan (CodeBuild project C)
```

All three run simultaneously, reducing stage duration from 30 minutes (sequential) to 10 minutes (parallel, longest action).

### Manual Approvals

Approval actions pause pipeline for manual review:

**Configuration**:
```yaml
ActionTypeId:
  Category: Approval
  Owner: AWS
  Provider: Manual
  Version: '1'
Configuration:
  NotificationArn: arn:aws:sns:us-east-1:123456789012:approvals
  CustomData: 'Please review staging deployment before production'
```

**Workflow**:
1. Pipeline reaches approval action
2. SNS notification sent to approvers (email, Slack via Lambda)
3. Approver reviews staging environment
4. Approver clicks "Approve" or "Reject" in console or via API
5. If approved, pipeline continues; if rejected, execution stops

### Variables

Pipeline variables pass data between actions:

**Example**: Extract commit ID from source action, use in build
```yaml
# Source action outputs commitId variable
Variables:
  commitId: #{SourceVariables.CommitId}

# Build action uses variable
Configuration:
  EnvironmentVariables:
    - name: COMMIT_ID
      value: '#{variables.commitId}'
      type: PLAINTEXT
```

**Built-in variables**:
- `#{SourceVariables.CommitId}`: Commit hash
- `#{SourceVariables.BranchName}`: Branch name
- `#{SourceVariables.RepositoryName}`: Repository name

### Execution Modes

**Superseded**: New execution supersedes previous running execution (default)
**Queued**: New executions queue if pipeline already running
**Parallel**: Multiple executions run simultaneously

**Use case for Queued**: Deployment pipelines where deployments must happen sequentially to avoid conflicts.

## CodeBuild Deep Dive

### Build Projects

Build project configuration:

**Source**: GitHub, Bitbucket, CodeCommit, S3
**Environment**: Compute type, OS, runtime, Docker image
**Buildspec**: Inline or file in repository
**Service role**: IAM role CodeBuild assumes
**Timeout**: Max build duration (5 minutes to 8 hours)
**VPC**: Optional VPC placement for private resource access

### Build Environments

**Compute types**:
- `BUILD_GENERAL1_SMALL`: 3 GB RAM, 2 vCPUs - $0.005/minute
- `BUILD_GENERAL1_MEDIUM`: 7 GB RAM, 4 vCPUs - $0.01/minute
- `BUILD_GENERAL1_LARGE`: 15 GB RAM, 8 vCPUs - $0.02/minute
- `BUILD_GENERAL1_2XLARGE`: 144 GB RAM, 72 vCPUs - $0.15/minute (Linux only)

**Operating systems**:
- Amazon Linux 2
- Ubuntu
- Windows Server 2019

**Runtimes**: Node.js, Python, Java, Ruby, Go, .NET, PHP, Docker

**Custom images**: Use custom Docker images from ECR or Docker Hub for specialized environments.

### Buildspec

Buildspec.yml defines build commands:

**Example**:
```yaml
version: 0.2

env:
  variables:
    NODE_ENV: production
  parameter-store:
    DB_PASSWORD: /myapp/prod/db-password

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install -g yarn

  pre_build:
    commands:
      - echo "Running tests..."
      - yarn install
      - yarn test

  build:
    commands:
      - echo "Building application..."
      - yarn build

  post_build:
    commands:
      - echo "Build completed"

artifacts:
  files:
    - '**/*'
  base-directory: dist
  name: BuildArtifact-$(date +%Y%m%d-%H%M%S)

cache:
  paths:
    - node_modules/**/*
```

**Phases**:
- `install`: Install runtimes and tools
- `pre_build`: Commands before build (install dependencies, run tests)
- `build`: Build commands (compile, bundle, package)
- `post_build`: Commands after build (create deployment package, push Docker image)

**Artifacts**: Specifies files to upload to S3 as build output.

**Cache**: Specifies files to cache between builds (dependencies, build tools) to speed up subsequent builds.

### Environment Variables

**Plain text**:
```yaml
env:
  variables:
    NODE_ENV: production
    API_URL: https://api.example.com
```

**Parameter Store**:
```yaml
env:
  parameter-store:
    DB_PASSWORD: /myapp/prod/db-password
```

**Secrets Manager**:
```yaml
env:
  secrets-manager:
    API_KEY: myapp/prod/api:key
```

**Build-time variables** (passed from CodePipeline):
```yaml
env:
  exported-variables:
    - IMAGE_TAG
```

### Docker Support

**Build Docker images**:
```yaml
phases:
  build:
    commands:
      - docker build -t myapp:latest .
      - docker tag myapp:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest

  post_build:
    commands:
      - aws ecr get-login-password | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
      - docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/myapp:latest
```

**Privileged mode**: Required for building Docker images (`privileged_mode: true` in build project).

### Build Caching

Cache dependencies to speed up builds:

**Local caching**: Cache Docker layers and custom directories (faster but costs more)
**S3 caching**: Cache dependencies in S3 (slower than local but cheaper)

**Example** (caching node_modules):
```yaml
cache:
  paths:
    - node_modules/**/*
```

First build: Downloads dependencies (2 minutes)
Subsequent builds: Restores from cache (10 seconds)

### Build Badges

CodeBuild provides build status badges for README files:

```markdown
![Build Status](https://codebuild.us-east-1.amazonaws.com/badges?uuid=XXXXXX)
```

Shows: Passing, Failing, In Progress

## Pipeline Patterns

### Basic CI/CD Pipeline

```
Source (GitHub) → Build (CodeBuild) → Deploy (CodeDeploy)
```

**Trigger**: Push to main branch
**Build**: Compile code, run tests
**Deploy**: Deploy to production EC2 instances

### Multi-Environment Pipeline

```
Source → Build → Deploy (Dev) → Approval → Deploy (Staging) → Approval → Deploy (Production)
```

**Flow**:
1. Code pushed to main
2. CodeBuild compiles and tests
3. Auto-deploy to dev environment
4. Manual approval after dev testing
5. Deploy to staging
6. Manual approval after staging validation
7. Deploy to production

### Parallel Testing Pipeline

```
Source → Build → [Unit Tests || Integration Tests || Security Scan] → Deploy
```

**Benefit**: Runs tests in parallel, reducing pipeline duration.

### Blue/Green Deployment Pipeline

```
Source → Build → Deploy (Blue) → Traffic Shift (10% → 50% → 100%) → Terminate (Green)
```

**Integration with CodeDeploy**: CodePipeline triggers CodeDeploy blue/green deployment with gradual traffic shifting.

### Infrastructure and Application Pipeline

```
Source → Build App → Build Infra → Deploy Infra (CloudFormation) → Deploy App (CodeDeploy)
```

**Use case**: Infrastructure as code (CloudFormation) deployed before application code.

### Multi-Repository Pipeline

**Trigger**: EventBridge rule detects changes in any of 3 repositories
**Action**: Pipeline pulls from all 3 repositories, combines artifacts, deploys

**Use case**: Microservices where services in separate repositories must deploy together.

## Cross-Account Pipelines

CodePipeline supports deployments across AWS accounts:

### Architecture

**Shared Services Account**: CodePipeline, CodeBuild, artifact S3 bucket
**Dev Account**: Development environment
**Staging Account**: Staging environment
**Production Account**: Production environment

**Pipeline flow**:
1. CodePipeline in Shared Services account
2. Build in CodeBuild (Shared Services)
3. Deploy to Dev account
4. Approval
5. Deploy to Staging account
6. Approval
7. Deploy to Production account

### Cross-Account Permissions

**Artifact bucket policy** (Shared Services account):
```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": [
      "arn:aws:iam::111111111111:root",  // Dev account
      "arn:aws:iam::222222222222:root",  // Staging account
      "arn:aws:iam::333333333333:root"   // Production account
    ]
  },
  "Action": [
    "s3:GetObject",
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::my-artifact-bucket/*"
}
```

**KMS key policy** (for encrypted artifacts):
```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": [
      "arn:aws:iam::111111111111:root",
      "arn:aws:iam::222222222222:root",
      "arn:aws:iam::333333333333:root"
    ]
  },
  "Action": [
    "kms:Decrypt",
    "kms:DescribeKey"
  ],
  "Resource": "*"
}
```

**IAM roles in target accounts**:
- CodePipeline assumes role in target account
- Role has permissions to deploy (CloudFormation, CodeDeploy, Lambda, etc.)

**Example role** (Production account):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::000000000000:role/CodePipelineServiceRole"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Cross-Account Deployment Action

```yaml
ActionTypeId:
  Category: Deploy
  Owner: AWS
  Provider: CloudFormation
  Version: '1'
Configuration:
  StackName: my-application-stack
  RoleArn: arn:aws:iam::333333333333:role/CloudFormationDeploymentRole
  ActionMode: CREATE_UPDATE
```

CodePipeline assumes `CloudFormationDeploymentRole` in Production account to execute deployment.

## Integration Patterns

### GitHub Integration

**Trigger**: GitHub webhook triggers pipeline on push
**Authentication**: GitHub connection or personal access token
**Source action**: Pulls code from GitHub repository

**Setup**:
1. Create GitHub connection in CodePipeline (OAuth)
2. Configure source action with repository and branch
3. Pipeline triggers automatically on push

### CodeCommit Integration

**Native integration**: CodeCommit is AWS-native, no authentication configuration needed
**Trigger**: CloudWatch Events/EventBridge detects commits
**Branches**: Pipeline can monitor specific branch (main, develop, etc.)

### ECR Integration

**Trigger**: Pipeline triggers on new Docker image push to ECR
**Use case**: Deploy containerized applications when new image available

**EventBridge rule**:
```json
{
  "source": ["aws.ecr"],
  "detail-type": ["ECR Image Action"],
  "detail": {
    "action-type": ["PUSH"],
    "image-tag": ["latest"],
    "repository-name": ["my-app"]
  }
}
```

### Lambda Integration

**Invoke Lambda function** as pipeline action:

**Use cases**:
- Custom validation logic
- Integration with third-party systems
- Slack/Teams notifications
- Database migrations
- Complex approval workflows

**Example**:
```yaml
ActionTypeId:
  Category: Invoke
  Owner: AWS
  Provider: Lambda
  Version: '1'
Configuration:
  FunctionName: SendDeploymentNotification
  UserParameters: '{"environment": "production"}'
```

### SNS Integration

**Notifications**:
- Pipeline execution started/succeeded/failed
- Manual approval needed
- Stage execution started/failed

**EventBridge rule** (pipeline failure notification):
```json
{
  "source": ["aws.codepipeline"],
  "detail-type": ["CodePipeline Pipeline Execution State Change"],
  "detail": {
    "state": ["FAILED"]
  }
}
```

Target: SNS topic → Email, Lambda, Slack

### Third-Party Integrations

**Jenkins**: CodePipeline can trigger Jenkins jobs as build/test actions
**GitHub Actions**: Hybrid approach (GitHub Actions for build, CodePipeline for deployment)
**Jira**: Lambda function creates Jira deployment ticket when pipeline deploys to production
**Slack**: Lambda function posts deployment status to Slack channel

## Performance Optimization

### Build Performance

**Use caching**:
```yaml
cache:
  paths:
    - node_modules/**/*
    - .gradle/caches/**/*
```

Savings: 2-minute dependency download reduced to 10-second cache restore.

**Parallel builds**: Split test suites across multiple CodeBuild projects running in parallel.

**Compute type selection**: Use larger compute type for build-heavy projects (BUILD_GENERAL1_LARGE for Java/Gradle builds).

**Local Docker layer caching**: Enable for Docker image builds (reduces image build time by 50-80%).

### Pipeline Performance

**Parallel actions**: Run tests, security scans, and code quality checks simultaneously.

**Conditional actions**: Skip non-essential stages for non-production branches.

**Optimize artifact size**: Only include necessary files in artifacts (reduces S3 upload/download time).

**Regional resources**: Keep pipeline, build projects, and artifact bucket in same region (reduces cross-region transfer time and cost).

### Build Optimization Strategies

**Multi-stage Docker builds**: Reduce final image size, faster push to ECR.

**Incremental builds**: Use build tools that support incremental compilation (Gradle, Webpack).

**Dependency pre-caching**: Create base Docker image with dependencies pre-installed.

**Concurrent test execution**: Configure test framework for parallel test execution (Jest, pytest-xdist).

## Cost Optimization Strategies

### CodePipeline Pricing

**Cost**: $1 per active pipeline per month (pipeline with at least one execution)
**Free tier**: First pipeline per account per month is free

**Optimization**: Consolidate multiple low-frequency pipelines into single pipeline with conditional stages based on input parameters.

### CodeBuild Pricing

**Compute charges**: Per-minute pricing based on compute type
- Small: $0.005/minute = $0.30/hour
- Medium: $0.01/minute = $0.60/hour
- Large: $0.02/minute = $1.20/hour

**Optimization strategies**:

**Right-size compute type**: Use smallest compute type that meets performance needs. Over-provisioned builds waste money.

**Example**: Node.js application build on BUILD_GENERAL1_LARGE (15 GB RAM) when BUILD_GENERAL1_SMALL (3 GB RAM) sufficient. Waste: $0.015/minute × 10 minutes × 100 builds/month = $150/month.

**Reduce build time**:
- Enable caching (reduces build from 5 minutes to 2 minutes = 60% cost reduction)
- Optimize Dockerfile layers
- Use parallel testing

**Scheduled builds**: Avoid unnecessary builds. Use webhooks instead of scheduled triggers.

**Build batching**: Batch commits if multiple developers push rapidly (combine 5 commits into 1 build instead of 5 builds).

### Artifact Storage Costs

**S3 storage**: $0.023/GB/month (Standard tier)

**Optimization**:
- Lifecycle policy: Delete artifacts older than 30 days
- Compress artifacts (reduces size by 50-80%)
- Store only necessary files in artifacts

**Example**: 100 builds/day × 500 MB/artifact × 30-day retention = 1.5 TB = $34.50/month

With compression and lifecycle: 100 builds/day × 100 MB/artifact × 7-day retention = 70 GB = $1.61/month

### Data Transfer Costs

**Cross-region transfer**: $0.02/GB

**Optimization**: Keep all resources (CodePipeline, CodeBuild, S3, deployment targets) in same region.

## Security Best Practices

<div class="callout callout--warning">
<p class="callout__title">Never Hardcode Secrets</p>
<p>Database passwords or API keys hardcoded in buildspec.yml risk accidental exposure if committed to source control. Use Parameter Store or Secrets Manager for all sensitive values.</p>
</div>

### IAM Permissions

**Principle of least privilege**:

**CodePipeline service role**:
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::my-artifact-bucket/*"
},
{
  "Effect": "Allow",
  "Action": [
    "codebuild:StartBuild",
    "codebuild:BatchGetBuilds"
  ],
  "Resource": "arn:aws:codebuild:us-east-1:123456789012:project/my-build-project"
}
```

**CodeBuild service role**:
```json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "*"
},
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::my-artifact-bucket/*"
}
```

### Secrets Management

**Never hardcode secrets in buildspec or source code**:

**Use Parameter Store**:
```yaml
env:
  parameter-store:
    DB_PASSWORD: /myapp/prod/db-password
    API_KEY: /myapp/prod/api-key
```

**Use Secrets Manager**:
```yaml
env:
  secrets-manager:
    DATABASE_URL: myapp/prod/database:url
```

**GitHub tokens**: Store in Secrets Manager, reference in CodePipeline connection.

### Artifact Encryption

**Encrypt artifacts at rest**:
- S3 bucket encryption (SSE-S3 or SSE-KMS)
- CodePipeline encryption key (customer-managed KMS key)

**Benefits**:
- Compliance with data protection regulations
- Access control via KMS key policies
- Audit trail via CloudTrail

### VPC Placement

**CodeBuild in VPC**:
- Access private resources (RDS, ElastiCache, internal APIs)
- Restrict internet access

**Configuration**:
```yaml
VpcConfig:
  VpcId: vpc-12345678
  Subnets:
    - subnet-12345678
    - subnet-87654321
  SecurityGroupIds:
    - sg-12345678
```

**Considerations**:
- Requires NAT gateway for internet access (S3, ECR)
- Use VPC endpoints to reduce NAT gateway costs

### Code Scanning

**Integrate security scanning in pipeline**:

**Static analysis** (CodeBuild action):
```yaml
phases:
  pre_build:
    commands:
      - npm audit  # Check npm dependencies for vulnerabilities
      - bandit -r src/  # Python security linter
```

**Container scanning** (ECR image scanning):
```yaml
post_build:
  commands:
    - docker push $ECR_REPO:latest
    - aws ecr start-image-scan --repository-name myapp --image-id imageTag=latest
```

**Fail build on critical vulnerabilities**:
```yaml
post_build:
  commands:
    - SCAN_FINDINGS=$(aws ecr describe-image-scan-findings --repository-name myapp --image-id imageTag=latest --query 'imageScanFindings.findingSeverityCounts.CRITICAL' --output text)
    - if [ "$SCAN_FINDINGS" -gt 0 ]; then exit 1; fi
```

## When to Use CodePipeline vs Alternatives

### CodePipeline Strengths

**Use CodePipeline when**:
- AWS-centric deployments (Lambda, ECS, EC2, CloudFormation)
- Cross-account deployments within AWS Organizations
- Integration with AWS services (CodeBuild, CodeDeploy, S3, ECR)
- Simple to moderate pipeline complexity
- Budget-conscious ($1/pipeline/month)

### GitHub Actions

**Consider GitHub Actions when**:
- GitHub-native workflows (pull requests, issues, releases)
- Open-source projects (free for public repositories)
- Complex matrix builds (test multiple OS/language versions)
- Rich marketplace of community actions
- Multi-cloud deployments

**Cost comparison**:
- CodePipeline: $1/pipeline/month + CodeBuild compute
- GitHub Actions: Free for public repos, $0.008/minute for private repos (2,000 free minutes/month)

### GitLab CI/CD

**Consider GitLab CI/CD when**:
- GitLab as source control
- Self-hosted runners for cost control
- Integrated container registry
- Advanced DevOps features (auto-deploy, review apps)

### Jenkins

**Consider Jenkins when**:
- Complex, custom pipeline logic
- Extensive plugin ecosystem (8,000+ plugins)
- Self-hosted control and customization
- Multi-cloud and on-premises deployments
- Existing Jenkins investment

**Trade-offs**: Requires infrastructure and maintenance (EC2 instances, plugins, upgrades). CodePipeline is fully managed.

### CircleCI, Travis CI, etc.

**Third-party SaaS CI/CD**: Faster setup, richer features, but vendor lock-in and potentially higher costs at scale.

### Hybrid Approach

**Common pattern**: GitHub Actions for build/test, CodePipeline for AWS deployment.

**Why**: Leverage GitHub's workflow features while using CodePipeline's cross-account deployment capabilities.

## Common Pitfalls

### Artifact Bucket Not Cross-Region Replicated

**Problem**: Pipeline in us-east-1 deploys to us-west-2. Artifact bucket only in us-east-1. Cross-region artifact retrieval is slow and expensive.

**Cause**: Didn't configure cross-region artifact replication.

**Solution**: Use S3 cross-region replication or create artifact buckets in all regions where pipeline deploys.

### Build Timing Out

**Problem**: CodeBuild builds timeout after 60 minutes (default). Complex builds take longer.

**Cause**: Insufficient build timeout configuration.

**Solution**: Increase timeout in build project settings (max 8 hours). Optimize build to reduce duration (caching, parallel tests, larger compute type).

### Missing VPC Endpoints

**Problem**: CodeBuild in VPC without internet access fails to download dependencies from npm, pip, Maven Central.

**Cause**: No NAT gateway or VPC endpoints configured.

**Solution**:
- Add NAT gateway (costs $0.045/hour + data processing)
- Or use VPC endpoints for S3, ECR, Systems Manager (free, pay only for data transfer)

### Not Using Build Caching

**Problem**: Every build downloads dependencies from scratch (2-5 minutes wasted per build).

**Cause**: Caching not configured in buildspec.

**Solution**: Enable S3 or local caching for node_modules, pip packages, Maven dependencies, etc.

Savings: 100 builds/day × 3 minutes saved × $0.01/minute = $30/day = $900/month.

### Hardcoded Secrets in Buildspec

**Problem**: Database password hardcoded in buildspec.yml. Accidentally committed to public GitHub repository. Database compromised.

**Cause**: Lack of secrets management awareness.

**Solution**: Use Parameter Store or Secrets Manager for all secrets. Never commit secrets to source control.

### Over-Provisioned Compute Type

**Problem**: Using BUILD_GENERAL1_LARGE (15 GB RAM, $0.02/minute) for simple Node.js builds that only need 1 GB RAM.

**Cause**: Default to large compute type without analysis.

**Solution**: Test builds on BUILD_GENERAL1_SMALL. If builds fail due to memory, incrementally increase. Most Node.js/Python/Ruby builds work on SMALL.

Savings: $0.02/minute → $0.005/minute = 75% cost reduction.

### No Approval Gates Before Production

**Problem**: Code automatically deploys to production without human review. Bug deployed to production, affects users.

**Cause**: No manual approval stage before production deployment.

**Solution**: Add approval action between staging and production. Require QA sign-off before production deployment.

### Pipeline Superseding Itself

**Problem**: Multiple developers push rapidly. Pipeline execution 1 superseded by execution 2 before deployment completes. Execution 1 changes never deployed.

**Cause**: Default pipeline execution mode is "superseded."

**Solution**: Change execution mode to "queued" for deployment pipelines. Ensures all commits are deployed sequentially.

## Key Takeaways

<div class="callout callout--tip">
<p class="callout__title">Cost Optimization Quick Wins</p>
<p>Right-size compute types (most builds work on SMALL), enable build caching, and set artifact lifecycle policies. These three changes can reduce CI/CD costs by 50-75%.</p>
</div>

**CodePipeline orchestrates the complete software delivery workflow**: Source → Build → Test → Deploy, automating manual steps and ensuring consistency across environments.

**CodeBuild provides consistent, isolated build environments**: Docker-based build environments eliminate "works on my machine" problems. Builds run in fresh containers every time.

**Cross-account pipelines enable secure multi-environment deployments**: Single pipeline in shared services account deploys to dev, staging, and production accounts while maintaining account isolation.

**Parallel actions reduce pipeline duration**: Run unit tests, integration tests, and security scans simultaneously instead of sequentially, cutting pipeline time by 50-70%.

**Build caching dramatically improves performance and reduces costs**: Caching node_modules or .gradle/caches reduces build time from 5 minutes to 2 minutes, saving 60% on build costs.

**Right-sizing compute types optimizes costs**: Most builds don't need BUILD_GENERAL1_LARGE. Use SMALL or MEDIUM compute types unless builds actually require more resources. Potential 75% cost savings.

**Secrets management is critical**: Use Parameter Store or Secrets Manager for database passwords, API keys, and tokens. Never hardcode secrets in buildspec or source code.

**Manual approvals prevent unauthorized production deployments**: Approval gates between staging and production ensure human review before production changes, reducing risk of bugs reaching users.

**Artifact encryption and least-privilege IAM protect sensitive code**: Encrypt artifacts with KMS, grant minimal IAM permissions to CodePipeline and CodeBuild service roles.

**Integration with AWS services simplifies deployment**: Native integration with CodeDeploy, Lambda, ECS, CloudFormation, and S3 makes AWS deployments straightforward.

**Pipeline-as-code enables version control and reproducibility**: Define pipelines in CloudFormation or CDK, track changes in source control, reproduce pipelines across environments.

**Monitoring and notifications keep teams informed**: EventBridge rules trigger Lambda functions for Slack notifications, create metrics for pipeline success rates, alert on failures.

**CodePipeline cost is predictable**: $1 per active pipeline per month makes budgeting straightforward. CodeBuild costs scale with usage but are optimizable through caching and right-sizing.
