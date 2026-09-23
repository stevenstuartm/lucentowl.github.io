---
title: "GitHub Administration and Security"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "Governing and securing a GitHub organization: teams, roles, and base permissions, repository visibility and settings, branch protection and rulesets, CODEOWNERS, Actions policies, Dependabot, code scanning, secret scanning and their licensing, vulnerability reporting, audit logs, token types, and enterprise identity."
tags: [practical, rulesets, branch-protection, codeowners, secret-scanning, supply-chain, governance]
---
{% raw %}

## Organization Structure

A GitHub organization is the primary unit of collaboration for teams and companies. Every repository belongs either to a personal account or an organization, and only organizations have centralized billing, membership management, and policy enforcement.

### Creating and Managing Organizations

Organizations are created from GitHub account settings and immediately grant the creator the Owner role. From that point, the organization becomes a governance boundary. Owners control who joins, what they can do, and which repositories they can access.

The `gh` CLI can interact with organizations directly:

```bash
# List organizations you belong to
gh org list

# View org-level settings (requires appropriate permissions)
gh api orgs/YOUR_ORG
```

### Teams and Team Hierarchy

Teams are the mechanism for granting repository access to groups of people. Rather than adding individuals to repositories one by one, teams handle permission assignments at scale. A team can be granted access to a repository with a single action, and every member of that team inherits that access.

Teams can be nested. A parent team can contain child teams, and child teams inherit the parent team's repository permissions. This hierarchy mirrors how engineering organizations are often structured: a parent "Engineering" team grants read access across repositories, while child teams like "Backend" or "Platform" hold elevated permissions for the repositories they own.

```
Organization: acme-corp
│
├── Team: Engineering (base: read)
│   │
│   ├── Team: Backend (write to backend-* repos)
│   │   ├── Alice
│   │   └── Bob
│   │
│   ├── Team: Frontend (write to frontend-* repos)
│   │   └── Carol
│   │
│   └── Team: Platform (admin on infra-* repos)
│       └── Dave
│
└── Team: Security (read to all repos)
    └── Eve

Alice's effective permissions:
├── read on all repos      (inherited from Engineering)
├── write on backend-*     (from Backend team)
└── no access to infra-*   (not in Platform team)
```

```bash
# Create a team
gh api orgs/YOUR_ORG/teams \
  --method POST \
  --field name="backend-engineers" \
  --field privacy="closed"

# Add a member to a team
gh api orgs/YOUR_ORG/teams/backend-engineers/memberships/USERNAME \
  --method PUT \
  --field role="member"
```

Teams have two privacy settings: **secret** (only members and org owners can see the team) and **closed** (anyone in the org can see who's on the team). Closed teams are generally preferable for transparency, reserving secret teams for sensitive groups like security responders.

### Member Roles

Everyone with access to an organization's repositories falls into one of three groups:

| Role | What They Can Do |
|------|-----------------|
| **Owner** | Full administrative control over the org. Can manage billing, settings, members, and all repositories. Should be limited to 2-3 people. |
| **Member** | Can create repositories (if permitted), be added to teams, and contribute to repos they have access to. The default role for employees. |
| **Outside Collaborator** | Not a member of the organization. Granted access to specific repositories only, with no visibility into other org resources. Used for contractors, partners, and open source contributors. |

Organizations can also assign narrower roles for specific jobs, such as billing manager, moderator, and security manager, which grants read access to every repository plus the ability to manage security alerts. Enterprise Cloud organizations can define custom organization roles as well.

The distinction between members and outside collaborators is significant from a security perspective. Members can see the organization's repository list and member roster. Outside collaborators see only what they're explicitly granted access to, which limits exposure when working with third parties.

### Base Permissions

Organizations set a base permission level that applies to all members for all repositories. Options are **No permission**, **Read**, **Write**, and **Admin**. It doesn't apply to outside collaborators. Setting it to "No permission" and granting access through teams keeps access explicit. A broad default like "Read" makes every new repository readable by all org members, which can suit an open internal culture but is risky when some repositories contain sensitive information.

---

## Repository Visibility

Visibility determines who can see a repository's code, issues, pull requests, and other content.

### Public

Public repositories are visible to anyone on the internet, whether or not they have a GitHub account. The code, commit history, issues, and pull requests are all readable. Any GitHub user can open pull requests or issues, though merging requires explicit permission.

Public repositories are appropriate for open source projects, public documentation, and anything designed to be shared broadly. They're also free on GitHub, regardless of organization tier.

### Private

Private repositories are only accessible to people who have been granted access, through the base permission, a team, or direct access as a collaborator. Anyone without access can't see that the repository exists.

Private repositories are the default choice for proprietary code, internal tooling, and anything containing sensitive information.

### Internal (Enterprise Only)

Internal repositories are a [GitHub Enterprise](https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility){:target="_blank" rel="noopener noreferrer"} feature, available in organizations owned by an enterprise account, that sits between public and private. They're visible to all authenticated members of the enterprise (which may span multiple organizations under one enterprise account), but not to the public. This is the appropriate choice for shared libraries and platform code that should be reachable across internal teams without being exposed externally.

### Choosing the Right Visibility

The decision typically comes down to the sensitivity of the code, who legitimately needs access, and whether public visibility creates any competitive or security risk. When uncertain, start private and open up access deliberately rather than starting public and trying to retroactively restrict it.

---

## Repository Settings

Repository settings control how contributors interact with the codebase. Getting these right reduces noise, enforces consistency, and keeps the repository history clean.

### Default Branch

The default branch is what GitHub shows when someone visits the repository and what pull requests merge into by default. Most teams use `main`. The default branch should be protected (covered in the next section).

```bash
# Set default branch
gh api repos/YOUR_ORG/YOUR_REPO \
  --method PATCH \
  --field default_branch="main"
```

### Merge Options

The repository's pull request settings decide which of the three merge buttons appear: merge commit, squash and merge, and rebase and merge. Leaving only the method the team has agreed on is how that agreement gets enforced, since a button that isn't shown can't be pressed by someone in a hurry. The same settings control the default message for squash commits (for example, the PR title and description) and whether auto-merge is allowed.

### Auto-Delete Head Branches

Enabling "Automatically delete head branches" in repository settings causes GitHub to delete the source branch as soon as a pull request is merged. This prevents branch accumulation over time and keeps the repository list manageable. Deleted branches are recoverable from the pull request if needed.

---

## Branch Protection Rules

Branch protection rules are policies applied to specific branches (or branch name patterns) that restrict what contributors can do to those branches. They're the original mechanism for enforcing code review, CI requirements, and commit quality on important branches. They're available in public repositories on every plan, and in private repositories on GitHub Pro, Team, and Enterprise.

### Configuring Protection Rules

Branch protection rules are configured in repository settings under "Branches." A rule matches branches by name or glob pattern (`main`, `release/*`, etc.), and applies to all matching branches.

```bash
# View branch protection via CLI
gh api repos/YOUR_ORG/YOUR_REPO/branches/main/protection
```

### Key Protection Options

| Setting | What it enforces |
|---|---|
| **Require a pull request before merging** | No direct pushes. Changes arrive through a PR with a minimum number of approvals, optionally including code owners, and approvals can be dismissed when new commits are pushed so nobody gets approval and then slips in changes |
| **Require status checks to pass** | Named CI checks must succeed. "Require branches to be up to date" additionally forces the PR to be tested against the latest base branch |
| **Require conversation resolution** | Every review comment thread must be resolved |
| **Require signed commits** | Every commit must carry a signature GitHub can verify |
| **Require linear history** | No merge commits, so only squash and rebase merges work |
| **Require merge queue** | PRs merge through a merge queue that tests them in combination |
| **Require deployments to succeed** | Named environments must have a successful deployment first |
| **Lock branch** | The branch becomes read-only |
| **Restrict who can push** | Only named users, teams, or apps can push, even among those with write access |
| **Allow force pushes / Allow deletions** | Both are blocked unless explicitly allowed |
| **Do not allow bypassing the above settings** | Removes the default exemption for administrators |

The last row matters more than it looks. By default, the restrictions don't apply to repository administrators, so a protected branch in a repository where half the team are admins is only protected against the other half. Enabling it means nobody can circumvent the rules under time pressure.

Required signatures interact with the merge buttons. Merge commits and squash merges created on GitHub are signed with GitHub's own key, so they satisfy the rule, but GitHub does not sign the commits a rebase merge creates, so rebase and merge doesn't work on a branch that requires signatures. A team that needs both can rebase locally, sign, and push. The signing setup itself lives in each developer's Git configuration.

### When Branch Protection Isn't Enough

Branch protection rules are repository-scoped and configured per repository. Organizations with dozens or hundreds of repositories need a consistent enforcement mechanism that doesn't rely on correctly configuring each repository individually. That's where rulesets come in.

---

## Rulesets

Rulesets are the newer, more flexible alternative to branch protection rules. They can be defined on a single repository or across an organization, target branches, tags, or pushes, and support more granular bypass controls. Repository rulesets are available on the same plans as branch protection. Organization rulesets need GitHub Team or Enterprise.

### How Rulesets Differ from Branch Protection Rules

| Feature | Branch Protection | Rulesets |
|---------|-------------------|----------|
| Scope | One repository | One repository, or many repositories in an organization |
| Multiple matching rules | Only one rule applies to a branch | All matching rulesets apply together, and the most restrictive version of each rule wins |
| Bypass control | Administrators exempt unless disabled | Named bypass list of roles, teams, and apps |
| Tag protection | No | Yes |
| Push restrictions | No | Yes, by file path, size, and extension |
| Visibility | Admins only | Anyone with read access can see the active rules |
| History | None | Rule insights showing what each ruleset allowed or blocked |

Rulesets and branch protection rules can coexist on the same branch, and they layer the same way, so migrating doesn't require switching everything at once.

### Organization-Level Rulesets

An organization ruleset can target repositories by name pattern, topic, or property, and then apply rules to branch name patterns within those repositories. This means you can enforce "all repositories tagged `production` must require 2 reviewers and passing CI on their `main` branch" without touching each repository's settings individually.

On GitHub Enterprise, rulesets also have an "Evaluate" mode, which records what the rules would have blocked without enforcing them. That supports gradual rollout. You enable a ruleset in evaluate mode, review rule insights to see what it would have stopped, then switch it to active once you're confident the rule is correct.

### Tag Rules

Rulesets support protecting tags, which branch protection rules do not, and they replaced GitHub's older standalone tag protection feature. Tag rules prevent unauthorized users from creating, updating, or deleting tags that match a pattern like `v*`. This matters for release automation. If anyone with write access can create a `v1.0.0` tag, then anyone with write access can trigger a release.

### Push Rules

Push rulesets inspect every push to the repository, whatever branch it targets, and can block it based on file paths, path length, file extensions, or file size. Examples include blocking files larger than 10 MB or rejecting any change under a path like `secrets/`. They apply to private and internal repositories and cover the repository's whole fork network, which closes the gap where a blocked file could land through a fork. They're GitHub.com's replacement for the custom server-side hooks it doesn't run.

### Bypass Lists

Rather than a binary "admins can bypass" toggle, rulesets let you name the roles, teams, and GitHub Apps allowed to bypass them, either always or only by merging a pull request. That precision lets a trusted release bot push version tags while every human still goes through review.

---

## CODEOWNERS

CODEOWNERS is a file that declares who owns specific parts of the repository. When a pull request modifies files owned by a particular person or team, GitHub automatically requests a review from that owner. Combined with branch protection that requires code owner reviews, this ensures that changes to sensitive areas of the codebase always get reviewed by someone with the appropriate context.

### File Location and Format

The file is named `CODEOWNERS` and can live in `.github/`, the repository root, or `docs/`. GitHub checks those locations in that order and uses the first one it finds, reading it from the pull request's base branch. The syntax resembles `.gitignore` patterns:

```
# Each line is a pattern followed by one or more owners

# Default owners for everything not matched later
*                   @org/platform-team

# The entire infra directory
/infra/             @platform-team

# Specific file
/config/prod.yml    @sre-team

# All YAML files
*.yml               @devops-team

# Files in nested directories (** matches any path)
**/migrations/      @database-team

# A specific individual
/src/auth/          @security-lead @org/backend-team
```

Patterns are evaluated from top to bottom, and the last matching pattern takes effect, so more specific patterns go after more general ones. The resemblance to `.gitignore` is not complete. CODEOWNERS doesn't support `!` negation or `[ ]` character ranges, and a line with invalid syntax is skipped, which GitHub flags when you view the file. Every owner needs write access to the repository.

### Team-Based Ownership

Pointing to teams rather than individuals is the better long-term approach. When `@platform-team` owns `/infra/`, the review request goes to the whole team and any member can approve. If you point to individual users, a departure or vacation blocks every PR that touches their files.

A team used as a code owner must be visible (closed, not secret) and have write access to the repository.

### CODEOWNERS and Branch Protection

CODEOWNERS becomes enforceable when branch protection enables "Require review from Code Owners." Without this setting, the CODEOWNERS file requests reviews but doesn't require them. With it enabled, a PR touching owned files cannot merge until the designated owner approves, regardless of how many other reviewers have approved.

This is a common misconfiguration: organizations set up CODEOWNERS carefully, but forget to enable the corresponding branch protection option, rendering the ownership declarations advisory rather than mandatory.

---

## Security Features and Licensing

The next three sections cover Dependabot, code scanning, and secret scanning. Their availability follows one rule. Dependabot alerts and updates are free for every repository. Code scanning and secret scanning with push protection are free for public repositories. For private and internal repositories, secret scanning is part of **GitHub Secret Protection** and code scanning is part of **GitHub Code Security**, two separately priced products that organizations on GitHub Team or Enterprise can buy. Together they replaced the single GitHub Advanced Security license that older documentation refers to.

---

## Dependabot

Dependabot is GitHub's built-in dependency management tool. It monitors a repository's dependencies for known vulnerabilities and outdated versions, then opens pull requests to update them. Understanding it as two distinct features prevents confusion: **security alerts** respond to vulnerabilities, while **version updates** proactively keep dependencies current.

### Dependency Graph

The dependency graph is the foundation. GitHub parses your manifest files (like `package.json`, `*.csproj`, `go.mod`, `Gemfile`, `requirements.txt`, etc.) and builds a graph of what your code depends on. The graph powers both Dependabot features and the [GitHub Advisory Database](https://github.com/advisories){:target="_blank" rel="noopener noreferrer"} matching.

The dependency graph is enabled by default for public repositories and configurable for private ones in repository settings under "Security & Analysis."

### Security Alerts

When a vulnerability is published in the GitHub Advisory Database that affects a dependency in your graph, GitHub raises a Dependabot alert. These alerts appear on the repository's Security tab and can trigger notifications to repository administrators. GitHub can also automatically open a pull request with a fix if one is available, a feature called **Dependabot security updates**.

Security alerts require no configuration file. Enabling them in repository or organization settings is sufficient.

### Version Updates

Version updates are opt-in and configured via a `dependabot.yml` file in `.github/`. This file tells Dependabot which package ecosystems to monitor, how frequently to check, and how to group or label the resulting pull requests.

```yaml
# .github/dependabot.yml
version: 2
updates:
  # npm packages
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    groups:
      dev-dependencies:
        dependency-type: "development"
    labels:
      - "dependencies"
    open-pull-requests-limit: 10

  # NuGet packages for .NET
  - package-ecosystem: "nuget"
    directory: "/"
    schedule:
      interval: "weekly"
    ignore:
      # Ignore major version bumps for a specific package
      - dependency-name: "SomePackage"
        update-types: ["version-update:semver-major"]

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

The `groups` configuration is particularly valuable. Without grouping, Dependabot opens one pull request per dependency, which can flood a repository with dozens of small PRs. Grouping related dependencies (like all development dependencies or all packages from the same vendor) into a single PR makes reviews manageable.

### Auto-Merge Patterns

Many teams auto-merge low-risk Dependabot updates, meaning patch and minor version bumps that pass CI. This keeps dependencies current without requiring manual review for every small update. The pattern is a GitHub Actions workflow that recognizes Dependabot pull requests, checks the update type, and turns on auto-merge, so GitHub merges the PR once required checks pass.

```yaml
# .github/workflows/auto-merge-dependabot.yml
name: Auto-merge Dependabot PRs
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    # Check the PR author, not github.actor, which changes if a person re-runs the workflow
    if: github.event.pull_request.user.login == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v3

      - name: Auto-merge patch and minor updates
        if: |
          steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
          steps.metadata.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This only waits for CI if the base branch requires status checks and the repository allows auto-merge. Without required checks, `--auto` merges immediately. Major version updates warrant human review, since they may include breaking changes that automated tests don't catch.

---

## Code Scanning

Code scanning analyzes repository code for security vulnerabilities and coding errors. GitHub's native offering is CodeQL, a semantic code analysis engine that understands program flow, not just text patterns. Third-party scanners that produce results in the SARIF format can also integrate with GitHub's code scanning infrastructure.

### CodeQL Analysis

CodeQL works by compiling your code into a queryable database, then running a suite of security queries against it. Queries can detect vulnerabilities like SQL injection, path traversal, insecure deserialization, and dozens of others, with an understanding of data flow that pattern-matching tools lack.

There are two ways to turn it on. **Default setup** is a switch in the repository's or organization's security settings. GitHub detects the languages, picks the queries, and runs the analysis on pushes, pull requests, and a weekly schedule without any workflow file in the repository, and it's the right starting point for most repositories. **Advanced setup** generates a workflow file you own and edit, for when you need custom queries, a specific build, or control over triggers:

```yaml
# .github/workflows/codeql.yml
name: CodeQL Analysis

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run weekly on a full scan
    - cron: '0 2 * * 1'

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      fail-fast: false
      matrix:
        language: ['csharp', 'javascript']

    steps:
      - name: Checkout repository
        uses: actions/checkout@v7

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          # C# and JavaScript can be analyzed without building the code
          build-mode: none
          # Optionally specify a custom query suite
          # queries: security-and-quality

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v4
        with:
          category: "/language:${{ matrix.language }}"
```

The `schedule` trigger matters. PR-only scanning catches new vulnerabilities as code is introduced, but weekly full scans catch vulnerabilities in existing code that stem from newly published advisories or newly written queries.

### Third-Party SARIF Integration

[SARIF (Static Analysis Results Interchange Format)](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning){:target="_blank" rel="noopener noreferrer"} is an open standard for static analysis results. Tools that support it, such as Semgrep, ESLint with security rules, and Snyk, can produce SARIF output that GitHub ingests and displays in the Security tab alongside CodeQL results.

```yaml
- name: Upload SARIF results
  uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: results.sarif
```

This means your existing scanner investment isn't discarded when enabling GitHub code scanning. You can aggregate results from multiple tools in one place.

### Custom Queries

CodeQL queries are written in QL, a declarative query language. Organizations can write custom queries for patterns specific to their codebase, such as calls to internal APIs that must be used in a particular way. Custom queries are stored in a repository and referenced from the workflow:

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v4
  with:
    languages: csharp
    queries: ./custom-queries/security-suite.qls
```

The [CodeQL query repository](https://github.com/github/codeql){:target="_blank" rel="noopener noreferrer"} contains the full set of built-in queries, which are also useful as a starting point for custom query development.

### Alert Triage and Dismissal

Code scanning alerts appear in the Security tab, and alerts introduced by a pull request also appear as annotations on that PR. Each alert includes the vulnerable code location and a description of the vulnerability, and Copilot Autofix can propose a code change for many alert types. Alerts can be dismissed with a reason, which is one of "false positive," "used in tests," or "won't fix." Dismissals are tracked in the audit log, creating an accountability trail.

---

## Secret Scanning

Secret scanning detects credentials, API keys, tokens, and other secrets that have been committed to a repository. Because secrets committed to version control are often retrieved by attackers even after deletion (the history still contains them), prevention at push time is more valuable than detection after the fact.

### What It Detects

GitHub maintains detection patterns for hundreds of token types from service providers, including AWS access keys, Azure credentials, Stripe keys, GitHub tokens, and Slack webhooks. When a matching pattern appears, GitHub raises an alert for the repository's administrators and security managers.

Secret scanning operates on the full commit history, not just recent commits, so enabling it on an existing repository will scan historical commits and may surface secrets that were committed years ago.

### Push Protection

Push protection is the proactive layer. When enabled, GitHub checks commits at push time and blocks pushes containing recognized secrets before they enter the repository, which makes secret scanning preventive rather than only detective. It is on by default for pushes to public repositories.

When a push is blocked, the contributor sees which secrets were detected. They can remove the secret and push a clean commit, or bypass the block by choosing a reason: it's used in tests, it's a false positive, or they'll fix it later. The bypass keeps test fixtures and example credentials from blocking work, and every bypass is recorded. Organizations that want a second pair of eyes can turn on delegated bypass, which turns a bypass into a request that a designated reviewer approves.

```
Developer                          GitHub
┌──────────────────┐               ┌──────────────────────────┐
│ 1. Commits code  │               │                          │
│    containing    │               │                          │
│    API_KEY=sk_...│               │                          │
│                  │               │                          │
│ 2. git push      │──────────────►│ 3. Scans commit for     │
│                  │               │    known secret patterns │
│                  │               │                          │
│                  │◄──────────────│ 4. PUSH BLOCKED          │
│                  │  "Secret      │    "Detected: Stripe     │
│                  │   detected"   │     API key on line 42"  │
│                  │               │                          │
│ 5a. Remove secret│               │                          │
│     and push     │──────────────►│ 6. Push accepted         │
│     clean    OR  │               │                          │
│ 5b. Bypass with  │──────────────►│ 6. Push accepted         │
│     stated reason│               │    (bypass logged to     │
│                  │               │     audit trail)         │
└──────────────────┘               └──────────────────────────┘
```

Push protection can be enabled at the organization level, applying it to all repositories without requiring per-repository configuration.

### Custom Patterns

Organizations often have internal token formats that GitHub's default patterns don't recognize, such as internal service account keys following a company-specific format. Custom patterns let you define your own regular expressions for additional detection:

```
# Example pattern: internal API key format
# Pattern: MYCO_KEY_[a-zA-Z0-9]{32}
```

Custom patterns are defined in repository, organization, or enterprise settings under secret scanning. They scan existing history once added, and each pattern can be enabled for push protection separately.

### Partner Programs

When a secret for a participating service provider, like AWS, Google, or Stripe, appears in a public repository, GitHub notifies the provider directly through the [GitHub Secret Scanning Partner Program](https://docs.github.com/en/code-security/secret-scanning/secret-scanning-partner-program){:target="_blank" rel="noopener noreferrer"}. The provider can then revoke the exposed credential, often within minutes, which shrinks the window in which an attacker scraping public commits can use it.

---

## Security Policies

A security policy establishes how vulnerability reports are received and handled. Without a stated policy, security researchers discovering vulnerabilities in your code have no clear channel to report them, which often leads to public disclosure before you've had a chance to fix the issue.

### SECURITY.md

A `SECURITY.md` file in the repository root (or `.github/`) is recognized by GitHub and linked from the repository's Security tab. The file should describe the supported versions of the project, the process for reporting vulnerabilities, and the response timeline the team commits to.

A minimal SECURITY.md:

```markdown
## Security Policy

### Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

### Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Email security@yourcompany.com with details. We will acknowledge your report
within 48 hours and aim to release a fix within 30 days for critical issues.
```

### Private Vulnerability Reporting

For public repositories, GitHub supports a structured private vulnerability reporting flow. When enabled, a "Report a vulnerability" button appears on the repository's Security tab, and researchers can submit a report that only the repository's maintainers and security managers can see. Reports are tracked in GitHub rather than an inbox, and they turn directly into a draft security advisory where the fix can be discussed privately.

Private vulnerability reporting is enabled per repository in security settings, and organizations can enable it for all their public repositories at once.

### Security Advisories

Once a vulnerability is confirmed and a fix is ready, a repository security advisory provides a structured format for publishing the disclosure. Advisories list affected versions, credit the reporter, and can carry a CVE identifier, which GitHub can assign directly because it is a CVE numbering authority. Published advisories for packages in supported ecosystems feed the GitHub Advisory Database, which is what triggers Dependabot alerts for everyone who depends on the package.

---

## Organization Actions Policies

GitHub Actions runs code with access to secrets and write tokens, so the organization's Actions settings are a security control in their own right. Each can be set at the enterprise, organization, or repository level, and a lower level can only be as permissive as the level above it allows.

| Setting | What it controls |
|---|---|
| **Allowed actions and reusable workflows** | Whether workflows can use any action, only GitHub's and verified creators', or only an explicit allow list, and whether specific actions are blocked outright |
| **Require full-length commit SHA pinning** | Fails any workflow that references an action by tag or branch instead of a full commit SHA |
| **Default `GITHUB_TOKEN` permissions** | Whether the token starts read-only (restricted) or read-write (permissive), and whether workflows may approve pull requests |
| **Fork pull request workflows** | Whether workflows from forks need maintainer approval before they run, and, for private repositories, whether fork workflows get secrets or write tokens at all |
| **Runner groups** | Which repositories can send jobs to which self-hosted runners |

A reasonable baseline for most organizations is a restricted token default, SHA pinning required, an allow list for third-party actions, and approval required for workflows from first-time contributors.

---

## Audit Logs

The organization audit log records significant actions taken on resources within the organization, such as who created or deleted a repository, who changed a branch protection rule, and who modified a team membership. It is the authoritative record of administrative activity.

### What's Tracked

The audit log captures actions across several categories:

- **Repository actions**: Creation, deletion, visibility changes, fork settings, archiving
- **Team and member actions**: Invitations, role changes, team membership modifications
- **Authentication events**: SSO sessions, personal access token usage, OAuth app authorizations
- **Security and policy changes**: Branch protection changes, secret scanning alerts, code scanning dismissals
- **Billing and organization settings**: Payment method changes, feature toggles, organization setting modifications
- **GitHub Actions**: Changes to Actions settings, secret creation and updates, runner registration

### Searching and Exporting

The audit log is searchable in the GitHub UI at `github.com/organizations/YOUR_ORG/settings/audit-log`, and can be queried using a filter syntax:

```
# Find repository deletions since a given date
action:repo.destroy created:>2026-08-01

# Find actions by a specific user
actor:suspicious-user

# Find who exported the audit log itself
action:org.audit_log_export
```

Any organization owner can search the log in the UI and export it as JSON or CSV. The REST API for the audit log and audit log streaming, which pushes events continuously to a service like Azure Event Hubs, Amazon S3, or Splunk, are GitHub Enterprise Cloud features.

```bash
# Query the audit log via API (Enterprise Cloud)
gh api "/orgs/YOUR_ORG/audit-log?phrase=action:repo.destroy&per_page=100"
```

### Compliance Use Cases

Audit logs satisfy several common compliance requirements. SOC 2 Type II audits frequently ask for evidence that administrative access is logged and that changes to security controls are tracked. The audit log provides both, as long as the organization keeps the data for the required period. GitHub retains audit log events for 180 days, and Git events such as clones and pushes for only seven days, so longer retention means streaming to external storage.

Organizations with strict compliance requirements should enable audit log streaming from the start rather than discovering the 180-day limitation when an auditor asks for 12 months of data.

---

## Authentication and Token Types

How humans and automated systems authenticate to GitHub matters for both security and operational reliability. GitHub provides several authentication mechanisms, each with different scope and risk profiles.

### Personal Access Tokens: Classic vs. Fine-Grained

**Classic personal access tokens (PATs)** are the legacy mechanism. They have coarse permission scopes, like `repo`, which grants full access to every repository the owner can reach across every organization they belong to. A leaked classic PAT with `repo` scope gives the attacker access to everything the token owner can access.

**Fine-grained personal access tokens** are the successor. Each one is limited to a single user or organization and, within it, to selected repositories. It carries granular permissions like read-only pull requests or read and write issues, and an organization can require approval before one is used against its resources.

| Feature | Classic PAT | Fine-Grained PAT |
|---------|-------------|-----------------|
| Repository scope | Everything the user can access | Selected repositories of one owner |
| Permission granularity | Broad scopes (e.g., `repo`) | Per-resource (issues, PRs, contents, etc.) |
| Expiration | Optional | Optional, subject to the organization's maximum lifetime policy |
| Org approval required | No | Can be required |

Fine-grained tokens still have gaps. They can't be used for some things classic tokens can, such as contributing to public repositories where you aren't a member, working as an outside collaborator, or accessing packages, so some automation still needs a classic token. Organizations can restrict classic PATs from accessing their resources and set a maximum lifetime for fine-grained ones.

### OAuth Apps

OAuth apps allow third-party services to act on behalf of a GitHub user, with the user's authorization. The authorization flow redirects the user to GitHub, the user approves a set of requested permissions, and the app receives an OAuth token. OAuth tokens inherit the user's permissions, not a fixed set, which means an OAuth app with `repo` scope can access all the repositories the authorizing user can access.

OAuth apps are appropriate for user-facing integrations where the app needs to act in the context of the logged-in user. The risk is that users often approve OAuth app access without carefully considering what they're granting.

Organizations can restrict which OAuth apps are allowed to access organization resources, requiring owner approval before an OAuth app can read private repositories. This is configurable in organization settings under "Third-party access."

### GitHub Apps

GitHub Apps are the preferred mechanism for automation and integrations. Unlike OAuth apps, GitHub Apps have their own identity (not tied to a user), use short-lived tokens (1-hour installation tokens), can be installed at the repository or organization level with precise permission grants, and can subscribe to specific webhook events.

A GitHub App that needs to comment on pull requests can be granted only pull request write permission, nothing else. If the app's credentials are compromised, the blast radius is limited to what the installation was granted, not the full scope of an OAuth token or PAT.

```bash
# Generate an installation token for a GitHub App (typically done server-side).
# Conceptually:
# 1. Sign a JWT with the app's private key
# 2. Exchange the JWT for an installation token via the API
# 3. Use the installation token (valid for 1 hour) for API calls
gh api /app/installations --header "Authorization: Bearer <JWT>"
```

Inside GitHub Actions, the `actions/create-github-app-token` action performs the exchange from the app ID and a private key stored as a secret, which is the usual replacement for a PAT when a workflow needs more than the built-in `GITHUB_TOKEN` can do.

The operational overhead of GitHub Apps is justified by the improved security model. Managing a private key and refreshing short-lived tokens is more work than pasting a PAT, but the blast radius of a compromised credential is dramatically smaller. Any non-trivial automation should use a GitHub App over a PAT.

### When to Use Each

| Use Case | Recommended Mechanism |
|----------|-----------------------|
| Personal development tooling (local scripts) | Fine-grained PAT |
| CI/CD pipeline | GitHub App (preferred) or fine-grained PAT |
| Third-party integration acting as a user | OAuth App |
| Automated bot or service | GitHub App |
| Organization-wide automation | GitHub App |
| Quick one-off API call | Fine-grained PAT with limited scope |

---

## GitHub Enterprise Features

GitHub Enterprise Cloud and GitHub Enterprise Server add capabilities designed for organizations that need centralized identity, tighter security controls, and compliance guarantees that the Free and Team plans don't provide.

### SAML Single Sign-On

SAML SSO, an Enterprise Cloud feature configured per organization or for a whole enterprise, connects GitHub authentication to an identity provider (IdP) like Microsoft Entra ID, Okta, or Ping Identity. When SAML SSO is enabled, members must authenticate through the IdP to access organization resources. When an employee is disabled in the IdP, they can no longer start a new SAML session, so they lose access to the organization's resources even though their personal GitHub account still exists. Removing their organization membership outright still needs a manual step or SCIM, covered below.

SAML SSO also means that PATs and SSH keys used to access organization resources must be authorized to work with the SAML session, adding another layer of control over which tokens can reach organization repositories.

```bash
# List the tokens and SSH keys members have authorized for SAML SSO
gh api orgs/YOUR_ORG/credential-authorizations
```

### Enterprise Managed Users

[Enterprise Managed Users (EMU)](https://docs.github.com/en/enterprise-cloud@latest/admin/identity-and-access-management/understanding-iam-for-enterprises/about-enterprise-managed-users){:target="_blank" rel="noopener noreferrer"} is a stricter identity model where user accounts are fully provisioned and controlled by the enterprise, rather than being personal GitHub.com accounts associated with an organization. In an EMU setup, every user account within the enterprise is created and managed through the IdP via SCIM provisioning. Users cannot use these accounts for personal open-source activity or join external organizations.

EMU trades flexibility for control. It's appropriate for enterprises with strict compliance requirements who need complete account lifecycle management and want to ensure that departing employees have no residual access. It's not appropriate for organizations that hire open-source contributors who maintain their GitHub identity across multiple organizations.

### IP Allow Lists

Enterprise and organization settings support IP allow lists, which restrict GitHub.com access to specific IP ranges. Connections from outside the allowed ranges receive an authorization error even with valid credentials. This is useful for organizations that want to ensure GitHub access only occurs from corporate networks or VPN, preventing personal device access to sensitive repositories.

IP allow lists work alongside SAML SSO rather than replacing it. SAML SSO controls who can access, and IP allow lists control from where. A GitHub-hosted Actions runner doesn't come from your corporate range, so an allow list also affects workflows unless the runners' addresses are allowed.

### SCIM Provisioning

System for Cross-domain Identity Management (SCIM) automates user and group provisioning from the IdP to GitHub. When a new employee is added to the right group in the IdP, SCIM provisions their GitHub membership automatically. When they leave and are deprovisioned, SCIM removes them. This eliminates the manual work and lag of managing GitHub membership separately from the HR or IdP workflow.

SCIM is essential at scale. Organizations with hundreds of employees cannot reliably manage GitHub membership manually without SCIM to keep it synchronized with the authoritative identity source.
{% endraw %}
