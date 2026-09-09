---
title: "Azure DevOps Repos & Artifacts"
layout: guide
category: Azure
subcategory: Developer Tools & CI/CD
description: "Azure Repos branch and repository policies, cross-repo protection, and pull request workflows, plus Azure Artifacts feed roles, views, upstream source resolution order, and storage limits."
tags: [azure-repos, azure-artifacts, branch-policies, pull-requests, package-management, upstream-sources, practical]
---

## What Are Azure Repos and Azure Artifacts

[Azure Repos](https://learn.microsoft.com/en-us/azure/devops/repos/get-started/what-is-repos){:target="_blank" rel="noopener noreferrer"} provides Git source control inside Azure DevOps projects. A project can hold many repositories, each with its own policies, permissions, and pull request workflow.

[Azure Artifacts](https://learn.microsoft.com/en-us/azure/devops/artifacts/start-using-azure-artifacts){:target="_blank" rel="noopener noreferrer"} is a package feed service that hosts NuGet, npm, Maven, Python, Cargo, and Universal packages. Teams publish internal libraries to feeds and consume them through the same dependency managers they already use, with public registries reachable through the same feed as upstream sources.

Azure Artifacts feeds are a different thing from pipeline artifacts. A feed holds versioned packages that many builds consume over months or years, is billed by storage, and is governed by feed roles and retention policies. Pipeline artifacts are the files one pipeline run hands to another, are billed at nothing, and disappear when the run is deleted. Publishing a build output to a feed and publishing it as a pipeline artifact solve different problems.

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
- Repository policies that reject bad pushes before a pull request exists
- Integration with Azure Pipelines for automated build and test gates

**Without Artifacts:**
- Dependencies pulled directly from nuget.org or npmjs.com with no local copy
- Builds break when a public registry has an outage or a package is unpublished
- No internal package reuse across teams
- Nondeterministic restores when several registries are configured at once
- No way to promote packages through environments

**With Artifacts:**
- Internal package feeds scoped to a project or the whole organization
- Package promotion through views or separate feeds
- Shared library distribution across teams without public publishing
- Upstream sources caching public packages into your own feed
- A defined resolution order that closes the dependency confusion hole

---

## How Azure Repos and Artifacts Differ from GitHub and AWS

| Concept | GitHub | AWS | Azure DevOps |
|---------|--------|-----|--------------|
| **Repository structure** | Standalone repos owned by an organization | CodeCommit: one repo per service, region-scoped | Many repos inside a project, sharing work items and pipelines |
| **Branch protection** | Branch protection rules and rulesets | CodeCommit: approval rule templates only | Branch policies, plus repository policies that reject pushes outright |
| **Protection across repos** | Organization-level rulesets | Approval rule templates applied per repo | Cross-repo policies protecting a branch name across every repo in a project |
| **Pull requests** | Full-featured workflow | Basic pull requests | Draft PRs, auto-complete, comment resolution tracking, work item links |
| **Code search** | Global search, built in | Per-repo search only | Marketplace Code Search extension, default branch plus up to five added branches |
| **Access control** | Team and repository level | IAM policies | Project, repository, and branch level, with cross-repo defaults |
| **CI/CD integration** | GitHub Actions | CodePipeline (separate service) | Azure Pipelines, sharing identities and permissions with Repos |
| **Package storage** | GitHub Packages | CodeArtifact | Azure Artifacts (NuGet, npm, Maven, Python, Cargo, Universal) |
| **Package promotion** | Package visibility settings | Repositories with different upstream configurations | Views (@Local, @Prerelease, @Release) or separate feeds |
| **Upstream caching** | Not offered for all ecosystems | External connections on a CodeArtifact repository | Upstream sources with a defined feed-first resolution order |
| **Advanced security** | GitHub Advanced Security | Amazon Inspector, CodeGuru | GitHub Secret Protection and GitHub Code Security, sold per active committer |
| **Audit trail** | Organization audit log | CloudTrail | Organization-level audit log, Entra-backed organizations only, 90-day retention |

---

## Azure Repos Core Concepts

### Where Repository Settings Live

Azure Repos layers protection at four levels, and knowing which level a control lives at determines whether you configure it once or once per repository.

| Level | What it holds | Configured at |
|---|---|---|
| **Organization** | Default branch name for new repositories | Organization settings > Repositories |
| **Project (All Repositories)** | Default settings and repository policies for every repo, including repos created later. Also cross-repo branch policies. | Project settings > Repositories > All Repositories |
| **Repository** | Repository policies, searchable branches, fork settings, permissions | Project settings > Repositories > *repo* |
| **Branch** | Branch policies and branch permissions | Repository > Branches, or Project settings > Repositories > *repo* > Policies |

Settings applied at **All Repositories** become the default for repositories added later, which is the difference between a policy that covers the organization going forward and one that covers only what exists today.

---

### Repository Policies

Repository policies reject a push at the server before any pull request exists. They are distinct from branch policies, which govern merges.

| Policy | Effect |
|--------|--------|
| **Commit author email validation** | Blocks pushes whose commit author email does not match the given patterns. Wildcards allowed, `;` separates patterns, `!` excludes, order matters. |
| **File path validation** | Blocks pushes introducing paths matching the given patterns. Exact paths start with `/`. |
| **Case enforcement** | Blocks pushes that introduce files, folders, branches, or tags differing only by letter case. Turn it on if contributors work on Windows or macOS. |
| **Reserved names** | Blocks platform-reserved names and characters that break checkout on some operating systems. |
| **Maximum path length** | Blocks pushes introducing paths longer than the configured length. |
| **Maximum file size** | Blocks pushes containing new or updated files above the selected limit. |

All six default to Off and can be set for All Repositories or per repository. Case enforcement does not repair a repository that already contains case-conflicting objects, so rename the conflicts before enabling it.

---

### Branch Policies

[Branch policies](https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies){:target="_blank" rel="noopener noreferrer"} gate what can merge into a protected branch. Setting any policy on a branch automatically has two side effects: changes to that branch must go through a pull request, and the branch cannot be deleted.

| Policy | Purpose |
|--------|---------|
| **Require a minimum number of reviewers** | Require approval from N reviewers. Options control whether requestors can approve their own changes and whether the most recent push resets approvals. |
| **Check for linked work items** | Require or encourage a linked work item, making changes traceable to requirements. |
| **Check for comment resolution** | Require every comment thread to be resolved before completion. |
| **Limit merge types** | Allow only some of basic merge, squash, rebase and fast-forward, or rebase with merge commit. |
| **Build validation** | Require a pipeline to succeed. Configurable as automatic or manual trigger, required or optional, with an expiry when the target branch updates. |
| **Status checks** | Require an external service (or a built-in integration) to post a successful status on the pull request. |
| **Automatically included reviewers** | Add specific people or groups as reviewers, optionally only when a pull request touches given files and folders. |

There is no branch naming policy. Enforcing a naming convention like `feature/*` is done with **branch permissions** on branch folders, granting or denying the create-branch permission at a path, not with a branch policy.

Policies are not ordered. Every enabled policy must be satisfied before a pull request can complete, and a user with the **Bypass policies when completing pull requests** permission can override them. Grant that permission sparingly and audit it, because it is the one thing that turns a guardrail back into a suggestion.

Do not put branch policies on temporary branches. A branch with policies cannot be deleted, so policies on a short-lived branch break automatic branch deletion after the pull request completes.

---

### Cross-Repo Branch Policies

Configuring the same policy on `main` in forty repositories by hand does not scale, and it silently misses the forty-first repository someone creates next week. Project settings > Repositories > All Repositories > Policies solves both, with two options:

- **Protect the default branch of each repository**, which follows whatever each repository calls its default branch
- **Protect current and future branches matching a specified pattern**, which applies to matching branches that do not exist yet

Branch name matching here is **case sensitive**. A cross-repo policy on `main` does not cover a repository whose default branch is `Main`.

---

### Pull Request Workflows

Pull requests create a formal review and discussion space. Reviewers can comment on specific lines, approve, approve with suggestions, wait for the author, or reject.

| Feature | Purpose |
|---------|---------|
| **Draft PRs** | Prevent accidental completion and skip triggering required reviewers while work is in progress |
| **Auto-complete** | Complete the pull request automatically as soon as every policy passes |
| **Merge strategies** | Squash (flatten), rebase (linear), rebase with merge commit, or basic merge commit |
| **Comment threads** | Line-anchored conversations with a resolution state |
| **Voting** | Approve, approve with suggestions, wait for author, reject, or reset |
| **PR templates** | Repository-stored description templates capturing context and testing notes |
| **Work item linking** | Link to user stories, bugs, or tasks for traceability |

If the comment resolution policy is on, every thread has to be resolved before completion, even threads opened by the author and even when the pull request already has enough approvals.

---

### Code Search

Cross-repository code search requires the [Code Search](https://learn.microsoft.com/en-us/azure/devops/project/search/functional-code-search){:target="_blank" rel="noopener noreferrer"} extension from the Visual Studio Marketplace. Without it installed, the search box does not index code at all.

Two limits shape what it can find:

- **Only the default branch is indexed by default.** Each repository can add up to five more searchable branches, configured per repository under Settings > Searchable Branches.
- Search is text and code-structure aware (filter by file, path, extension, and code element such as class or function), not semantic. It matches what you typed, not what you meant.

---

### Repository and Branch Permissions

Permissions apply at project, repository, or branch level, with narrower scopes overriding broader ones.

| Scope | Applies to | Use case |
|-----------------|-----------|----------|
| **Project** | All repositories in the project | Baseline access for the whole team |
| **Repository** | One repository | A team's repository not visible to other teams |
| **Branch** | One branch or branch folder | Restrict who can force push, delete, or create branches under `release/*` |

Default groups supply the starting point: **Readers** can view and clone, **Contributors** can push and create branches, **Build Administrators** and **Project Administrators** can change policies and permissions. Editing branch policies specifically requires **Edit policies** on the repository or branch, or Project Administrators membership.

Branch permissions and branch policies answer different questions. Permissions decide who may push at all; policies decide what has to be true before a merge lands.

---

### Advanced Security

Secret scanning and dependency analysis are not part of the base Azure Repos offering. They ship as paid add-ons, now sold as two standalone products:

| Product | Includes |
|---|---|
| **GitHub Secret Protection** | Secret scanning across repository history, push protection that rejects a push containing a high-confidence secret, and the security overview |
| **GitHub Code Security** | Dependency scanning for vulnerable open-source components, code scanning with CodeQL, and the security overview |

Push protection is the piece that changes behavior most, because it moves secret detection from "we found this in your history last night" to "this push is rejected". Dependency and code scanning run as pipeline tasks with results aggregated per repository.

---

### TFVC (Team Foundation Version Control)

Azure Repos still supports [TFVC](https://learn.microsoft.com/en-us/azure/devops/repos/tfvc/what-is-tfvc){:target="_blank" rel="noopener noreferrer"}, the centralized version control system that predates Git in the product. Microsoft's position is explicit: Git is the default for new projects, TFVC is **feature complete**, compatibility will be maintained, and Git receives all future investment.

**TFVC characteristics:**
- Centralized. History lives on the server, and most operations in a server workspace need a connection.
- Branches are path-based and created on the server. Merging between sibling branches needs a baseless merge.
- Permissions go down to the file level, and files can be locked. Git's finest granularity is the repository or branch.
- Server workspaces scale to millions of files per branch and large binary files without extra tooling. Git needs Git-LFS for the same job.

That last point, not inertia alone, is why TFVC persists: a very large binary-heavy codebase is genuinely harder to move. Concurrent editing is not the differentiator people assume. TFVC team members can change files at the same time and resolve conflicts on check-in, and locking is a workflow you opt into rather than the default.

Git and TFVC repositories can coexist in the same project, so migration does not have to be all at once. The [git-tfs](https://github.com/git-tfs/git-tfs){:target="_blank" rel="noopener noreferrer"} tool converts a TFVC repository to Git with history.

---

## Branch Strategy Patterns

### Git Flow

Git Flow uses multiple long-lived branches (main, develop, release) with feature branches off develop.

**Branches:**
- `main`: Production releases; every commit is a release
- `develop`: Integration branch where features are merged
- `feature/*`: Feature branches off develop, one per feature
- `release/*`: Release branches off develop for release preparation
- `hotfix/*`: Hotfix branches off main for production bugs

**Workflow:**
1. Developer creates a feature branch from develop
2. Works and commits
3. Opens a pull request to develop with code review
4. After approval, merges to develop
5. When ready to release, creates a release branch from develop
6. Tests and fixes bugs in the release branch
7. Merges release to main and back to develop
8. Tags main with the version

**Azure Repos implementation:**
- Branch policies on `main` and `develop` to enforce review
- Branch folder permissions on `feature/*` and `release/*` to control who creates them
- Merge type limits set per branch: squash into develop, merge commit into main

**Trade-off:** More branches to manage and a slower release path. It suits coordinated releases and shipped software with supported older versions.

### GitHub Flow

GitHub Flow uses a single main branch with short-lived feature branches. Every commit to main should be deployable.

**Branches:**
- `main`: Always deployable
- `feature/*`: Feature branches off main, merged within hours or days

**Workflow:**
1. Developer creates a feature branch from main
2. Works and commits
3. Opens a pull request with code review
4. After approval, merges to main
5. Main deploys automatically

**Azure Repos implementation:**
- One branch policy set on `main`, ideally as a cross-repo policy so every service gets it
- Auto-complete so pull requests land the moment policies pass
- CI trigger on main driving deployment

**Trade-off:** Simple to run, but the always-deployable constraint has to hold. It suits continuous delivery of a single deployed version.

### Trunk-Based Development

Trunk-based development keeps one branch with very short-lived branches off it, typically less than a day old.

**Branches:**
- `main`: Single source of truth
- `feature/*`: Short-lived, merged the same day
- Release branches cut at release time, not used during development

**Workflow:**
1. Developer creates a short-lived branch
2. It merges via pull request within a day
3. CI validation runs on every merge
4. Feature flags decouple deploy from release

**Azure Repos implementation:**
- Minimal but fast branch policies, since a slow build validation policy defeats the model
- Feature flags in code controlling visibility
- Release branches created at tag time

**Trade-off:** Demands strong automation and feature flag discipline. It gives the fastest feedback and the fewest merge conflicts.

### Branch Policies as Guardrails

Branch policies are technical controls, not process documentation, and they hold regardless of which strategy above you pick.

**Guardrail functions:**
- **Build validation:** code cannot merge until tests pass
- **Code review:** human judgment catches what automation misses
- **Linked work items:** changes stay traceable to requirements
- **Comment resolution:** feedback gets acted on rather than scrolled past
- **Merge type limits:** history stays in a shape the team can read

The strategy determines branch structure. The policies determine what quality means. The two are independent choices, and teams that pick a strategy without setting policies have chosen a diagram rather than a control.

---

## Azure Artifacts Core Concepts

### Feed Types and Formats

An [Azure Artifacts feed](https://learn.microsoft.com/en-us/azure/devops/artifacts/concepts/feeds){:target="_blank" rel="noopener noreferrer"} holds packages of several formats at once.

| Format | Ecosystem | Size limit per file |
|--------|-----------|---------------------|
| **NuGet** | .NET | 500 MiB |
| **npm** | JavaScript, TypeScript | 500 MiB |
| **Maven** | Java | 500 MiB |
| **Python** | Python | 500 MiB |
| **Cargo** | Rust | 500 MiB |
| **Universal** | Any file type | 4 TiB |

Every format caps at **5,000 versions per package ID**, with no limit on the number of package IDs in a feed. npm has one extra hard limit: a *package.json* above **375 KB** is rejected.

Package versions are immutable. Once `1.0.0` is published you cannot overwrite it, and deleting it does not free the version number for reuse.

---

### Feed Scoping: Project vs Organization

**Project-scoped feeds** are visible to members of one project. They are the default and the smaller blast radius.

**Organization-scoped feeds** are reachable from every project in the organization, which suits genuinely shared platform libraries but widens who can consume them.

The usual arrangement is project-scoped feeds for team-specific packages and one organization-scoped feed for the handful of libraries everyone depends on.

---

### Feed Roles

Feed access uses four roles, and the distinction between the middle two is the one people miss.

| Role | Can |
|------|-----|
| **Feed Reader** | List and download packages |
| **Feed and Upstream Reader (Collaborator)** | Everything above, plus **save packages from upstream sources** |
| **Feed Publisher (Contributor)** | Everything above, plus publish, promote to a view, and deprecate or unlist |
| **Feed Owner** | Everything above, plus delete packages, add or remove upstream sources, allow external package versions, edit feed settings, and delete the feed |

Collaborator exists because pulling a package through an upstream source writes a copy into your feed. A Feed Reader can consume what is already cached but cannot cause a new package to be saved.

Build identities get Collaborator by default: `[Project] Build Service ([Organization])` for project-scoped, and `Project Collection Build Service ([Organization])` for organization-scoped. A pipeline that only restores packages needs nothing more. A pipeline that **publishes** needs Feed Publisher (Contributor) granted to those identities explicitly.

Project Collection Administrators and Azure Artifacts Administrators hold Feed Owner on every feed in the project automatically.

---

### Views and Promotion

[Views](https://learn.microsoft.com/en-us/azure/devops/artifacts/concepts/views){:target="_blank" rel="noopener noreferrer"} are filtered slices of a feed. Every feed starts with three.

| View | Contains |
|------|----------|
| **@Local** | The default view. Packages published directly to the feed **and** packages saved from upstream sources. |
| **@Prerelease** | A suggested view, empty until you promote to it. Renameable and deletable. |
| **@Release** | A suggested view, empty until you promote to it. Renameable and deletable. |

@Local is not the "internal packages" view. It is everything the feed holds, which is why it is the view you point consumers at when you want a resolvable package graph. @Prerelease and @Release are conventions, not built-in behavior, and nothing lands in them until a Contributor promotes a version.

Two consequences to design around:

- **A view grants access to the feed through that view.** Someone with permission on @Release can download the packages in it even without direct access to the feed. Hiding packages means restricting the feed *and* its views.
- **Promoted packages are exempt from retention policies.** Promotion is the mechanism for saying "never clean this up", which is useful when deliberate and a slow storage leak when it happens by default.

---

### Upstream Sources and Resolution Order

[Upstream sources](https://learn.microsoft.com/en-us/azure/devops/artifacts/concepts/upstream-sources){:target="_blank" rel="noopener noreferrer"} connect a feed to public registries (nuget.org, npmjs.com, Maven Central, PyPI, crates.io) and to other Azure Artifacts feeds. A package installed through an upstream is automatically saved into your feed, so a later outage at the public registry does not stop your builds.

The reason this matters for security is the **resolution order**, which Azure Artifacts fixes rather than leaving to the client:

```
  restore request for "internal.logging 2.1.0"
              │
              v
  ┌───────────────────────────────────┐
  │ 1. Published directly to the feed │──found──> serve it, stop
  └───────────────┬───────────────────┘
                  │ not found
                  v
  ┌───────────────────────────────────┐
  │ 2. Already saved from an upstream │──found──> serve it, stop
  └───────────────┬───────────────────┘
                  │ not found
                  v
  ┌───────────────────────────────────┐
  │ 3. Upstream sources, in the order │──found──> save into feed,
  │    listed in feed settings        │           then serve it
  └───────────────┬───────────────────┘
                  │ not found
                  v
              restore fails
```

A package you published wins over anything on a public registry with the same name and version. That closes the dependency confusion hole, but only if the client asks the feed the question. Clients like NuGet query several configured sources in parallel and take the first response, so the protection depends on your configuration file naming **one feed and nothing else**:

```xml
<packageSources>
  <clear />
  <add key="FabrikamFiber" value="https://pkgs.dev.azure.com/fabrikam/_packaging/FabrikamFiber/nuget/v3/index.json" />
</packageSources>
```

The `<clear />` matters. NuGet merges configuration files up the directory tree and from the machine-level config, so without it a developer's global nuget.org entry sits alongside your feed and the ordering guarantee is gone.

Three operational behaviors that surprise people:

- **You cannot publish a version that already exists upstream.** With the nuget.org upstream enabled, publishing your own `Newtonsoft.Json 10.0.3` is rejected. Overriding it means disabling the upstream, publishing, and re-enabling.
- **Packages saved from upstream stay after the upstream is removed.** Disabling an upstream does not evict what it already cached.
- **New public packages take time to appear.** Expect a 3 to 6 hour delay between a push to a public registry and availability through an upstream. Feed-to-feed upstreams within Azure Artifacts propagate in minutes.

Custom upstream sources, pointing at a registry Microsoft does not list, are supported for npm only.

---

### Storage, Retention, and Deletion

Azure Artifacts bills by storage, with **2 GiB free per organization**. Hitting the cap is not a soft limit: publishing new artifacts stops until you either delete packages or set up billing and switch the usage limit to pay-as-you-go.

What counts toward billed storage:

| Counts | Does not count |
|---|---|
| All package types in all feeds | Pipeline artifacts |
| Packages saved from upstream sources | Pipeline caching |
| Packages sitting in the recycle bin | |

Deleted packages go to a **recycle bin for 30 days** and keep consuming storage the whole time. Emptying it manually is the fast route back under the cap. Storage metrics refresh within 24 hours and sometimes 48, so a deletion does not immediately restore your ability to publish.

**Retention policies** delete old versions automatically, configured per feed by maximum versions per package and by days since last download. Two constraints shape how well they work:

- Packages **promoted to a view are exempt**, so a promotion-heavy workflow can leave retention with nothing to delete.
- Recently downloaded packages are protected by the days-since-download setting, which is what stops retention from breaking a build that still depends on an old version.

---

## Architecture Patterns

### Choosing a Feed Layout

```
        Do other projects in the org need these packages?
                          │
              ┌───────────┴───────────┐
             no                      yes
              │                       │
              v                       v
      Project-scoped feed     Organization-scoped feed
              │                       │
              └───────────┬───────────┘
                          v
        Do dev and production consumers need
        different permissions, not just different versions?
                          │
              ┌───────────┴───────────┐
             no                      yes
              │                       │
              v                       v
        One feed with            Separate feeds per
        @Prerelease and          stage, promoted by
        @Release views           a release pipeline
```

Views are simpler and keep one URL in every configuration file. Separate feeds are the answer only when production consumers must not be able to see prerelease packages at all, since a view restricted to specific people gets close but still lives inside the same feed.

---

### Inner-Source with Azure Repos

Inner-source applies open-source practice to internal projects: readable documentation, a welcoming contribution path, and transparent ownership.

**Pattern:**
- Shared library repositories are readable across the organization
- A README covers usage and how to contribute
- Pull requests from other teams are expected, not tolerated
- One team or guild owns the library and decides what merges
- Release cadence is written down

**Requirements:**
- Repository permissions that grant read access beyond the owning team
- Documentation good enough for someone with no context
- Automatically included reviewers with path filters, so the owning team is pulled into every external contribution without anyone remembering to add them
- A stated policy on what gets accepted

The reviewer automation is what makes this survive contact with a busy team. Inner-source fails when external pull requests sit unreviewed, and a path-filtered reviewer policy is the mechanism that stops that.

---

### Shared Library Distribution

**Pattern:**
1. Team A maintains `shared.logging` in Git
2. A pipeline packs and publishes `SharedLogging` to an organization-scoped feed, using a build identity with the Feed Publisher role
3. Team B references the package with a version constraint
4. New versions flow to Team B on their next restore, within the constraint they set
5. Retention deletes old versions that nothing has downloaded recently

**Versioning discipline:**
- Major bump for breaking API changes, which Team B has to act on
- Minor bump for backward-compatible features
- Patch bump for fixes

**Dependency management:**
- Version constraints live in the consuming project (`SharedLogging >= 1.0.0, < 2.0.0`)
- Lock files pin the resolved version so builds are reproducible
- Because published versions are immutable, a lock file pointing at `1.4.2` will always get the same bytes

---

### Package Promotion Workflows

Packages move toward production either by changing view or by moving between feeds.

**Views-based promotion (single feed):**
1. A pipeline publishes `mylib 1.0.0-beta.1`, which lands in @Local
2. QA consumes @Local and tests
3. A release pipeline promotes `1.0.0` to @Release
4. Production consumers point at the @Release view URL

**Feed-based promotion (multiple feeds):**

| Feed | Consumers | Policy |
|------|-----------|--------|
| **dev-feed** | Development | Everything published; aggressive retention |
| **staging-feed** | Staging | Release candidates promoted from dev |
| **prod-feed** | Production | Stable versions only; Feed Publisher restricted to the release pipeline identity |

Feeds give you a separate permission boundary per stage. Views give you one URL and less to administer, and promoted packages are exempt from retention automatically. Most teams should start with views and move to feeds only when a permission requirement forces it.

---

### Integration with Azure Pipelines

**Publishing:** a build task compiles, a pack task produces the `.nupkg` or `.tgz`, and a push task uploads to the feed.

**Consuming:** a restore task pulls dependencies from the feed, resolving through the upstream order above.

Authentication for a feed in the same organization does not need stored credentials at all. The pipeline's build identity authenticates automatically once it holds the right feed role: Collaborator to restore, Feed Publisher to push. For NuGet specifically, the **NuGet Authenticate** task wires up the credential provider, because Azure Artifacts does not accept a personal access token passed as a NuGet API key.

Cross-organization feeds are the case that needs an explicit credential, and that is where a service connection or a token from Key Vault belongs.

---

## Security and Governance

### Feed and Repository Access

Repository access and feed access use different models, and conflating them causes over-granting.

Repositories use Azure DevOps permissions inherited down the project, repository, branch chain, with Readers, Contributors, and administrator groups as the starting point. Feeds use the four feed roles, assigned per feed, and do not inherit from project membership beyond the administrator groups.

Pipeline build identities are the one place the two models overlap. Such an identity appears in both, so granting a pipeline broad feed access grants that access to everyone who can edit the pipeline's YAML.

---

### Upstream Source Trust

Adding nuget.org as an upstream means your feed will serve packages from nuget.org, and a compromised package there reaches applications restoring from your feed. What the upstream model gives you in exchange:

- Every package pulled through an upstream is **saved into your feed with its original metadata**, so you can verify what you actually consumed rather than what the registry currently serves
- The resolution order means an internally published name always wins
- Only Collaborators and above can cause a new package to be saved, so a Feed Reader consuming your feed cannot introduce a new external dependency into it
- Removing an upstream stops new packages arriving without breaking builds that depend on already-cached ones

None of that vets package contents. Dependency scanning through GitHub Code Security is the control that examines what is in the package rather than where it came from.

---

### Audit Logging

Azure DevOps auditing is narrower than most guides suggest, and four constraints decide whether it can answer your compliance question at all:

- It is **in public preview** and **off by default**. Turn it on at Organization settings > Policies > Log Audit Events.
- It requires an organization **backed by Microsoft Entra ID**. It is unavailable for organizations that are not, and unavailable on Azure DevOps Server.
- It is **organization-level**, covering state changes such as permission changes, policy changes, resource deletions, and PAT lifecycle events. It does not record commits, pull request approvals, or package downloads. Those live in Git history, the pull request itself, and feed telemetry.
- Events are retained for **90 days** and then deleted.

Two documented blind spots: Azure DevOps does not log sign-in events, and it does not log membership changes made inside a Microsoft Entra group. Both are visible only in the Entra audit logs.

For retention beyond 90 days, either export the log as CSV or JSON, or configure **audit streaming** to a SIEM. Streaming is the right answer for anything a compliance program depends on, because the export is a manual action nobody will remember to take on day 91.

---

### Credentials for Feeds and Repos

| Type | Use for | Notes |
|------|---------|-------|
| **Microsoft Entra tokens** | Scripts and unplanned requests | Microsoft's recommended default. Obtainable through the Azure CLI. Short-lived and auditable in Entra. |
| **Managed identities and service principals** | Azure-hosted services and non-interactive automation | No stored credential. Add the identity to the organization and grant it the feed role or repository permission. |
| **Build identities** | Azure Pipelines reaching feeds in the same organization | Automatic. Grant the feed role, store nothing. |
| **Credential providers** | Local development | Git Credential Manager for repos, Azure Artifacts Credential Provider for feeds. Both broker interactive sign-in instead of holding a token. |
| **Personal access tokens** | Last resort, where nothing above is supported | Tied to the creating user, so they die when that person leaves. |

Microsoft's own guidance is to avoid PATs where an alternative exists, and the operational details back that up:

- A PAT is **always tied to the user identity that created it**. Service principals and managed identities cannot create or manage PATs, so a PAT used by automation is a person's credential wearing a service's name.
- Organization administrators can restrict **full-scoped PATs**, restrict **global PATs** spanning organizations, and enforce a **maximum lifetime**. A 30 to 90 day ceiling is the usual setting.
- On an Entra-backed organization, a PAT goes inactive if the owner does not complete a full sign-in within 90 days, which produces authentication failures nobody expects.
- PATs leaked into public GitHub repositories are detected and **automatically revoked** unless that policy is disabled.
- **Azure Artifacts does not accept a PAT as a NuGet API key.** Use the Azure Artifacts Credential Provider locally and the NuGet Authenticate task in pipelines.

---

## Common Pitfalls

### Pitfall 1: Policies Set Per Repository, So New Repositories Have None

**Problem:** Someone configured branch policies on `main` in each existing repository by hand. Six months later the project has fifteen more repositories, and nobody remembers the checklist.

**Result:** Unreviewed code reaches production through whichever repository was created most recently, and a compliance audit finds inconsistent controls across repositories that look identical.

**Solution:** Set the policy once as a cross-repo policy on **Protect the default branch of each repository**, which covers repositories created later. Set repository policies at the **All Repositories** level for the same reason. Watch the case sensitivity of branch-name patterns, and audit who holds **Bypass policies when completing pull requests**.

---

### Pitfall 2: Publishing Secrets to Feeds

**Problem:** A build packages a config file containing an API key, and the package is published to a feed other teams consume.

**Result:** The credential is readable by everyone with feed access, and by everyone with access to any view on that feed. Because package versions are immutable, you cannot patch `1.0.0` in place. You delete it, rotate the secret, and publish a new version.

**Solution:** Enable secret scanning and push protection through GitHub Secret Protection so the secret never reaches the repository. Audit what the pack step includes rather than trusting the default glob. Treat any exposed credential as compromised and rotate it, because a consumer may already have cached the package locally.

---

### Pitfall 3: Configuration That Defeats the Upstream Resolution Order

**Problem:** A `nuget.config` lists both the internal feed and nuget.org as sources. An attacker publishes a package to nuget.org with the same name as an internal library and a higher version number.

**Result:** NuGet queries both sources in parallel and takes the first response. The attacker's package can win, and the internal-packages-win guarantee never applies because the client was never asked to resolve through the feed alone.

**Solution:** Name exactly one feed in the configuration file and precede it with `<clear />` so higher-level configuration files cannot reintroduce a second source. Reach public registries through that feed's upstream sources, not alongside it. Order upstreams deliberately, putting public registries first unless your organization rebuilds specific open-source packages internally, in which case that source goes first.

---

### Pitfall 4: Build Outputs Committed to Git

**Problem:** Compiled `.jar` and `.nupkg` files get committed. The repository grows to several gigabytes and clone times climb.

**Result:** Slow clones and CI checkouts, binary merge conflicts nobody can resolve, and history that cannot be shrunk without a rewrite that invalidates everyone's local clone.

**Solution:** `.gitignore` is a convention that a determined `git add -f` walks past. Back it with the **Maximum file size** repository policy, set at the All Repositories level, so the push is rejected at the server. Publish compiled output to a feed and restore it at build time. Where large binaries genuinely belong in the repository, use Git-LFS rather than raising the file size limit.

---

### Pitfall 5: Automation Running on a Person's PAT

**Problem:** A release pipeline authenticates to a feed with a PAT created years ago by an engineer who has since changed teams. The same PAT is reused across several projects.

**Result:** The pipeline stops the day the account is disabled or the token hits its expiry, usually during a release. Because the token is broadly scoped and shared, revoking it breaks everything at once, and the audit trail attributes every action to a person who did not perform it.

**Solution:** Move the pipeline onto its build identity, which needs no stored credential for same-organization feeds, or onto a service principal or managed identity for anything outside. Where a PAT is genuinely the only option, scope it to a single use, enforce a maximum lifetime through organization policy, and record where it is used so rotation is a known list rather than an archaeology exercise.

---

### Pitfall 6: Retention Policies That Never Delete Anything

**Problem:** A feed has a retention policy keeping the ten most recent versions per package, and storage keeps growing anyway. The organization eventually hits the 2 GiB limit and publishing stops mid-release.

**Result:** A hard stop on publishing at the worst moment, and the obvious fix (delete old packages) does not free space for up to 30 days because deleted packages sit in the recycle bin.

**Solution:** Check what is exempt before trusting the policy. Packages promoted to a view are never deleted by retention, so a workflow that promotes every build makes retention a no-op. Packages saved from upstream sources count toward storage, so a feed proxying a large public registry grows without anyone publishing anything. Empty the recycle bin explicitly, monitor usage at Organization settings > Storage rather than waiting for the failure, and set up billing before the cap rather than during an incident.

---

### Pitfall 7: No Deprecation Path for a Shared Library

**Problem:** A shared library's 1.x line is years old and unmaintained. Teams still depend on it because upgrading to 2.x means code changes nobody has scheduled.

**Result:** Bugs in the old version go unfixed, and the owning team maintains two versions indefinitely.

**Solution:** Deprecate rather than delete. A Feed Publisher can mark a version deprecated, which surfaces a warning to consumers without breaking their builds, unlike deletion. Pair that with a stated end-of-support date, a written migration path, and a retention policy that eventually removes versions nothing downloads. Deleting a version that consumers still reference breaks their builds immediately and cannot be undone after 30 days.

---

## Key Takeaways

1. **Repository policies and branch policies solve different problems.** Repository policies (file size, path validation, case enforcement, author email) reject a push at the server. Branch policies gate a merge. A guardrail that only exists at merge time does not stop a 400 MB binary landing in history.

2. **Set protection cross-repo, not per repository.** A cross-repo policy protecting each repository's default branch covers repositories that do not exist yet, which is the only version of this control that survives a growing project. Branch-name patterns are case sensitive.

3. **Setting any branch policy has two side effects.** The branch requires pull requests and can no longer be deleted. That second one is why policies on temporary branches break automatic branch deletion.

4. **There is no branch naming policy.** Naming conventions are enforced with branch folder permissions, not branch policies. Path-filtered automatically included reviewers, not a named-users policy, is how you get the right team onto pull requests that touch sensitive code.

5. **Code search is an extension and indexes only the default branch.** Install the Marketplace Code Search extension, and add up to five more searchable branches per repository if you need them.

6. **TFVC is feature complete, not deprecated.** Git is the default for new projects and gets all future investment, but Microsoft maintains TFVC compatibility with no announced end date. The real reason it persists is server workspaces scaling to millions of files without Git-LFS.

7. **The feed role that matters is Collaborator.** Feed and Upstream Reader is what allows saving a package from an upstream source. Build identities get it by default; publishing needs Feed Publisher granted explicitly.

8. **The upstream resolution order is the dependency confusion defense, and configuration can defeat it.** Packages published to the feed win, then packages already saved from upstream, then upstream sources in order. That guarantee only holds if the client's configuration names one feed, with `<clear />` ahead of it.

9. **@Local is the default view and contains everything, including upstream-saved packages.** Promotion to @Release is a convention you implement, and a promoted package becomes exempt from retention policies.

10. **Azure Artifacts storage is capped at 2 GiB free and stops publishing when full.** Upstream-saved packages and the 30-day recycle bin both count; pipeline artifacts and caching do not. Audit logging is separate, in preview, off by default, Entra-only, and retains 90 days, so stream it to a SIEM if compliance depends on it.
