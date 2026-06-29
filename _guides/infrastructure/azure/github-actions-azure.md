---
title: "GitHub Actions for Azure Deployments"
layout: guide
category: Azure
subcategory: Developer Tools & CI/CD
description: "Using GitHub Actions to deploy Azure infrastructure and applications including OIDC authentication, reusable workflows, environment protection rules, and deployment patterns for production-grade CI/CD."
tags: [infrastructure, azure, cicd, devops, automation, deployment, practical]
---

## What Is GitHub Actions for Azure

[GitHub Actions](https://docs.github.com/en/actions){:target="_blank" rel="noopener noreferrer"} is GitHub's integrated automation platform. When code is pushed, pull requests are opened, or scheduled events occur, GitHub Actions workflows execute jobs. They automate building, testing, and deploying your application. The [GitHub Actions for Azure](https://github.com/Azure/actions){:target="_blank" rel="noopener noreferrer"} ecosystem provides hundreds of pre-built actions for interacting with Azure resources, making it straightforward to deploy infrastructure and applications directly from your GitHub repository.

Since Microsoft owns GitHub, GitHub Actions is a first-party integration for Azure, meaning the actions are maintained alongside the Azure platform itself and align with Microsoft's recommended practices.

### What Problems GitHub Actions for Azure Solves

**Without GitHub Actions:**
- Manual deployments to Azure through the portal or scripts stored outside the repository
- No audit trail of who deployed what and when
- Long-lived service principal credentials sitting in scripts or configuration files
- Deployment logic scattered across local machines or separate tools
- No standardized deployment process across teams
- Inconsistent infrastructure and application configurations

**With GitHub Actions for Azure:**
- Infrastructure and application deployments fully automated and defined in version control
- Complete audit trail through GitHub's workflow logs and deployment history
- OIDC workload identity federation eliminates long-lived credentials from your codebase
- Deployment logic lives alongside the code being deployed
- Environment protection rules enforce approvals and restrictions before production deployments
- Reusable workflows create consistent, composable CI/CD patterns across the organization

### Why GitHub Actions for Azure Deployments

**First-party integration.** Microsoft maintains GitHub Actions for Azure, ensuring tight alignment with Azure's evolution. The platform is designed with Azure-first patterns in mind.

**Marketplace ecosystem.** Hundreds of community-contributed and Microsoft-maintained actions cover everything from Bicep deployment to App Service configuration to Azure Key Vault secret retrieval. This rich ecosystem eliminates the need to build custom scripts.

**Existing GitHub integration.** Most organizations already use GitHub for source control. Adding CI/CD to the same platform reduces context switching and keeps deployment logic close to the code.

**OIDC federation.** GitHub Actions supports OpenID Connect (OIDC) workload identity federation, eliminating the need to store long-lived credentials. Your workflows authenticate to Azure using short-lived tokens, reducing the blast radius of compromised credentials.

**Reusable workflows.** Define a deployment workflow once and call it from many other workflows. This DRY (Don't Repeat Yourself) approach scales to hundreds of repositories without duplicating pipeline logic.

**Environment protection rules.** Require manual approvals or automatic delays before deployments to production. Control which branches can deploy to which environments, enforcing governance without slowing development.

### GitHub Actions vs Azure DevOps Pipelines vs AWS CodePipeline

Architects choosing between GitHub Actions, Azure DevOps Pipelines, and AWS CodePipeline should understand the trade-offs. GitHub Actions is best when your source code lives in GitHub and you want tight integration with your repository. Azure DevOps Pipelines is better when you need a unified platform spanning source control, work tracking, and deployment. AWS CodePipeline is the natural choice for AWS-centric organizations, though it requires more configuration than GitHub Actions for Azure.

---

## Core Concepts

### Workflows, Jobs, and Steps

A workflow is an automated process defined in a YAML file that lives in your repository under `.github/workflows/`. The workflow responds to repository events (code push, pull request, manual trigger, scheduled time) and orchestrates what happens next.

**Structure of a workflow:**
- **Events:** What triggers the workflow (push to main branch, pull request opened, scheduled daily at 9 AM, manual dispatch)
- **Jobs:** Named units of work that run on runners (build job, test job, deploy job)
- **Steps:** Individual commands or actions within a job (checkout code, run linter, deploy to Azure)

A job can run sequentially or in parallel with other jobs. A step is a single action or shell command.

### Runners

A runner is a server that executes your workflow. GitHub provides hosted runners (Windows, Ubuntu, macOS) that are maintained and automatically scaled by GitHub. Self-hosted runners let you use your own infrastructure.

**GitHub-hosted runners:** Simplest option for most teams. They are ephemeral (spun up fresh for each job), pre-installed with common development tools, and automatically patched. The trade-off is that they start with a small footprint and you pay for usage time.

**Self-hosted runners:** Use your own VMs or Kubernetes clusters as runners. Advantages include persistent state (faster for repeated builds), private network connectivity, and predictable performance. Disadvantages include operational overhead and the need to manage security and patching.

Most Azure deployments use GitHub-hosted runners, which can authenticate to Azure using OIDC or stored credentials.

### Actions

An action is a reusable unit of code that performs a specific task. Actions are published to the [GitHub Marketplace](https://github.com/marketplace){:target="_blank" rel="noopener noreferrer"} and can be created by Microsoft, community members, or your organization.

Examples of Azure-related actions:
- [Azure Login](https://github.com/Azure/login){:target="_blank" rel="noopener noreferrer"}: Authenticate to Azure using service principal or OIDC
- [Azure CLI](https://github.com/Azure/CLI){:target="_blank" rel="noopener noreferrer"}: Run Azure CLI commands
- [Deploy to Azure App Service](https://github.com/Azure/webapps-deploy){:target="_blank" rel="noopener noreferrer"}: Deploy code to App Service
- [Bicep Build and Validate](https://github.com/Azure/bicep-action){:target="_blank" rel="noopener noreferrer"}: Build and validate Bicep templates

Actions can be written in JavaScript, Docker, or as a composite action (a workflow calling other actions).

### Secrets and Variables

Secrets are encrypted values stored in your repository or organization that workflows can access. They are not logged or displayed in workflow output, making them safe for API keys, passwords, and credentials.

Variables are unencrypted values used to configure workflows. Use variables for non-sensitive configuration like deployment regions or environment names.

**Scope levels:**
- **Repository secrets:** Available only in a specific repository
- **Organization secrets:** Shared across all repositories in an organization
- **Environment secrets:** Scoped to a specific environment (development, staging, production), available only in workflows deploying to that environment

Best practice: Store Azure credentials (if not using OIDC) as organization secrets so they can be rotated centrally.

---

## Azure Authentication Patterns

### OIDC Federation (Recommended)

OIDC workload identity federation is the modern, secure approach. Your workflow obtains a short-lived OIDC token from GitHub and exchanges it for an Azure access token without ever storing long-lived credentials.

**How OIDC federation works:**

1. Create an Entra ID application registration for your GitHub Actions workflows
2. Configure federated credentials in the app registration, specifying which GitHub repositories and workflows can authenticate
3. In your workflow, use the Azure Login action to exchange GitHub's OIDC token for an Azure access token
4. Subsequent Azure commands (Azure CLI, PowerShell) use this token automatically

**Benefits:**
- No long-lived credentials stored in GitHub secrets
- Token lifetime is limited to the duration of the workflow (typically minutes)
- Token is scoped to specific Azure roles and subscriptions
- Compromised tokens cannot be reused after the workflow ends
- Federated credentials are specified in Entra ID, giving you fine-grained control over which workflows can authenticate

**Setup steps (conceptual):**
1. Create an Entra ID application and note its client ID and tenant ID
2. Add federated credentials to the app registration specifying your GitHub repository and workflow name
3. Assign RBAC roles to the app (Contributor on a subscription or resource group)
4. In your workflow, call Azure Login with your Entra ID app information
5. Azure Login automatically handles token exchange

**Example authentication in a workflow:**

The workflow uses `azure/login@v1` action, providing tenant ID, client ID, and subscription ID. The action exchanges the GitHub OIDC token for an Azure access token without requiring any stored credentials.

### Service Principal with Client Secret (Legacy)

Before OIDC federation, the standard approach was storing a service principal's client secret in GitHub secrets. This is still supported but less secure than OIDC.

**How it works:**
1. Create a service principal in Entra ID
2. Generate a client secret
3. Store the secret as a GitHub repository or organization secret
4. In your workflow, pass the secret to Azure Login, which uses it to authenticate

**Trade-offs:**
- Simpler setup than OIDC
- Long-lived credentials exist in your environment
- If compromised, the credential can be used until it expires or is rotated
- Requires regular credential rotation

**Recommendation:** Use service principal authentication only for legacy systems or when OIDC federation cannot be configured.

### Managed Identity with Self-Hosted Runners

If your runners are self-hosted on Azure VMs or in AKS, you can assign a managed identity to the runner and avoid storing credentials entirely.

**How it works:**
1. Deploy a self-hosted runner on an Azure VM or AKS pod
2. Assign a managed identity to the VM or pod
3. In your workflow, call Azure Login without credentials; the runner automatically uses the managed identity
4. The managed identity's RBAC roles determine what the workflow can do in Azure

**Trade-offs:**
- Requires infrastructure investment for self-hosted runners
- No credentials to manage or rotate
- Best for high-volume CI/CD pipelines where GitHub-hosted runner costs are prohibitive

---

## Reusable Workflows

Reusable workflows enable you to define a workflow once and invoke it from many other workflows, reducing duplication and ensuring consistency.

### How Reusable Workflows Work

A reusable workflow is stored in your repository (or a shared repository) and explicitly marked as reusable. Other workflows call it using the `uses` keyword, passing inputs and receiving outputs.

**Example use cases:**
- A workflow that deploys infrastructure (Bicep or Terraform) with consistent validation and approval steps
- A workflow that builds and pushes a Docker image to a registry
- A workflow that runs tests, security scans, and code quality checks
- A workflow that manages secrets or configurations

**Advantages:**
- Single source of truth for deployment logic
- Updates to the shared workflow automatically apply to all callers
- Reduces YAML duplication across repositories
- Enforces standardized processes across teams

**Limitations:**
- Reusable workflows must be in a GitHub repository (not external Git hosts)
- Complex workflows with many conditional paths are harder to compose
- Secrets passed to reusable workflows must be explicitly declared

---

## Environment Protection Rules

GitHub provides environment protection rules to enforce governance before deployments reach production.

### Required Reviewers

You can require one or more people to manually approve a deployment before it proceeds. Reviewers receive a notification and must approve in the GitHub UI.

**Use case:** Require a senior engineer to approve all production deployments.

### Wait Timer

A deployment to an environment can be delayed automatically. For example, wait 24 hours before deploying a change to production, allowing time for users to discover issues in staging.

**Use case:** Automatically delay production deployments by a few hours to catch issues found by early adopters.

### Deployment Branch Restrictions

Restrict deployments to an environment to specific branches. For example, only the `main` branch can deploy to production.

**Use case:** Prevent developers from deploying feature branches directly to production.

### Combining Rules

Rules are evaluated in order. A workflow requesting deployment to a protected environment waits for reviewers to approve, then waits for the timer, then checks branch restrictions. All must pass before the workflow continues.

---

## Deployment Patterns

### Infrastructure Deployment Pattern

Infrastructure deployments follow a consistent pattern: validate, plan, review, apply.

**Steps:**
1. Checkout code
2. Authenticate to Azure using OIDC federation
3. Validate Bicep templates (syntax, linting)
4. Run `what-if` to preview changes before applying
5. (In production) Wait for approvals
6. Apply the infrastructure changes using deployment action

**Key decisions:**
- Validate in all environments (catch errors early)
- Use `what-if` to show what will change before applying
- Store Bicep in the same repository as application code or in a separate infrastructure repository
- Use parameter files to manage environment-specific configurations

### Application Deployment Pattern

Application deployment typically involves building a container image, storing it in a registry, and updating the deployment to use the new image.

**Steps:**
1. Build application code
2. Run tests
3. Build container image (Docker)
4. Push image to Azure Container Registry
5. Update App Service, AKS, or Container Apps to deploy the new image
6. Run smoke tests or health checks to validate the deployment

**Key decisions:**
- Build image once, deploy to multiple environments (tag by Git commit hash)
- Use Azure Container Registry for private images
- Store credentials for the registry in GitHub secrets or use OIDC with Container Registry
- Include deployment health checks to detect failed deployments quickly

### Multi-Environment Promotion Pattern

Progressive deployment from development to staging to production reduces the blast radius of issues.

**Pattern:**
1. Merge to `main` branch triggers deployment to development environment
2. Manual approval or time-based delay before staging deployment
3. Automated tests in staging validate readiness for production
4. Another approval or delay before production deployment
5. Canary or blue-green deployment in production minimizes user impact

**Implementation:**
- Use GitHub environments (development, staging, production) with protection rules
- Different RBAC roles for different environments (developers can deploy to development, only leads to production)
- Reusable workflows handle the actual deployment logic; main workflow orchestrates the sequence

---

## Architecture Patterns

### Mono-Repo Workflows with Path Filters

When a single repository contains multiple independent applications or infrastructure components, use path filters to run jobs only when relevant files change.

**Example:**
- Infrastructure team changes Bicep in `./infrastructure/` directory
- Application team changes code in `./apps/myapp/` directory
- Use path filters so infrastructure changes don't trigger application builds

**Implementation:**
- Workflows listen to push events with `paths` filter
- Separate workflows for infrastructure, app1, app2, etc.
- Reduces unnecessary CI/CD executions

### Reusable Workflow Libraries

Create a dedicated repository containing reusable workflows for common tasks (deploy infrastructure, build application, run tests).

**Structure:**
- Repository named `org/workflow-library` or similar
- Reusable workflows in `.github/workflows/` directory
- Clear input/output contracts for each workflow
- Documentation explaining parameters and expectations

**Benefits:**
- Centralized governance over CI/CD practices
- Single place to update deployment logic
- Teams reference the shared workflows by name and version

### Matrix Strategies

Use matrix strategies to run jobs across multiple configurations (environments, regions, Node versions) without duplicating workflow code.

**Example:**
Deploy an application to multiple Azure regions (east, west, central) by defining a matrix of region values. The workflow runs once per region, and regional configuration is substituted automatically.

**Benefits:**
- Write deployment logic once
- Deploy to many environments in parallel
- Easy to add or remove environments (just update the matrix)

### Workflow Composition

Complex deployments can be orchestrated by having a main workflow call multiple reusable workflows in sequence.

**Example:**
Main workflow orchestrates: validate infrastructure, deploy infrastructure, build application, deploy application, run integration tests.

**Benefits:**
- Each reusable workflow has a single responsibility
- Main workflow defines the orchestration and dependencies
- Easy to reorder steps or skip steps conditionally

---

## Security Considerations

### OIDC vs Long-Lived Secrets

OIDC federation is more secure than long-lived credentials because tokens are short-lived, scoped, and cannot be reused. If a token is compromised, its usefulness is limited to the remaining lifetime of the workflow.

Long-lived secrets (service principal credentials) remain valid until explicitly rotated. Compromise of a long-lived secret is a serious incident requiring immediate rotation.

**Recommendation:** Always use OIDC federation for new deployments. Migrate existing deployments from long-lived credentials to OIDC.

### Environment-Scoped Secrets

Store secrets at the environment level (development, staging, production) rather than repository level. This allows different credentials for different environments.

**Example:**
- Development environment secret: credentials for a development subscription
- Production environment secret: credentials for the production subscription
- A rogue workflow cannot access production credentials unless it explicitly requests the production environment

### Branch Protection and Deployment Branches

Restrict deployments to production to specific branches (usually `main`). This prevents merging untested code directly to production.

**Implementation:**
- GitHub environment setting restricts deployments to the production environment to `main` only
- Feature branches cannot deploy to production
- Developers must merge to `main` through a pull request, triggering tests

### Third-Party Action Pinning

GitHub Actions from the marketplace can be compromised or inadvertently changed. Pin actions to specific versions using SHA references instead of tags.

**Secure pattern:**
- Reference action by SHA: `azure/login@a82c7c26c1e642070c3b3265346140dd2f17b08a`
- Not by tag: `azure/login@v1` (tag can be reassigned)

**Trade-off:**
- SHA references are less readable but more secure
- Tags are easy to read but can change

**Balanced approach:**
- Use SHA references for critical actions (login, deployment)
- Use semantic tags (v1, v2) for less critical actions (linters, formatters)

### Self-Hosted Runner Security

Self-hosted runners have elevated privileges because they execute arbitrary code from workflows. Secure them by:
- Deploying on isolated networks (not directly reachable from the internet)
- Using ephemeral runners (spin up fresh for each job, tear down after)
- Applying strict RBAC to the runner's Azure managed identity
- Disabling public workflow runs (prevent outside contributors from triggering self-hosted runners)

---

## GitHub Actions vs Azure DevOps Pipelines

| Concept | Azure DevOps Pipelines | GitHub Actions |
|---------|------------------------|-----------------|
| **Pipeline definition** | YAML (`azure-pipelines.yml`) | YAML (`.github/workflows/*.yml`) |
| **Triggered by** | Git push, pull request, scheduled, manual | Git push, pull request, scheduled, manual, webhook |
| **Source control integration** | Native to Azure DevOps Repos, can integrate GitHub | Native to GitHub, tightly integrated |
| **Hosted agents/runners** | Azure Pipelines agents | GitHub-hosted runners |
| **Self-hosted agents** | Supported, mature ecosystem | Supported, growing ecosystem |
| **Environment protection** | Release gates, approvals, checks | Environment protection rules, required reviewers |
| **Secrets management** | Pipeline libraries, variable groups | Repository/organization secrets, environment secrets |
| **Reusable workflows** | Pipeline templates | Reusable workflows |
| **Marketplace/actions** | Large task library (extensions) | Massive action marketplace |
| **OIDC support** | Yes, but added later | Native, designed in from the start |
| **Cost model** | Free tier (1800 minutes/month), then per-minute | Free tier (2000 minutes/month for private repos) |
| **Best for** | Teams using Azure DevOps for work tracking, source control, and CI/CD | Teams using GitHub for source control wanting integrated CI/CD |

---

## AWS CodePipeline Comparison

| Concept | AWS CodePipeline/CodeBuild | GitHub Actions for Azure |
|---------|---------------------------|-------------------------|
| **Pipeline definition** | AWS Console or CloudFormation | YAML in `.github/workflows/` |
| **Triggered by** | CodeCommit, S3, GitHub, manual, CloudWatch events | GitHub events, scheduled, manual, webhooks |
| **Build compute** | CodeBuild (AWS managed), EC2 (self-managed) | GitHub-hosted runners, self-hosted runners |
| **Source integration** | Native to CodeCommit, can integrate CodePipeline + GitHub | Native to GitHub |
| **Authentication** | IAM roles, assumed by CodeBuild | OIDC federation, service principals, managed identity |
| **Secrets** | Secrets Manager, Parameter Store | Repository/organization secrets, environment secrets |
| **Reusable templates** | CloudFormation templates | Reusable workflows |
| **Marketplace** | AWS CodePipeline plugins, third-party integrations | Massive GitHub Actions marketplace |
| **Multi-cloud** | AWS-focused, integration with other services | Cloud-agnostic (GitHub works with AWS, Azure, Google Cloud, etc.) |
| **Cost** | Pay per pipeline execution + CodeBuild minutes | Free tier (2000 minutes/month for private repos) |
| **Best for** | AWS workloads, organizations standardized on AWS, teams wanting tight CodeCommit integration | GitHub-centric organizations, multi-cloud deployments, open source projects |

---

## Common Pitfalls

### Pitfall 1: Storing Credentials Instead of Using OIDC

**Problem:** Creating a service principal, generating a long-lived credential, and storing it in GitHub secrets instead of using OIDC federation.

**Result:** Credentials live permanently in your repository, requiring rotation policies and exposing risk if compromised. Credentials appear in logs if accidentally printed.

**Solution:** Use OIDC federation from the start. It requires upfront setup (creating Entra ID app, adding federated credentials) but eliminates credential management entirely.

---

### Pitfall 2: No Approval Gates for Production

**Problem:** Deploying to production automatically whenever code reaches `main` without any manual review.

**Result:** Bugs or mistakes go to production immediately, affecting users before they are caught. Deployment failures are not reviewed before being applied.

**Solution:** Use environment protection rules to require approvals before production deployment. Approval can be granted or denied in the GitHub UI, creating an audit trail.

---

### Pitfall 3: Insufficient Validation Before Deployment

**Problem:** Deploying infrastructure directly without validating Bicep syntax or previewing changes with what-if.

**Result:** Invalid templates fail mid-deployment, requiring rollback. Users experience outages due to preventable errors.

**Solution:** Add validation steps to all infrastructure deployments. Run linters on templates, validate syntax, and use what-if to preview changes before applying. Treat infrastructure code the same as application code.

---

### Pitfall 4: Reusing Credentials Across Environments

**Problem:** Using the same service principal or OIDC app registration for development, staging, and production deployments.

**Result:** If a development workflow is compromised, production is also compromised. No isolation between environments.

**Solution:** Use separate service principals or OIDC app registrations for each environment. Use environment-scoped secrets in GitHub so development workflows cannot access production credentials.

---

### Pitfall 5: Ignoring Workflow Logs and Audit Trails

**Problem:** Not reviewing workflow logs or using workflows as a deployment history source.

**Result:** It is hard to answer "who deployed what and when?" Troubleshooting failed deployments requires manual investigation.

**Solution:** Review workflow logs regularly. Use GitHub's deployment history to understand which code versions are deployed to which environments. Set up notifications for failed workflows.

---

### Pitfall 6: Complex Reusable Workflows That Are Hard to Troubleshoot

**Problem:** Creating reusable workflows with deeply nested conditionals, matrix variables, and complex input parameters.

**Result:** Workflows become hard to understand and debug. Errors in shared workflows affect all calling workflows.

**Solution:** Keep reusable workflows focused on a single responsibility. Document inputs and outputs clearly. Test reusable workflows in a dedicated repository before promoting to shared libraries. Use workflow logging and debug flags to troubleshoot failures.

---

## Key Takeaways

1. **GitHub Actions is deeply integrated with GitHub repositories, making it the natural choice for organizations using GitHub for source control.** Deployment logic lives alongside code, and triggers respond to repository events like push and pull request.

2. **OIDC federation eliminates long-lived credentials from your CI/CD pipeline.** Workflows obtain short-lived tokens that cannot be reused after the workflow ends, reducing the blast radius of compromise.

3. **Environment protection rules enforce governance without manual process overhead.** Required reviewers, wait timers, and deployment branch restrictions ensure code reaches production only through validated paths.

4. **Reusable workflows eliminate CI/CD duplication at scale.** Define deployment logic once in a shared workflow and call it from hundreds of repositories. Centralized updates apply to all consumers.

5. **Separate credentials and RBAC roles for each environment prevent blast radius from a compromised workflow.** Development workflows cannot access production credentials, and each environment has its own service principal or OIDC app registration.

6. **Infrastructure deployment patterns follow a consistent flow: validate, preview (what-if), review, apply.** Treat Bicep and Terraform code as you would application code, with linting and testing before applying changes.

7. **Application deployments benefit from progressive promotion: dev to staging to production with automated tests and approvals at each stage.** Reduce the risk of deploying untested changes to production.

8. **Self-hosted runners are useful for specialized workloads requiring persistent state, private network access, or high-volume builds.** GitHub-hosted runners are simpler and more secure for typical deployments.

9. **GitHub Actions is cloud-agnostic and works equally well for Azure, AWS, Google Cloud, or hybrid deployments.** This makes it a good choice for multi-cloud organizations.

10. **Workflow logs and deployment history provide complete audit trails.** Use these to understand who deployed what, troubleshoot failed deployments, and validate compliance with change management policies.
