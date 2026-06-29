---
title: "GitHub Administration and Security"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "Organization management, repository governance, branch protection, Dependabot, code scanning, secret scanning, and security best practices for GitHub."
tags: [github, security, governance, administration, practical, developer-tools]
---

## Table of Contents

- [Organization Structure](#organization-structure)
- [Repository Visibility](#repository-visibility)
- [Repository Settings](#repository-settings)
- [Branch Protection Rules](#branch-protection-rules)
- [Rulesets](#rulesets)
- [CODEOWNERS](#codeowners)
- [Dependabot](#dependabot)
- [Code Scanning](#code-scanning)
- [Secret Scanning](#secret-scanning)
- [Security Policies](#security-policies)
- [Audit Logs](#audit-logs)
- [Authentication and Token Types](#authentication-and-token-types)
- [GitHub Enterprise Features](#github-enterprise-features)

---

## Organization Structure

A GitHub organization is the primary unit of collaboration for teams and companies. Every repository belongs either to a personal account or an organization, and the distinction matters: organizations have centralized billing, membership management, and policy enforcement that personal accounts lack.

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

GitHub organizations have three primary member roles, each with distinct capabilities:

| Role | What They Can Do |
|------|-----------------|
| **Owner** | Full administrative control over the org. Can manage billing, settings, members, and all repositories. Should be limited to 2-3 people. |
| **Member** | Can create repositories (if permitted), be added to teams, and contribute to repos they have access to. The default role for employees. |
| **Outside Collaborator** | Not a member of the organization. Granted access to specific repositories only, with no visibility into other org resources. Used for contractors, partners, and open source contributors. |

The distinction between members and outside collaborators is significant from a security perspective. Members can see the organization's repository list and member roster. Outside collaborators see only what they're explicitly granted access to, which limits exposure when working with third parties.

### Base Permissions

Organizations set a base permission level that applies to all members for all repositories. Options are **No permission**, **Read**, **Write**, and **Admin**. Most organizations should set this to "No permission" and manage access explicitly through teams. Setting a broad default like "Read" means every new repository is readable by all org members, which may not be appropriate when repositories contain sensitive information.

---

## Repository Visibility

Visibility determines who can see a repository's code, issues, pull requests, and other content. Choosing incorrectly has obvious security implications, so it's worth understanding what each option actually means.

### Public

Public repositories are visible to anyone on the internet, whether or not they have a GitHub account. The code, commit history, issues, and pull requests are all readable. Any GitHub user can open pull requests or issues, though merging requires explicit permission.

Public repositories are appropriate for open source projects, public documentation, and anything designed to be shared broadly. They're also free on GitHub, regardless of organization tier.

### Private

Private repositories are only accessible to people who have been explicitly granted access, either as organization members with a team that has repository access, or as outside collaborators added directly to the repository. Even the existence of the repository is hidden from unauthenticated users.

Private repositories are the default choice for proprietary code, internal tooling, and anything containing sensitive information.

### Internal (Enterprise Only)

Internal repositories are a [GitHub Enterprise](https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility){:target="_blank" rel="noopener noreferrer"} feature that sits between public and private. They're visible to all authenticated members of the enterprise (which may span multiple organizations under one enterprise account), but not to the public. This is the appropriate choice for shared libraries and platform code that should be reachable across internal teams without being exposed externally.

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

GitHub supports three merge strategies for pull requests, and enabling or disabling them at the repository level is a governance decision:

| Strategy | Effect on History | Best For |
|----------|-------------------|----------|
| **Merge commit** | Preserves all commits from the branch, plus a merge commit | Teams that want full history |
| **Squash and merge** | Collapses all commits into one before merging | Teams that prefer clean, linear history per feature |
| **Rebase and merge** | Replays commits on top of the base branch without a merge commit | Teams that want linear history without squashing context |

Many teams disable merge commits and allow only squash or rebase, producing a clean history where each entry corresponds to a complete feature or fix rather than a stream of "WIP" and "fix typo" commits. There's no universally correct answer, but consistency within a repository matters more than which strategy is chosen.

### Auto-Delete Head Branches

Enabling "Automatically delete head branches" in repository settings causes GitHub to delete the source branch as soon as a pull request is merged. This prevents branch accumulation over time and keeps the repository list manageable. Deleted branches are recoverable from the pull request if needed.

---

## Branch Protection Rules

Branch protection rules are policies applied to specific branches (or branch name patterns) that restrict what contributors can do to those branches. They're the primary mechanism for enforcing code review, CI requirements, and commit quality on important branches.

### Configuring Protection Rules

Branch protection rules are configured in repository settings under "Branches." A rule matches branches by name or glob pattern (`main`, `release/*`, etc.), and applies to all matching branches.

```bash
# View branch protection via CLI
gh api repos/YOUR_ORG/YOUR_REPO/branches/main/protection
```

### Key Protection Options

**Required pull request reviews** prevents anyone from pushing directly to the protected branch. All changes must arrive through a pull request with at least N approvals. Setting "Dismiss stale pull request approvals when new commits are pushed" ensures that a new review is required when someone pushes changes after an approval, preventing the pattern of getting approval, then sneaking in changes.

**Required status checks** blocks merging until specified CI checks pass. This is where you enforce that tests pass, builds succeed, or code quality gates are met before anything lands on the protected branch. The "Require branches to be up to date before merging" option ensures the PR is tested against the latest base branch, not an older version of it.

**Require signed commits** requires that all commits to the branch carry a verified GPG or SSH signature. This makes commit authorship harder to spoof and is particularly valuable in high-security environments or when regulatory compliance requires auditability of who wrote specific code.

**Require linear history** disallows merge commits, requiring either squash or rebase strategies. This enforces a clean commit graph on the protected branch.

**Restrict who can push to matching branches** limits direct pushes and force pushes to specific users or teams, even if they have write access. This is useful for ensuring that only designated people (like release managers) can bypass the normal PR process in emergency situations.

**Do not allow bypassing the above settings** is a critical option. By default, repository administrators can bypass protection rules. Enabling this setting removes that bypass even for admins, ensuring that no one can circumvent the rules under time pressure.

### When Branch Protection Isn't Enough

Branch protection rules are repository-scoped and configured per repository. Organizations with dozens or hundreds of repositories need a consistent enforcement mechanism that doesn't rely on correctly configuring each repository individually. That's where rulesets come in.

---

## Rulesets

Rulesets are a newer, more powerful alternative to branch protection rules. They operate at the organization level, can apply to many repositories at once, and support more granular bypass controls. They're the preferred approach for any organization managing more than a handful of repositories.

### How Rulesets Differ from Branch Protection Rules

| Feature | Branch Protection | Rulesets |
|---------|-------------------|----------|
| Scope | Per repository | Organization or repository |
| Multiple active rules | One per branch pattern | Multiple rulesets can layer |
| Bypass control | Admin bypass toggle | Named bypass list with roles |
| Tag protection | No | Yes |
| Push rules | Limited | More options (file size, path restrictions) |
| Audit | Limited | Full enforcement log |

### Organization-Level Rulesets

An organization ruleset can target repositories by name pattern, topic, or property, and then apply rules to branch name patterns within those repositories. This means you can enforce "all repositories tagged `production` must require 2 reviewers and passing CI on their `main` branch" without touching each repository's settings individually.

Rulesets also have an "Evaluate" mode, which logs violations without enforcing them. This is useful for rolling out new rules gradually: enable in evaluate mode, review the enforcement log to see what would have been blocked, then switch to active enforcement once you're confident the rule is correct.

### Tag Rules

Rulesets support protecting tags, which branch protection rules do not. Tag protection prevents unauthorized users from creating, updating, or deleting tags that match a pattern like `v*`. This matters for release automation: if anyone with write access can create a `v1.0.0` tag, your release pipeline has an implicit trust vulnerability.

### Push Rules

Push rules run before a commit is accepted into the repository (not just at the branch level). They can block pushes based on file path, file size, or commit metadata. Examples include blocking files larger than 10MB or preventing commits to paths like `secrets/` across all repositories in the organization.

### Bypass Lists

Rather than a binary "admins can bypass" toggle, rulesets let you name specific users, teams, or GitHub Apps that are allowed to bypass rules. This is more precise: you might allow a dedicated CI bot app to bypass review requirements (since it's automated and trusted) while keeping the rule active for human contributors.

---

## CODEOWNERS

CODEOWNERS is a file that declares who owns specific parts of the repository. When a pull request modifies files owned by a particular person or team, GitHub automatically requests a review from that owner. Combined with branch protection that requires code owner reviews, this ensures that changes to sensitive areas of the codebase always get reviewed by someone with the appropriate context.

### File Location and Format

The CODEOWNERS file lives in the repository root, in a location like `.github/` or `docs/`. GitHub uses the first one it finds. The syntax mirrors `.gitignore` patterns:

```
# Each line is a pattern followed by one or more owners

# All files at the root
/*                  @default-reviewer

# The entire infra directory
/infra/             @platform-team

# Specific file
/config/prod.yml    @sre-team

# All YAML files
*.yml               @devops-team

# Files in nested directories (** matches any path)
**/migrations/      @database-team

# A specific individual
/src/auth/          @security-lead @backend-team
```

Patterns are evaluated from top to bottom, and the last matching pattern takes effect. More specific patterns should come after more general ones.

### Team-Based Ownership

Pointing to teams rather than individuals is the better long-term approach. When `@platform-team` owns `/infra/`, the review request goes to the whole team and any member can approve. If you point to individual users, a departure or vacation blocks every PR that touches their files.

Teams must be visible (closed, not secret) to be used as CODEOWNERS entries.

### CODEOWNERS and Branch Protection

CODEOWNERS becomes enforceable when branch protection enables "Require review from Code Owners." Without this setting, the CODEOWNERS file requests reviews but doesn't require them. With it enabled, a PR touching owned files cannot merge until the designated owner approves, regardless of how many other reviewers have approved.

This is a common misconfiguration: organizations set up CODEOWNERS carefully, but forget to enable the corresponding branch protection option, rendering the ownership declarations advisory rather than mandatory.

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

Many teams configure auto-merge for low-risk Dependabot updates: patch and minor version bumps that pass CI. This keeps dependencies current without requiring manual review for every small update. The pattern typically involves a GitHub Actions workflow that detects Dependabot pull requests, checks the update type, and approves and merges if CI passes.

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
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2

      - name: Auto-merge patch and minor updates
        if: |
          steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
          steps.metadata.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Major version updates warrant human review, since they may include breaking changes that automated tests don't catch.

---

## Code Scanning

Code scanning analyzes repository code for security vulnerabilities and coding errors. GitHub's native offering is CodeQL, a semantic code analysis engine that understands program flow, not just text patterns. Third-party scanners that produce results in the SARIF format can also integrate with GitHub's code scanning infrastructure.

### CodeQL Analysis

CodeQL works by compiling your code into a queryable database, then running a suite of security queries against it. Queries can detect vulnerabilities like SQL injection, path traversal, insecure deserialization, and dozens of others, with an understanding of data flow that pattern-matching tools lack.

The standard way to enable CodeQL is through the "Set up code scanning" workflow in the repository's Security tab, which generates a starting workflow:

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
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          # Optionally specify a custom query suite
          # queries: security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

The `schedule` trigger matters. PR-only scanning catches new vulnerabilities as code is introduced, but weekly full scans catch vulnerabilities in existing code that stem from newly published advisories or newly written queries.

### Third-Party SARIF Integration

[SARIF (Static Analysis Results Interchange Format)](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning){:target="_blank" rel="noopener noreferrer"} is an open standard for static analysis results. Tools that support it, such as Semgrep, ESLint with security rules, and Snyk, can produce SARIF output that GitHub ingests and displays in the Security tab alongside CodeQL results.

```yaml
- name: Upload SARIF results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

This means your existing scanner investment isn't discarded when enabling GitHub code scanning. You can aggregate results from multiple tools in one place.

### Custom Queries

CodeQL queries are written in QL, a declarative query language. Organizations can write custom queries for patterns specific to their codebase, such as calls to internal APIs that must be used in a particular way. Custom queries are stored in a repository and referenced from the workflow:

```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: csharp
    queries: ./custom-queries/security-suite.qls
```

The [CodeQL query repository](https://github.com/github/codeql){:target="_blank" rel="noopener noreferrer"} contains the full set of built-in queries, which are also useful as a starting point for custom query development.

### Alert Triage and Dismissal

Code scanning alerts appear in the Security tab. Each alert includes the vulnerable code location, a description of the vulnerability, and often a suggested fix. Alerts can be dismissed with a reason: "false positive," "used in tests," or "won't fix." Dismissals are tracked in the audit log, creating an accountability trail.

---

## Secret Scanning

Secret scanning detects credentials, API keys, tokens, and other secrets that have been committed to a repository. Because secrets committed to version control are often retrieved by attackers even after deletion (the history still contains them), prevention at push time is more valuable than detection after the fact.

### What It Detects

GitHub maintains patterns for over 200 token types from common service providers, including AWS access keys, Azure credentials, Stripe keys, GitHub tokens, Slack webhooks, and many others. When a matching pattern appears in a commit, GitHub alerts repository administrators and, where a partner program exists, notifies the affected service provider.

Secret scanning operates on the full commit history, not just recent commits, so enabling it on an existing repository will scan historical commits and may surface secrets that were committed years ago.

### Push Protection

Push protection is the proactive layer. When enabled, GitHub checks commits at push time and blocks pushes containing recognized secrets before they enter the repository. This is the feature that makes secret scanning genuinely preventive rather than just detective.

When a push is blocked, the contributor sees which secrets were detected and can either remove the secret and push a clean commit, or bypass the block with a stated reason (the bypass is logged). The bypass option is important for developer experience: legitimate test fixtures or example credentials shouldn't permanently block a workflow, but bypasses are audited.

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

Custom patterns are defined in the repository or organization settings under "Secret scanning." Once added, they're applied to both historical scanning and push protection.

### Partner Programs

When GitHub detects a secret for a participating service provider (like AWS, Google, or Stripe), it notifies the provider directly through the [GitHub Secret Scanning Partner Program](https://docs.github.com/en/code-security/secret-scanning/secret-scanning-partner-program){:target="_blank" rel="noopener noreferrer"}{:target="_blank" rel="noopener noreferrer"}. The provider can then immediately revoke the exposed credential. This automated revocation loop significantly reduces the window of exposure for accidentally committed secrets.

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

GitHub supports a structured private vulnerability reporting flow. When enabled, a "Report a vulnerability" button appears on the repository's Security tab, allowing researchers to submit a report that is visible only to the repository administrators. This is preferable to email for several reasons: reports are tracked in GitHub's UI, can be escalated to a CVE advisory, and keep all the discussion in one place.

Private vulnerability reporting is enabled per repository in Security settings. Organizations can also enable it for all repositories by default.

### Security Advisories

Once a vulnerability is confirmed and a fix is ready, GitHub's Security Advisory feature provides a structured format for publishing the disclosure. Advisories can be associated with a CVE, list affected versions, credit the reporter, and automatically notify users of the affected package through the dependency graph.

---

## Audit Logs

The organization audit log records every significant action taken on resources within the organization: who created or deleted a repository, who changed a branch protection rule, who modified a team membership, who exported secrets, and much more. The audit log is the authoritative record of administrative activity.

### What's Tracked

The audit log captures actions across several categories:

- **Repository actions**: Creation, deletion, visibility changes, fork settings, archiving
- **Team and member actions**: Invitations, role changes, team membership modifications
- **Authentication events**: SSO sessions, personal access token usage, OAuth app authorizations
- **Security and policy changes**: Branch protection changes, secret scanning alerts, code scanning dismissals
- **Billing and organization settings**: Payment method changes, feature toggles, organization setting modifications
- **GitHub Actions**: Workflow runs, secret access, runner registration

### Searching and Exporting

The audit log is searchable in the GitHub UI at `github.com/organizations/YOUR_ORG/settings/audit-log`, and can be queried using a filter syntax:

```
# Find all repo deletions in the past 30 days
action:repo.destroy created:>2025-12-01

# Find actions by a specific user
actor:suspicious-user

# Find security-related actions
action:org.audit_log_export
```

For compliance workflows, the audit log can be exported as JSON or CSV, and for continuous export, the GitHub Audit Log streaming feature pushes events to an external service like Azure Event Hubs, Amazon S3, or Splunk in near-real time.

```bash
# Export audit log via API
gh api "/orgs/YOUR_ORG/audit-log?phrase=action:repo.destroy&per_page=100"
```

### Compliance Use Cases

Audit logs satisfy several common compliance requirements. SOC 2 Type II audits frequently ask for evidence that administrative access is logged and that changes to security controls are tracked. The audit log provides both, assuming the organization retains logs for the required period (GitHub retains the API-accessible log for 180 days by default; streaming to external storage extends retention).

Organizations with strict compliance requirements should enable audit log streaming from the start rather than discovering the 180-day limitation when an auditor asks for 12 months of data.

---

## Authentication and Token Types

How humans and automated systems authenticate to GitHub matters for both security and operational reliability. GitHub provides several authentication mechanisms, each with different scope and risk profiles.

### Personal Access Tokens: Classic vs. Fine-Grained

**Classic personal access tokens (PATs)** are the legacy mechanism. They're long-lived, have coarse permission scopes (like "repo" which grants full access to all repositories), and apply organization-wide. A leaked classic PAT with "repo" scope gives the attacker access to everything the token owner can access.

**Fine-grained personal access tokens** are the successor. They're scoped to specific repositories (not all repositories owned by an account), have granular permissions (read-only pull requests, read/write issues, etc.), can have expiration dates, and can require organization approval before use. Fine-grained tokens represent a significant security improvement over classic tokens.

| Feature | Classic PAT | Fine-Grained PAT |
|---------|-------------|-----------------|
| Repository scope | All repos of the account | Specific repos |
| Permission granularity | Broad (e.g., "repo") | Per-resource (issues, PRs, code, etc.) |
| Expiration | Optional | Optional (max 1 year) |
| Org approval required | No | Can be required |
| Audit log attribution | Username | Username + token name |

Organizations can restrict which token types are allowed, requiring fine-grained tokens for access to organization resources. This is a meaningful security control for organizations that have historically used classic PATs for automation.

### OAuth Apps

OAuth apps allow third-party services to act on behalf of a GitHub user, with the user's authorization. The authorization flow redirects the user to GitHub, the user approves a set of requested permissions, and the app receives an OAuth token. OAuth tokens inherit the user's permissions, not a fixed set, which means an OAuth app with `repo` scope can access all the repositories the authorizing user can access.

OAuth apps are appropriate for user-facing integrations where the app needs to act in the context of the logged-in user. The risk is that users often approve OAuth app access without carefully considering what they're granting.

Organizations can restrict which OAuth apps are allowed to access organization resources, requiring owner approval before an OAuth app can read private repositories. This is configurable in organization settings under "Third-party access."

### GitHub Apps

GitHub Apps are the preferred mechanism for automation and integrations. Unlike OAuth apps, GitHub Apps have their own identity (not tied to a user), use short-lived tokens (1-hour installation tokens), can be installed at the repository or organization level with precise permission grants, and can subscribe to specific webhook events.

A GitHub App that needs to comment on pull requests can be granted only pull request write permission, nothing else. If the app's credentials are compromised, the blast radius is limited to what the installation was granted, not the full scope of an OAuth token or PAT.

```bash
# Generate an installation token for a GitHub App (typically done server-side)
# This requires a private key for JWT signing - conceptually:
# 1. Sign a JWT with the app's private key
# 2. Exchange the JWT for an installation token via the API
# 3. Use the installation token (valid for 1 hour) for API calls
gh api /app/installations --header "Authorization: Bearer <JWT>"
```

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

GitHub Enterprise Cloud and GitHub Enterprise Server add capabilities designed for organizations that need centralized identity, tighter security controls, and compliance guarantees that aren't available on the standard GitHub.com tier.

### SAML Single Sign-On

SAML SSO connects GitHub authentication to an organization's identity provider (IdP) like Azure Active Directory, Okta, or Ping Identity. When SAML SSO is enabled, members must authenticate through the IdP to access organization resources. This means that when an employee is deprovisioned in the IdP, their GitHub access is automatically invalidated.

Without SAML SSO, removing someone's GitHub access requires manually removing them from the organization. With SAML SSO, the IdP is the source of truth. Deprovisioning in the IdP flows through to GitHub.

SAML SSO also means that PATs and SSH keys used to access organization resources must be authorized to work with the SAML session, adding another layer of control over which tokens can reach organization repositories.

```bash
# Check SAML SSO status for an org
gh api orgs/YOUR_ORG/credential-authorizations
```

### Enterprise Managed Users

[Enterprise Managed Users (EMU)](https://docs.github.com/en/enterprise-cloud@latest/admin/identity-and-access-management/understanding-iam-for-enterprises/about-enterprise-managed-users){:target="_blank" rel="noopener noreferrer"} is a stricter identity model where user accounts are fully provisioned and controlled by the enterprise, rather than being personal GitHub.com accounts associated with an organization. In an EMU setup, every user account within the enterprise is created and managed through the IdP via SCIM provisioning. Users cannot use these accounts for personal open-source activity or join external organizations.

EMU trades flexibility for control. It's appropriate for enterprises with strict compliance requirements who need complete account lifecycle management and want to ensure that departing employees have no residual access. It's not appropriate for organizations that hire open-source contributors who maintain their GitHub identity across multiple organizations.

### IP Allow Lists

Enterprise and organization settings support IP allow lists, which restrict GitHub.com access to specific IP ranges. Connections from outside the allowed ranges receive an authorization error even with valid credentials. This is useful for organizations that want to ensure GitHub access only occurs from corporate networks or VPN, preventing personal device access to sensitive repositories.

IP allow lists work alongside SAML SSO rather than replacing it: SAML SSO controls who can access, IP allow lists control from where they can access.

### SCIM Provisioning

System for Cross-domain Identity Management (SCIM) automates user and group provisioning from the IdP to GitHub. When a new employee joins and is added to a GitHub group in the IdP, SCIM provisions their GitHub membership automatically. When they leave and are deprovisioned, SCIM removes them. This eliminates the manual work and lag of managing GitHub membership separately from the HR or IdP workflow.

SCIM is essential at scale. Organizations with hundreds of employees cannot reliably manage GitHub membership manually without SCIM to keep it synchronized with the authoritative identity source.
