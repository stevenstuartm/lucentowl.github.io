---
title: "Azure DevOps Repos & Artifacts"
layout: guide
category: Azure
subcategory: Developer Tools & CI/CD
description: "Git repository management with Azure Repos including branch policies, pull request workflows, and code review patterns, plus Azure Artifacts for package feed management across NuGet, npm, Maven, and Python."
tags: [infrastructure, azure, devops, cicd, collaboration, governance, practical]
---

## What Are Azure Repos and Azure Artifacts

[Azure Repos](https://learn.microsoft.com/en-us/azure/devops/repos/get-started/what-is-repos){:target="_blank" rel="noopener noreferrer"} provides Git-based source control integrated into Azure DevOps projects. Multiple repositories can exist within a single project, each with independent branch policies, pull request workflows, and permission models.

[Azure Artifacts](https://learn.microsoft.com/en-us/azure/devops/artifacts/start-using-azure-artifacts){:target="_blank" rel="noopener noreferrer"} is a package feed management service that stores and distributes packages across multiple formats. Teams publish compiled packages to feeds, which can be consumed by applications and other packages through dependency management tools like NuGet, npm, Maven, and pip.

---

## What Problems These Services Solve

**Without Repos:**
- No centralized code storage or version history
- No mechanism to enforce code review before merge
- No branch protection or quality gates
- Difficult to track who made what changes and why
- No audit trail for regulatory compliance

**With Repos:**
- Centralized Git repositories with complete history and blame
- Pull request workflows enforcing code review and quality gates
- Branch policies requiring approvals, build success, and linked work items
- Complete audit trail showing all changes and reviewers
- Integration with Azure Pipelines for automated build and test gates

**Without Artifacts:**
- Dependencies managed through uncontrolled NuGet.org or npmjs.com feeds
- No ability to control package versions or versions used across teams
- No internal package reuse across teams
- Difficult to manage open-source dependency risk
- No way to promote packages through environments (dev, staging, production)

**With Artifacts:**
- Internal package feeds scoped to projects or organizations
- Package promotion workflows through feeds (development → release → production)
- Shared library distribution across teams without public publishing
- Upstream source configuration for transparent dependency caching
- Control over which package versions teams can consume

---

## How Azure Repos Differs from GitHub / AWS CodeCommit

| Concept | GitHub | AWS CodeCommit | Azure Repos |
|---------|--------|----------------|------------|
| **Repository structure** | Standalone repos; organization holds repos | One repo per service; region-scoped | Multiple repos per Azure DevOps project |
| **Branch policies** | Branch protection rules | Limited policy support | Rich policies: reviewers, build validation, merge strategies |
| **Pull requests** | Full-featured workflow | Basic merge requests | Advanced: auto-complete, draft PRs, comment resolution |
| **Code search** | Global search via web interface | Per-repo search limited | Cross-repo semantic code search |
| **Access control** | Team and repository level | IAM-based (coarse) | Granular per-branch and per-repo permissions |
| **TFVC option** | Not available | Not available | Team Foundation Version Control (legacy) |
| **Integration with CI/CD** | GitHub Actions (separate service) | AWS CodePipeline (separate service) | Azure Pipelines (integrated, shared service) |
| **Permissions inheritance** | From organization/team level | From IAM policies | Per-repository with inheritance options |

---

## Azure Repos Core Concepts

### Repositories Within Projects

An Azure DevOps project can contain multiple Git repositories. Each repository has independent branch policies, permissions, and pull request workflows. This differs from GitHub (organization contains standalone repos) and allows teams to isolate codebases while sharing the same work item tracking and pipeline infrastructure.

**Multi-repo patterns:**
- **Mono-repo:** Single repository containing all code (microservices, libraries, tools)
- **Multi-repo:** Separate repositories per team, service, or domain
- **Hybrid:** Some shared libraries in one repo, team-specific code in separate repos

All repositories within a project share the same Azure DevOps project infrastructure, meaning they use the same work item types, Azure Pipelines templates, and audit logs.

### Branch Policies

[Branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies){:target="_blank" rel="noopener noreferrer"} are enforced rules that prevent direct commits to protected branches (typically main/release branches). Policies act as quality gates that must pass before code can merge.

**Common branch policy types:**

| Policy | Purpose |
|--------|---------|
| **Require minimum reviewers** | PR must be approved by N reviewers (e.g., 2) before merge |
| **Require code review from specific users** | Specific people or groups must review (e.g., architecture team for critical paths) |
| **Require successful builds** | PR must pass Azure Pipelines before merge; blocks merge on build failure |
| **Require comment resolution** | All reviewer comments must be resolved (marked complete) |
| **Require linked work items** | PR must reference work items (allows tracing code to requirements) |
| **Limit merge types** | Allow only squash merge, rebase, or merge commit (enforces history style) |
| **Require branch name conformance** | Branch names must match patterns (e.g., feature/*, hotfix/*) |

**Policy interaction:**
- Policies are evaluated in order; all must pass for merge to succeed
- Reviewers can approve, request changes, or wait for changes
- Comment resolution blocks merge until explicitly marked complete
- Build failure blocks merge until the policy is bypassed (if allowed) or the build passes

### Pull Request Workflows

Pull requests create a formal code review and discussion space. Reviewers can comment on specific lines, request changes, approve, or review without voting.

**PR features:**

| Feature | Purpose |
|---------|---------|
| **Draft PRs** | Mark a PR as draft to prevent accidental merge while still under development |
| **Auto-complete** | Automatically merge when all policies pass (instead of manual click) |
| **Merge strategies** | Squash (flatten history), rebase (linear), merge commit (preserve branch history) |
| **Comment threads** | Conversations tied to specific code lines with resolution tracking |
| **Code review voting** | Approve, request changes, or review without voting |
| **PR descriptions** | Template-based descriptions capturing context and testing notes |
| **Work item linking** | Link to user stories, bugs, or tasks for traceability |

**Comment resolution requirement:**
If a branch policy requires comment resolution, reviewers mark their comments complete when issues are addressed. Until all comments are marked complete, the PR cannot merge (even if approved).

### Code Search

Azure Repos provides [semantic code search](https://learn.microsoft.com/en-us/azure/devops/repos/git/search-code){:target="_blank" rel="noopener noreferrer"} across all repositories in a project. This differs from GitHub (web-based global search) and CodeCommit (per-repo search) by supporting cross-repo queries within the DevOps project.

**Search capabilities:**
- Search across all branches in a repo
- Search across all repos in a project
- Regex support for advanced patterns
- Filter by file type, branch, or path

### Repository Permissions

Permissions in Azure Repos can be assigned at the project, repository, or branch level. This granularity allows fine-grained access control without managing separate access control systems.

**Common permission patterns:**

| Permission Level | Applies To | Use Case |
|-----------------|-----------|----------|
| **Project** | All repos in project | Broad organizational access |
| **Repository** | Specific repo | Team-specific access (repo for Team A is not visible to Team B) |
| **Branch** | Specific branch (e.g., main) | Protect release branches from accidental commits |

**Common roles:**

| Role | Permissions | Typical Users |
|------|-----------|---------------|
| **Readers** | View and clone | Stakeholders, auditors |
| **Contributors** | Create, modify, delete branches | Developers |
| **Administrators** | Manage permissions, policies, settings | Team leads |

### TFVC (Team Foundation Version Control)

Azure Repos supports [TFVC](https://learn.microsoft.com/en-us/azure/devops/repos/tfvc/overview){:target="_blank" rel="noopener noreferrer"}, a legacy centralized version control system from the pre-Git era. Most new projects use Git; TFVC appears in enterprises with historical investments.

**TFVC characteristics:**
- Centralized repository (unlike Git's distributed model)
- Check-in locks prevent concurrent edits
- Longer history (some enterprises have 20+ years of TFVC commits)
- Limited branching and merging compared to Git
- Slower operations due to server round-trips

**When TFVC still exists:**
- Legacy enterprises standardizing on Git see existing TFVC repositories
- High-control environments preferring centralized version control
- Workspaces and local copies instead of clones

**Migration pattern:**
Organizations moving from TFVC to Git typically migrate incrementally: new projects start with Git, existing TFVC projects remain until team capacity allows migration. Git is the recommended default for all new repositories.

---

## Branch Strategy Patterns

### Git Flow

Git Flow uses multiple long-lived branches (main, develop, release) with feature branches off develop.

**Branches:**
- `main`: Production releases; every commit is a release
- `develop`: Integration branch; where features are merged
- `feature/*`: Feature branches off develop; one per feature
- `release/*`: Release branches off develop for release preparation
- `hotfix/*`: Hotfix branches off main for production bugs

**Workflow:**
1. Developer creates feature branch from develop
2. Works and commits
3. Creates PR to develop with code review
4. After approval, merges to develop
5. When ready to release, create release branch from develop
6. Test and fix bugs in release branch
7. Merge release to main and back to develop
8. Tag main with version

**Azure Repos implementation:**
- Use branch policies on `main` and `develop` to enforce review
- Use branch name patterns (`feature/*`, `release/*`) to organize
- Use merge strategies (squash to develop, merge commit to main) for history control

**Trade-off:** More branches to manage; complex release workflow; good for coordinated releases.

### GitHub Flow

GitHub Flow uses a single main branch with short-lived feature branches. Every commit to main should be deployable.

**Branches:**
- `main`: Always deployable
- `feature/*`: Feature branches off main; one per feature
- Short-lived (merged within hours or days)

**Workflow:**
1. Developer creates feature branch from main
2. Works and commits
3. Creates PR with code review
4. After approval, merges to main
5. Main is automatically deployed

**Azure Repos implementation:**
- Single branch policy on `main`
- Auto-complete PRs when policies pass
- Continuous deployment triggered on main commit

**Trade-off:** The workflow is simple. However, you must maintain the always-deployable constraint. This is ideal for feature-driven continuous delivery.

### Trunk-Based Development

Trunk-based development uses a single branch (main) with all developers committing directly or with short-lived branches (1-day maximum).

**Branches:**
- `main`: Single source of truth
- `feature/*`: Short-lived branches (maximum 1 day old)
- Release branches created at commit time, not in development

**Workflow:**
1. Developer commits directly to main or creates 1-hour feature branch
2. Feature branches merge via PR
3. CI/CD validation runs immediately
4. Feature flags decouple deploy from release

**Azure Repos implementation:**
- Minimal branch policies (quick validation only)
- Feature flags in code control visibility
- Release branches created at tag time, not in development

**Trade-off:** High discipline; requires automation and feature flags; enables fastest feedback.

### Branch Policies as Guardrails

Branch policies are not just process rules; they are technical guardrails enforcing code quality and traceability regardless of the branch strategy chosen.

**Guardrail functions:**
- **Build validation:** Code cannot merge until tests pass
- **Code review:** Human judgment prevents mistakes automation misses
- **Linked work items:** Changes are traceable to requirements
- **Comment resolution:** Feedback is acted upon, not ignored
- **Merge strategy:** History remains clean and readable

Using strong policies means developers cannot bypass quality gates through carelessness or pressure, regardless of release schedule.

---

## Azure Artifacts Core Concepts

### Feed Types and Formats

[Azure Artifacts feeds](https://learn.microsoft.com/en-us/azure/devops/artifacts/concepts/feeds){:target="_blank" rel="noopener noreferrer"} store packages in multiple formats. A single feed can contain packages of different types.

**Supported package formats:**

| Format | Ecosystem | File Type | Use Case |
|--------|-----------|-----------|----------|
| **NuGet** | .NET | .nupkg | C#, VB.NET, F# packages |
| **npm** | JavaScript/Node | .tgz | JavaScript, TypeScript packages |
| **Maven** | Java | .jar, .pom | Java packages and dependencies |
| **Python** | Python | .whl, .tar.gz | Python packages |
| **Universal** | Any | Any file | Generic package format for unsupported types |

A team can publish internal libraries in multiple formats (a C# library as NuGet, a TypeScript wrapper as npm) to a single feed.

### Feed Scoping: Project vs Organization

Feeds can be scoped to a project or the entire Azure DevOps organization, controlling visibility and access.

**Project-scoped feeds:**
- Visible only to members of the project
- Smaller blast radius if credentials are compromised
- Default for most scenarios

**Organization-scoped feeds:**
- Visible to all projects in the organization
- Shared infrastructure for organization-wide shared libraries
- More complex permission management

**Typical pattern:**
- Project-scoped feeds for team-specific internal packages
- Organization-scoped feeds for organization-wide shared libraries (common utilities, shared frameworks)

### Upstream Sources

[Upstream sources](https://learn.microsoft.com/en-us/azure/devops/artifacts/how-to/set-up-upstream-sources){:target="_blank" rel="noopener noreferrer"} connect Azure Artifacts to external package registries. When a package is not found locally, the feed queries upstream sources, downloads the package, and caches it.

**Common upstream sources:**
- **nuget.org** (NuGet)
- **npmjs.com** (npm)
- **Maven Central** (Maven)
- **PyPI** (Python)

**How upstream sources work:**
1. Application requests package `lodash@4.17.21` from the feed
2. Feed checks local cache; not found
3. Feed queries upstream sources (npmjs.com)
4. Feed downloads the package and caches it
5. Application receives the package from the feed

**Benefits:**
- Transparent caching of public packages
- Ability to limit which package versions teams can use
- Central point for setting retention policies
- Enables organizations to block specific packages or versions

**Trust model:**
- Your feed trusts upstream sources
- Upstream sources are your external dependencies
- Compromised upstream = all your applications using that upstream are at risk

### Package Versioning

Packages follow semantic versioning (major.minor.patch) or release channels (stable, prerelease, beta).

**Version numbering:**
- `1.0.0`: Stable release
- `1.0.1`: Patch release (bug fix)
- `1.1.0`: Minor release (new feature, backward compatible)
- `2.0.0`: Major release (breaking changes)
- `1.0.0-beta.1`: Prerelease (not stable)

**Immutability:**
In many package managers, a released version is immutable; you cannot overwrite `1.0.0` once published. Prerelease versions may allow re-publishing for testing.

### Retention Policies and Storage

Azure Artifacts charges per gigabyte of storage. Retention policies automatically delete old package versions to manage storage costs.

**Retention strategies:**
- **Time-based:** Keep packages published in the last 90 days
- **Count-based:** Keep the 10 most recent versions per package
- **Version-based:** Keep Release versions indefinitely, delete Prerelease versions after 30 days

**Deleting packages:**
When you delete a package version, dependent applications cannot download it. This is rarely done in production; instead, versions are soft-deleted or marked deprecated.

### Views: Release, Prerelease, Local

[Views](https://learn.microsoft.com/en-us/azure/devops/artifacts/concepts/views){:target="_blank" rel="noopener noreferrer"} are filtered subsets of a feed that show different package versions. Organizations use views for package promotion workflows.

**Standard views:**

| View | Contains | Use Case |
|------|----------|----------|
| **Release** | Stable versions only | Production consumption |
| **Prerelease** | Beta and RC versions | Testing and staging |
| **Local** | Packages published to this feed | Internal packages |

**Promotion workflow:**
1. Developers publish package `mylib@1.0.0-beta.1` to Prerelease view
2. QA tests in staging environment using Prerelease view
3. Package is promoted to Release view
4. Production applications consume from Release view

Without views, promoting packages requires version numbering discipline (1.0.0-beta → 1.0.0-release). Views provide a mechanical way to gate access to versions.

---

## Architecture Patterns

### Inner-Source with Azure Repos

Inner-source applies open-source principles to internal projects: clear documentation, welcoming contribution processes, and transparent decision-making.

**Pattern:**
- Shared library repositories are public within the organization
- Clear README with usage and contribution guidelines
- Pull requests from other teams are encouraged
- Ownership is clear (team or guild owns the library)
- Release cadence is documented

**Benefits:**
- Teams reuse libraries instead of reimplementing
- Knowledge spreads across organizational silos
- Reduces duplication and maintenance burden
- Encourages code quality (open code is more scrutinized)

**Requirements:**
- Repository visibility: projects must grant read access to other teams
- Documentation: clear enough for external teams to understand and contribute
- Code review discipline: maintained for all PRs including internal contributions
- Ownership: clear who accepts/rejects external contributions

### Shared Library Distribution Through Artifacts

Shared libraries are published to Azure Artifacts feeds, making them available to all teams as package dependencies.

**Pattern:**
1. Team A maintains shared library `shared.logging` in Git
2. CI/CD publishes package `SharedLogging` to organization-scoped feed
3. Team B adds `SharedLogging` package to their project
4. Team B receives updates as new versions are published
5. Deprecated versions are automatically updated via retention policies

**Versioning discipline:**
- Major version bump: breaking API changes (Team B must update code)
- Minor version bump: new features (backward compatible)
- Patch version bump: bug fixes (automatic if using semantic versioning)

**Dependency management:**
- Git stores version constraints (`SharedLogging >= 1.0.0, < 2.0.0`)
- Package manager resolves to available versions
- Explicit version pinning prevents surprises in production

### Package Promotion Workflows

Packages move through feeds or views as they progress from development to production.

**Pattern with multiple feeds:**

| Feed | Environment | Policy |
|------|-------------|--------|
| **dev-feed** | Development | All versions allowed; auto-delete old versions |
| **staging-feed** | Staging | Stable and RC versions only; no auto-delete |
| **prod-feed** | Production | Stable versions only; immutable; full audit |

**Promotion process:**
1. Developer publishes `mylib@1.0.0-beta.1` to dev-feed
2. QA tests using dev-feed
3. Release engineering promotes `1.0.0` to staging-feed
4. Final testing in staging environment
5. Release engineering promotes `1.0.0` to prod-feed
6. Production applications pull from prod-feed

**Alternative: Views-based promotion:**
- Single feed with Release, Prerelease, Local views
- Promotion changes which view the package appears in
- Simpler than managing multiple feeds; less permission flexibility

### Integration with Azure Pipelines

Azure Pipelines can both publish and consume packages from Artifacts feeds.

**Publishing from Pipelines:**
1. Build task compiles code
2. Pack task creates .nupkg or .tgz
3. Publish task uploads to feed
4. Package is available for download

**Consuming from Pipelines:**
1. CI task restores dependencies from feed
2. Feed resolves versions based on constraints
3. Build compiles with resolved dependencies

**Secret management:**
- Credentials to access feeds are stored in Azure Key Vault
- Pipelines retrieve credentials at runtime
- No credentials in source code or configuration

---

## Security and Governance

### Repository-Level vs Branch-Level Permissions

Permissions determine who can read, modify, and delete repository content.

**Repository-level:**
- Controls access to the entire repository
- Assigned to groups (teams, departments)
- Simple: entire repo is visible or not

**Branch-level:**
- Controls access to specific branches
- Allows release branches to require elevated approval
- Example: `main` branch requires additional review; `develop` branch is open

**Permission hierarchy:**
1. Project-level permissions (baseline)
2. Repository-level permissions (override project)
3. Branch-level permissions (override repository)

### Feed Permissions and Upstream Source Trust

Feed permissions control who can publish and consume packages.

**Permission types:**
- **Readers:** Can download packages
- **Contributors:** Can publish packages
- **Administrators:** Can manage feed settings and permissions

**Upstream source trust model:**
- If you add nuget.org as an upstream, your feed trusts all packages on nuget.org
- A compromised package on nuget.org becomes available to applications using your feed
- Organizations often block specific upstream versions or enable package verification

### Audit Logging

Both Repos and Artifacts maintain audit logs showing all actions.

**Repository audit:**
- Who made commits and when
- Who reviewed and approved PRs
- Branch policy violations
- Permission changes

**Artifacts audit:**
- Who published packages and when
- Package promotion actions
- Upstream source changes
- Permission changes

**Access pattern:**
Azure DevOps logs are centralized in the Activity page and can be streamed to Log Analytics for long-term retention and alerting.

### Credential Management for Feeds

Applications and CI/CD pipelines need credentials to access feeds (especially private ones).

**Credential types:**

| Type | Use Case | Management |
|------|----------|------------|
| **Personal Access Tokens (PATs)** | Manual development; CI/CD; scripts | User-managed; should be rotated regularly |
| **Service Connections** | Azure Pipelines | Managed through Azure DevOps; encrypted storage |
| **Managed Identity** | AKS, App Service, Azure Automation | No credential storage; identity-based access |

**Best practice:**
- Use managed identity whenever possible (AKS, App Service)
- Use service connections for Azure Pipelines
- Use PATs only for local development (short-lived, limited scope)
- Never commit credentials to source code

---

## AWS Comparison Table

Architects familiar with AWS will find these equivalents useful.

| Concept | AWS | Azure DevOps |
|---------|-----|--------------|
| **Source control** | CodeCommit (Git) | Azure Repos (Git) |
| **Branch policies** | Minimal; limited protection rules | Rich policies: reviewers, build validation, comment resolution |
| **Code review** | Pull requests basic | Advanced: draft PRs, auto-complete, voting |
| **Repository organization** | One repo per service; regional | Multiple repos per project; organization-wide |
| **Package storage** | CodeArtifact (Maven, npm, PyPI) | Azure Artifacts (NuGet, npm, Maven, Python, Universal) |
| **Package promotion** | Repositories with different retention | Feeds with views (Release, Prerelease, Local) |
| **Upstream caching** | External repository connections | Upstream sources (nuget.org, npmjs.com, etc.) |
| **CI/CD integration** | CodePipeline (separate service) | Azure Pipelines (integrated; shared infrastructure) |
| **Audit trail** | CloudTrail (infrastructure events only) | Activity log (detailed repo and package events) |
| **Permissions model** | IAM roles and resource policies | Azure RBAC + repository/branch-level permissions |
| **Access control granularity** | Coarse (IAM is account-wide) | Fine-grained (per-repo, per-branch, per-feed) |

---

## Common Pitfalls

### Pitfall 1: Weak Branch Policies

**Problem:** Release branches have no code review requirement. Anyone can merge directly to main.

**Result:** Untested or unreviewed code reaches production. No traceability. Compliance audits fail.

**Solution:** Enforce minimum two-reviewer approval on main, require successful builds, and require linked work items. Use branch policies as guardrails, not suggestions.

---

### Pitfall 2: Publishing Secrets to Feeds

**Problem:** A developer accidentally publishes a package containing API keys or database credentials.

**Result:** Credentials are exposed to anyone with read access to the feed. Attackers can compromise systems.

**Solution:** Scan packages before publishing (use secret scanning tools). Educate developers on secrets management. Use Azure Key Vault for runtime secrets, never package them.

---

### Pitfall 3: Unconstrained Upstream Sources

**Problem:** Feed has nuget.org as upstream with no version constraints. Applications pull any available version.

**Result:** Vulnerable packages are automatically pulled. Dependency confusion attacks succeed (attacker publishes `internal.library@1.0.0` to nuget.org, applications pull attacker's package instead of internal version).

**Solution:** Use upstream package verification. Pin major versions in dependency specifications. Regularly audit upstream packages for vulnerabilities.

---

### Pitfall 4: Storing Packages in Version Control

**Problem:** Compiled .jar files and .nupkg files are committed to Git.

**Result:** Repository becomes bloated. Clones are slow. Build artifacts create merge conflicts.

**Solution:** Use .gitignore to exclude build artifacts. Publish compiled packages to Azure Artifacts feeds only. Retrieve packages from feeds at build time.

---

### Pitfall 5: Not Rotating Feed Credentials

**Problem:** PAT used for feed access was created years ago. Same PAT is used across multiple projects.

**Result:** If the PAT is compromised, all projects are affected. No way to revoke access to specific projects.

**Solution:** Use short-lived PATs (limited to 90 days). Use different credentials per project. Prefer managed identities and service connections over PATs.

---

### Pitfall 6: No Deprecation Policy for Shared Libraries

**Problem:** Shared library version 1.0 is 5 years old. Nobody maintains it. Teams still depend on it.

**Result:** Bugs in old version are never fixed. Teams cannot upgrade to new versions without rewriting code. Maintaining the library becomes a maintenance burden.

**Solution:** Establish a deprecation policy: announce EOL date, provide migration path, set retention policy to auto-delete old versions. Encourage teams to upgrade to new major versions with backward-incompatible but better-designed APIs.

---

## Key Takeaways

1. **Azure Repos enforces code quality through branch policies, not process.** Branch policies act as technical guardrails, preventing code from merging until review, tests, and linked work items are satisfied. Policies work regardless of developer skill or deadline pressure.

2. **Multiple repositories per project enable team autonomy while sharing DevOps infrastructure.** Teams can manage their own repositories with independent branch policies while all projects share the same work item tracking, Azure Pipelines templates, and audit logs.

3. **Pull request workflows are more than approval boxes.** Comment resolution, draft status, merge strategy, and work item linking create a complete code review and traceability system. Use these features to enforce discipline.

4. **Branch strategies (Git Flow, GitHub Flow, trunk-based) are frameworks for branch organization, not replacements for branch policies.** The strategy you choose determines branch structure. Branch policies enforce code quality regardless of which strategy you adopt.

5. **Azure Artifacts feeds provide more than storage.** Feeds enable package promotion (dev → staging → prod), upstream caching for transparent dependency management, and version control independent from Git history.

6. **Upstream sources create a trust relationship with external registries.** When you add nuget.org as an upstream, you trust all packages on nuget.org. Compromised upstream packages compromise your applications. Use upstream verification and regular audits.

7. **Views enable package promotion without multiple feeds.** Release, Prerelease, and Local views allow packages to be promoted from development to production within a single feed, simplifying promotion workflows compared to managing separate feeds.

8. **Inner-source principles drive shared library adoption.** Clear documentation, welcoming pull requests from other teams, and transparent ownership encourage reuse and reduce reimplementation across the organization.

9. **Credentials to feeds should never be stored in repositories or configuration files.** Use managed identity when possible, service connections for Pipelines, and PATs only for local development with short expiration windows. Rotate credentials regularly.

10. **Repository and feed permissions should reflect organizational structure and risk.** Release branches and production feeds require elevated access. Development branches and dev feeds are more permissive. Align permissions with deployment risk, not arbitrary rules.
