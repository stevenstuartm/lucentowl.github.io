---
title: "GitHub Collaboration"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "Pull requests, code review, issue tracking, templates, and team workflows on GitHub, from forking models to CODEOWNERS and effective collaboration patterns."
tags: [git, github, collaboration, workflow, practical, code-review]
---

## Repository Models

There are two common ways teams work with repositories on GitHub, and the choice between them has more to do with trust and access control than with preference.

The **shared repository model** means everyone with collaborator access pushes branches directly to the same repository. A developer creates a feature branch, opens a pull request from that branch, gets it reviewed, and merges it. This model works well for closed teams where everyone has been granted write access: internal product teams, company-internal tools, and private projects. It keeps the workflow simple because there is only one canonical repository to manage, and tools like branch protection rules apply uniformly to every contributor.

The **fork-and-pull model** starts with each contributor creating a personal fork of the repository under their own account. They commit and push to their fork, then open a pull request from their fork back to the upstream repository. Maintainers of the upstream only ever receive pull requests; they never grant write access to the upstream itself. This model suits open-source projects where you cannot vet every potential contributor in advance. It also protects the upstream from accidental damage since contributors cannot push directly to it at all.

In practice, many teams blend these approaches. Open-source projects use the fork model for external contributors but allow core maintainers to push branches directly. Internal projects sometimes adopt the fork model when they want stricter controls even within the organization. The shared repository model is simpler when it is viable; reach for the fork model when you need to accept contributions from untrusted parties or when you want an explicit firewall between contributors and the canonical codebase.

```
  Shared Repository Model:
  ┌─────────────────────────────────────────────┐
  │  upstream/org-repo                          │
  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
  │  │  main   │  │ feature/ │  │ feature/  │  │
  │  │         │  │ alice    │  │ bob       │  │
  │  └─────────┘  └──────────┘  └───────────┘  │
  │       ▲              │             │        │
  │       └──── PR ──────┘             │        │
  │       └──────────── PR ────────────┘        │
  └─────────────────────────────────────────────┘
  Everyone pushes branches to the same repo.

  Fork-and-Pull Model:
  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ upstream/org-repo │    │ alice/org-repo   │    │ bob/org-repo     │
  │ ┌──────────┐     │    │ (fork)           │    │ (fork)           │
  │ │  main    │◄────┼─── PR ────────────────┤    │                  │
  │ │          │     │    │ feature/auth     │    │ feature/api ─── PR ──►│
  │ └──────────┘     │    └──────────────────┘    └──────────────────┘
  └──────────────────┘
  Contributors push to their own forks, then PR to upstream.
```

---

## Pull Request Anatomy and Lifecycle

A pull request is a proposal to merge one branch into another. It is also a conversation artifact: it captures not just the code change but the discussion, review comments, and decisions that shaped it.

### Draft Pull Requests

GitHub allows you to open a pull request as a draft. A draft PR signals that the work is in progress and not ready for formal review. Reviewers are not notified, and the merge button is blocked. Draft PRs are useful for getting early visibility on an approach without implying the code is ready to ship. Developers often open a draft PR as soon as they start significant work so that the team can see what is happening, and then convert it to ready when the code is in a reviewable state.

```bash
# Open a draft PR from the CLI
gh pr create --draft --title "WIP: Refactor payment processor" --body "Early work on #142"
```

### The Review and Approval Flow

Once a PR is marked ready, reviewers can leave line-level comments, suggestion blocks (proposed edits the author can accept with one click), and a formal review decision. GitHub gives reviewers three choices: **Comment** (general feedback without a decision), **Approve** (the reviewer is satisfied), and **Request Changes** (the reviewer has blocking objections that must be resolved before merge).

Branch protection rules can require a minimum number of approvals before merging is allowed. When a reviewer who previously approved re-requests changes, the approval is dismissed. When the author pushes new commits, any stale approvals can optionally be dismissed automatically, preventing old approvals from carrying through after significant new changes land.

### Merging Strategies

GitHub offers three merge strategies, each with different implications for history:

| Strategy | What It Does | When to Use |
|----------|-------------|-------------|
| **Merge commit** | Creates a merge commit that joins the two branches | When you want the full branch history visible in `git log` |
| **Squash and merge** | Collapses all branch commits into a single commit on the base | When the branch has messy intermediate commits and you want a clean linear history |
| **Rebase and merge** | Replays the branch commits linearly on top of the base branch | When you want a linear history but want to preserve individual commits |

Repository administrators can restrict which strategies are available. Many teams settle on squash-and-merge for feature branches because it produces one commit per PR on the main branch, making `git bisect` and `git log` easier to read. The trade-off is that the granular history from the feature branch is discarded once the squash commit lands.

After a PR is merged, GitHub can automatically delete the source branch. Enable this in the repository settings under "General" to avoid branch accumulation over time.

---

## Writing Effective Pull Request Descriptions

A good PR description is not a summary of the diff. The diff explains what changed; the description explains why it changed and what the reviewer needs to understand to evaluate it well.

### What to Include

**Context and motivation** should come first. Why does this change exist? Is it fixing a bug, implementing a feature, or addressing a piece of technical debt? A brief reference to the issue or requirement grounds the reviewer in the purpose before they look at code. "Fixes the timeout errors users were seeing on the checkout page" tells the reviewer more than "Update PaymentService.cs."

**What changed at a high level** helps reviewers navigate the diff. A PR touching fifteen files across four subsystems benefits enormously from a paragraph that explains the main structural decisions and why certain approaches were taken. If you considered alternatives and rejected them, say so; that context prevents reviewers from suggesting the approach you already evaluated.

**How to test it** removes the friction of the reviewer having to reconstruct your mental model. List the steps needed to exercise the change locally, or describe what the relevant automated tests cover. For UI changes, include screenshots or screen recordings. This is often the most neglected section, and its absence often leads to PRs sitting in review queues longer than necessary.

A simple template that captures these dimensions:

```markdown
## What and Why
<!-- What is this change doing, and why is it needed? Link to the issue. -->

## How to Test
<!-- Steps to verify the change works as expected. Include screenshots for UI changes. -->

## Notes for Reviewer
<!-- Anything that might look surprising, decisions made, or areas you'd like specific feedback on. -->
```

Treat the PR description like documentation that will outlast the review conversation. Six months later, when someone runs `git log --follow` on a file and lands on this commit, the PR description is often the only place they can find the rationale for the decision.

---

## Code Review Best Practices

Code review has two distinct purposes that are easy to conflate. The first is catching bugs and design problems before they reach production. The second is knowledge transfer: the reviewer learns how the codebase is evolving, and the author benefits from a second perspective. Both matter, and optimizing purely for one undermines the other.

### What to Look For

The highest-value review comments address correctness, logic errors, missing edge cases, and design concerns that would be costly to address after merge. Security implications, race conditions, and missing error handling fall in this category. These are the comments that pull requests exist to surface.

The second tier covers maintainability: naming that obscures intent, missing tests for important code paths, or structural decisions that will complicate future changes. These are worth raising even if they will not cause immediate bugs.

Style and formatting sit in the lowest tier and should largely be handled by automated tooling like linters, formatters, and pre-commit hooks. When reviewers spend cycles commenting on indentation and brace style, they spend less attention on the things that actually matter. Agree on formatting conventions as a team, automate their enforcement, and then stop discussing them in reviews.

```
              ┌───────────────┐
              │  Correctness  │  ◄── Focus most attention here
              │  Logic errors │
              │  Security     │
              ├───────────────┤
              │Maintainability│  ◄── Moderate attention
              │  Naming       │
              │  Testing      │
              ├───────────────┤
              │    Style      │  ◄── Automate this (don't argue)
              │  Formatting   │
              └───────────────┘
  Most review conflicts happen at the bottom.
  Most review value comes from the top.
```

### Giving Constructive Feedback

Comments that identify a problem without suggesting a direction force the author to guess what the reviewer wants. Prefer comments that explain the concern and offer a path forward. "This method is doing too much" is less useful than "This method is handling both parsing and validation; splitting them would make the parsing logic easier to unit test independently."

Framing matters. There is a meaningful difference between "you should do this differently" and "have you considered doing this differently?" The former asserts authority; the latter opens a conversation. Reviews should be collaborative, not adversarial.

Use the GitHub suggestion feature for small, mechanical improvements. A suggestion block lets the author accept the change with a single click, eliminating back-and-forth for trivial fixes:

```markdown
```suggestion
const timeoutMs = 5000;
```
```

Prefix non-blocking observations with labels like "nit:", "optional:", or "question:" so the author understands which comments require action and which are offered as context. Without this, authors often block themselves trying to address every comment before merging, including ones the reviewer did not intend as requirements.

### Review Etiquette

Respond to all comments before merging, even if the response is just "done" or "agreed, will address in follow-up." This closes the loop for reviewers who may be following the thread asynchronously. When you resolve a thread without addressing the concern, the reviewer may not notice and the PR may merge with open issues.

If a review discussion escalates or becomes unproductive, move it to a synchronous conversation. Comment threads are poor venues for disagreements because tone is easily misread and iterations are slow. Resolve it in a call, then summarize the conclusion in the thread.

### Avoiding Nitpick Wars

Teams sometimes fall into patterns where reviews degenerate into extended style debates or nit-picking that slows delivery without improving quality. A few practices help break these patterns. First, invest in automated tooling to handle anything that can be automated; this removes a large class of comments from human review entirely. Second, establish a team norm that nits are optional and labelled as such. Third, set a time limit on unresolved stylistic debates: if two people cannot agree in two comment exchanges, defer to a team convention or the author's judgment and move on.

---

## Review Workflows: Required Reviewers and CODEOWNERS

### Required Reviewers

Repository administrators configure how many approvals a pull request needs before it can be merged using branch protection rules. This count can be global or can be scoped to code paths using CODEOWNERS.

### CODEOWNERS

The [CODEOWNERS file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners){:target="_blank" rel="noopener noreferrer"} defines which individuals or teams are automatically requested for review when a PR touches particular files or directories. GitHub reads the file from one of three locations: the repository root, `docs/`, or `.github/`. The last matching pattern wins, similar to how `.gitignore` works.

```
# Syntax: pattern  owner [owner ...]

# Default owner for everything
*                           @org/platform-team

# Backend code requires a backend team review
/src/backend/               @org/backend-team

# Security-sensitive code requires the security team
/src/auth/                  @org/security-team
/src/cryptography/          @org/security-team

# A specific file requires a named individual
/docs/architecture.md       @jsmith

# Wildcard matching for all files of a type
*.tf                        @org/infrastructure-team
```

When a PR is opened and CODEOWNERS assigns reviewers automatically, those reviews count as required approvals if the branch protection rule requires code owner reviews. This means touching `src/auth/` will not be mergeable until someone from `@org/security-team` approves it, regardless of how many other approvals the PR has.

CODEOWNERS works well for large codebases where different teams own different subsystems. The file itself should be code-owned, typically by an admin or platform team, to prevent anyone from quietly removing themselves as a required reviewer.

### Auto-Assignment

Beyond CODEOWNERS, GitHub supports auto-assignment of reviewers through team review assignment settings. When a team is requested for review, GitHub can automatically assign specific members of that team rather than notifying the entire team. Load balancing options include round-robin (rotating through team members in order) and random assignment. This avoids the diffusion-of-responsibility problem where a team-level review request gets ignored because each member assumes someone else will handle it.

---

## Branch Protection Rules

Branch protection rules prevent direct pushes to important branches like `main` or `release/*`, enforce PR-based workflows, and require status checks to pass before merging. Setting up protections correctly is the difference between policies that teams aspire to follow and ones that are actually enforced.

For a detailed walkthrough of branch protection configuration, rulesets, required status checks, and signed commits, see the [GitHub Security and Administration](/study-guides/developer-tools/github-administration.html) guide.

---

## Issue Tracking

GitHub Issues provides the lightweight backlog and bug tracking that most teams need without requiring a separate tool. The power comes from how issues connect to code changes.

### Issue Templates

Without templates, issues range from detailed and actionable to nearly empty. Templates solve this by providing structure that guides the reporter toward the information the team actually needs. Templates live in `.github/ISSUE_TEMPLATE/` as YAML files that define the form GitHub presents when someone opens a new issue.

```yaml
# .github/ISSUE_TEMPLATE/bug-report.yml
name: Bug Report
description: Report something that is not working as expected
labels: ["bug", "needs-triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thank you for taking the time to report a bug.

  - type: textarea
    id: description
    attributes:
      label: What happened?
      description: A clear description of the bug.
      placeholder: Describe the bug...
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: How can we reproduce this consistently?
      value: |
        1.
        2.
        3.
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behaviour
      description: What should have happened?
    validations:
      required: true

  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options:
        - Low (cosmetic issue)
        - Medium (workaround available)
        - High (blocking, no workaround)
    validations:
      required: true
```

You can have multiple templates, one for each issue type. A feature request template looks different from a bug report template: it might ask for use cases and acceptance criteria rather than reproduction steps. GitHub renders a template chooser when someone clicks "New Issue" if multiple templates exist.

### Labels and Milestones

Labels are the primary way to categorize and filter issues. A coherent label taxonomy matters more than the specific labels you choose. A common structure uses a prefix convention to make the label's purpose obvious:

- `type: bug`, `type: feature`, `type: chore` (what kind of work is it)
- `priority: high`, `priority: medium`, `priority: low` (urgency)
- `status: in-progress`, `status: blocked`, `status: needs-review` (current state)
- `area: api`, `area: ui`, `area: infrastructure` (which part of the system)

Milestones group issues and PRs around a goal, typically a release or sprint. They provide a progress bar showing how many associated items are closed, which gives a quick sense of how far through a milestone a team is.

### Linking PRs to Issues

GitHub can automatically close issues when a PR is merged if the PR description or commit message includes a closing keyword followed by the issue reference. Supported keywords include `closes`, `fixes`, `resolves`, and their variants:

```markdown
Closes #142
Fixes #88, fixes #91
```

When the PR merges into the default branch, GitHub closes the referenced issues and links the PR to them. This creates a traceable chain from issue to code change to merge, which is invaluable when tracking down when and why something was changed.

---

## GitHub Projects

GitHub Projects is the planning layer that sits above issues and pull requests. It provides boards, tables, and roadmap views driven by the same underlying issues and PRs, without requiring a separate planning tool.

### Views

A project can have multiple views, each showing the same items through a different lens. The table view works like a spreadsheet and is useful for bulk editing and sorting. The board view organizes items into columns by status, resembling a Kanban board. The roadmap view shows items across a timeline, useful for release planning.

Custom fields extend the built-in properties with types like text, number, date, single-select, or iteration. A team might add a "Story Points" number field, a "Sprint" iteration field, and a "Component" single-select field to capture their planning metadata without leaving GitHub.

### Automation

Projects support automation through built-in workflows and through the GitHub API. Built-in automations can move items to a specific status column when a PR is merged or closed, or add newly created issues to the project automatically. More sophisticated automation is possible through GitHub Actions, which can react to project events and update fields programmatically.

The value of automation is reducing the manual overhead of keeping the board current. When a PR is merged and the associated issue automatically closes and moves to "Done" on the board, the board stays accurate without requiring anyone to remember to update it.

---

## Templates: Issue Templates and PR Templates

### Issue Templates

As covered in the issue tracking section above, issue templates live in `.github/ISSUE_TEMPLATE/` as YAML files. You can also add a `config.yml` in that directory to customize the template chooser page, including adding links to external resources like a community forum or documentation:

```yaml
# .github/ISSUE_TEMPLATE/config.yml
blank_issues_enabled: false
contact_links:
  - name: Community Discussions
    url: https://github.com/org/repo/discussions
    about: For questions and general discussion, please use Discussions.
```

Setting `blank_issues_enabled: false` prevents contributors from bypassing the templates by opening a blank issue, which ensures every issue contains the structured information the team needs.

### Pull Request Templates

A PR template provides the default body text when someone opens a new pull request. It lives at `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What and Why
<!-- Describe the change and link the issue it addresses. -->
Closes #

## How to Test
<!-- Steps to verify this works. Include screenshots for UI changes. -->
1.
2.

## Checklist
- [ ] Tests added or updated
- [ ] Documentation updated if needed
- [ ] Relevant reviewers added
```

The template is just the starting point; authors are expected to fill it in. A template that asks for the right things trains contributors over time to provide the context that makes reviews go smoothly.

GitHub also supports multiple PR templates through a directory at `.github/PULL_REQUEST_TEMPLATE/`, allowing different templates for different kinds of changes. Authors select the template using a URL parameter, which can be embedded in documentation or scripts.

---

## Discussions and Wikis

### Discussions

[GitHub Discussions](https://docs.github.com/en/discussions){:target="_blank" rel="noopener noreferrer"} provides a forum-style space for conversations that do not fit the issue model. Issues work well for concrete, actionable items with a clear open/closed lifecycle. Discussions work better for questions that might not have a single right answer, for announcements, for design proposals that need community input, and for general Q&A.

For open-source projects, Discussions significantly reduces the noise of issues opened as questions. Redirecting "how do I do X?" conversations to Discussions keeps the issue tracker focused on bugs and features and makes it easier to search for answers to common questions.

For private repositories and internal tools, Discussions tend to be less useful because teams already have Slack, Teams, or similar channels for asynchronous conversation. Adding Discussions introduces another place to check without a clear advantage over existing tools. Adopt Discussions when you have a community that could benefit from a searchable, public forum; skip them when you have a small, coordinated team with existing communication channels.

### Wikis

GitHub Wikis offer a simple documentation space attached to a repository. Each page is a Markdown file, and the wiki has its own git repository that can be cloned separately. The appeal is that documentation lives close to the code.

In practice, wikis suffer from discoverability and maintenance problems. They sit outside the normal PR review workflow, which means changes happen without code review, leading to outdated or inconsistent content. Teams that care about documentation quality tend to move documentation into the repository itself (a `docs/` directory) and treat documentation changes the same as code changes: reviewed via PR, subject to the same CI checks, and version-controlled alongside the code they describe.

Wikis are a reasonable starting point for a project that needs some basic documentation quickly. When documentation quality and accuracy matter, the repository itself is the better home.

---

## GitHub CLI

The [GitHub CLI](https://cli.github.com/){:target="_blank" rel="noopener noreferrer"} (`gh`) brings the most common GitHub workflows into the terminal. For developers who spend most of their time in the command line, `gh` eliminates context-switching to the browser for routine tasks.

### Authentication and Setup

```bash
# Authenticate with GitHub
gh auth login

# Set the default repository for commands in the current directory
gh repo set-default
```

### Pull Request Workflows

```bash
# Create a PR for the current branch
gh pr create --title "Add retry logic to payment processor" --body "Closes #88"

# Create a draft PR
gh pr create --draft --title "WIP: Migrate to new auth provider"

# List open PRs
gh pr list

# View a specific PR
gh pr view 123

# View a PR in the browser
gh pr view 123 --web

# Check out a PR locally (creates a local branch tracking the PR)
gh pr checkout 123

# Review a PR from the terminal
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Please add tests for the error path"

# Merge a PR
gh pr merge 123 --squash --delete-branch

# Check the status of CI on your PR
gh pr checks
```

### Issue Workflows

```bash
# Create an issue
gh issue create --title "Timeout on checkout" --body "Users are seeing 504 errors at peak load" --label "bug,priority: high"

# List open issues
gh issue list

# List issues with a specific label
gh issue list --label "priority: high"

# View an issue
gh issue view 88

# Close an issue
gh issue close 88 --comment "Fixed in #91"

# Reopen an issue
gh issue reopen 88
```

### Repository and Workflow Commands

```bash
# Clone a repository
gh repo clone org/repo

# Fork a repository and clone the fork
gh repo fork org/repo --clone

# View recent workflow runs
gh run list

# Watch a workflow run in real time
gh run watch

# View the logs of a failed run
gh run view --log-failed

# Create a release
gh release create v1.2.0 --title "v1.2.0" --notes "Bug fixes and performance improvements"
```

### Working with Aliases

`gh` supports aliases for commands you use frequently:

```bash
# Create an alias to list your assigned PRs
gh alias set my-prs 'pr list --assignee @me'

# Use it
gh my-prs
```

The CLI also has a rich extension ecosystem, and for workflows not covered by built-in commands, the `gh api` subcommand provides direct access to the GitHub REST and GraphQL APIs, which makes it straightforward to script anything the web interface can do.
