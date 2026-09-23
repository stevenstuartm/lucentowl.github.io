---
title: "GitHub Collaboration"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "How teams propose, review, and track work on GitHub: shared and fork-based repository models, the pull request lifecycle from draft to merge queue, PR descriptions and templates, code review practice, reviewer routing, issues and issue forms, Projects, Discussions, and the GitHub CLI."
tags: [practical, pull-requests, code-review, merge-queue, github-issues, github-projects, collaboration]
---

## Repository Models

There are two common ways teams work with repositories on GitHub, and the choice between them has more to do with trust and access control than with preference.

The **shared repository model** means everyone with collaborator access pushes branches directly to the same repository. A developer creates a feature branch, opens a pull request from that branch, gets it reviewed, and merges it. This model works well for closed teams where everyone has been granted write access: internal product teams, company-internal tools, and private projects. It keeps the workflow simple because there is only one canonical repository to manage, and tools like branch protection rules apply uniformly to every contributor.

The **fork-and-pull model** starts with each contributor creating a personal fork of the repository under their own account. They commit and push to their fork, then open a pull request from their fork back to the upstream repository. Maintainers of the upstream only ever receive pull requests, and they don't need to grant contributors write access to the upstream itself. This model suits open-source projects where you cannot vet every potential contributor in advance. It also protects the upstream from accidental damage since contributors cannot push directly to it at all.

In practice, many teams blend these approaches. Open-source projects use the fork model for external contributors but allow core maintainers to push branches directly. Internal projects sometimes adopt the fork model when they want stricter controls even within the organization. The shared repository model is simpler when it is viable. Reach for the fork model when you need to accept contributions from untrusted parties or when you want an explicit firewall between contributors and the canonical codebase.

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
                 ┌────────────────────┐
                 │ upstream/org-repo  │
                 │       main         │
                 └────────────────────┘
                   ▲                ▲
                   │ PR             │ PR
  ┌────────────────┴───┐    ┌───────┴────────────┐
  │ alice/org-repo     │    │ bob/org-repo       │
  │ (fork)             │    │ (fork)             │
  │ feature/auth       │    │ feature/api        │
  └────────────────────┘    └────────────────────┘
  Contributors push to their own forks, then PR to upstream.
```

---

## Pull Request Anatomy and Lifecycle

A pull request is a proposal to merge one branch into another. It is also a conversation artifact: it captures not just the code change but the discussion, review comments, and decisions that shaped it.

### Draft Pull Requests

GitHub allows you to open a pull request as a draft. A draft PR signals that the work is in progress and not ready for formal review. Code owners are not requested for review until the PR is marked ready, and a draft cannot be merged. Drafts are available in public repositories on every plan, and in private repositories on GitHub Pro, Team, and Enterprise Cloud. Draft PRs are useful for getting early visibility on an approach without implying the code is ready to ship. Developers often open a draft PR as soon as they start significant work so that the team can see what is happening, and then convert it to ready when the code is in a reviewable state.

```bash
# Open a draft PR from the CLI
gh pr create --draft --title "WIP: Refactor payment processor" --body "Early work on #142"
```

### The Review and Approval Flow

Once a PR is marked ready, reviewers can leave line-level comments, suggestion blocks (proposed edits the author can accept with one click), and a formal review decision. GitHub gives reviewers three choices: **Comment** (general feedback without a decision), **Approve** (the reviewer is satisfied), and **Request Changes** (the reviewer has blocking objections that must be resolved before merge).

Each reviewer's latest review is the one that counts, so a reviewer who approved and later requests changes has withdrawn the approval. Protected branches can require a minimum number of approvals and passing checks before the merge button works, and can discard approvals when new commits arrive.

### Merging the Pull Request

The merge button offers up to three methods, and repository settings decide which ones appear:

| Button | Result on the base branch |
|--------|---------------------------|
| **Create a merge commit** | The branch's commits plus a merge commit joining the two histories |
| **Squash and merge** | One new commit containing all of the branch's changes |
| **Rebase and merge** | The branch's commits replayed individually on top of the base, with new hashes |

Which method a team should standardize on is a question about the history it wants, not about GitHub. A repository setting can also delete the head branch automatically after merge, which keeps merged branches from piling up.

### Auto-Merge

A PR that is approved but still waiting on CI doesn't need someone watching it. Enabling auto-merge on the PR, from the web UI or with `gh pr merge --auto`, tells GitHub to merge it with the chosen method as soon as every requirement on the base branch is met. If a new commit fails a check, the PR simply stays open. Auto-merge has to be allowed in the repository settings, and it only applies to branches with protection requirements, since a PR with nothing to wait for can be merged immediately.

### Merge Queues

Required checks prove that a PR passed CI against the base branch as it was when the checks ran. On a busy branch, two PRs can each pass on their own and still break the build when both land, because neither was tested with the other. Requiring branches to be up to date before merging closes that gap, but it forces every author to update and re-run CI each time someone else merges.

A merge queue removes that serial waiting. When a PR is added to the queue, GitHub creates a temporary branch containing the latest base branch, the PRs ahead of it in the queue, and this PR, then runs the required checks on that combination. PRs that pass are merged in order, and a PR that fails is removed from the queue without blocking the ones behind it.

```
  main ── A ── B                         (current tip)

  Queue:  PR #41  → temp branch: B + #41               ✓ checks pass → merged
          PR #42  → temp branch: B + #41 + #42         ✓ checks pass → merged
          PR #43  → temp branch: B + #41 + #42 + #43   ✗ fails → removed, author notified
```

Two setup details trip teams up. An administrator has to require the merge queue on the base branch through branch protection or a ruleset, and CI workflows have to run on the `merge_group` event in addition to `pull_request`, or the queue waits forever for checks that never start. Merge queues are available in public repositories owned by organizations, and in private repositories of organizations on GitHub Enterprise Cloud.

---

## Writing Effective Pull Request Descriptions

A good PR description is not a summary of the diff. The diff shows what changed; the description explains why it changed and what the reviewer needs to understand to evaluate it well.

### What to Include

**Context and motivation** should come first. Why does this change exist? Is it fixing a bug, implementing a feature, or addressing a piece of technical debt? A brief reference to the issue or requirement grounds the reviewer in the purpose before they look at code. "Fixes the timeout errors users were seeing on the checkout page" tells the reviewer more than "Update PaymentService.cs."

**What changed at a high level** helps reviewers navigate the diff. A PR touching fifteen files across four subsystems benefits enormously from a paragraph that explains the main structural decisions and why certain approaches were taken. If you considered alternatives and rejected them, say so. That context prevents reviewers from suggesting the approach you already evaluated.

**How to test it** removes the friction of the reviewer having to reconstruct your mental model. List the steps needed to exercise the change locally, or describe what the relevant automated tests cover. For UI changes, include screenshots or screen recordings. This is often the most neglected section, and its absence often leads to PRs sitting in review queues longer than necessary.

### Pull Request Templates

A PR template provides the default body text when someone opens a new pull request. It lives at `.github/pull_request_template.md` (the root and `docs/` directories also work, and the filename is case-insensitive):

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

The template is only a starting point, and authors are expected to fill it in. A template that asks for the right things trains contributors over time to provide the context that makes reviews go smoothly.

GitHub also supports multiple PR templates through a directory at `.github/PULL_REQUEST_TEMPLATE/`, allowing different templates for different kinds of changes. GitHub doesn't show a chooser for these. Authors select one by adding a `template=` query parameter to the PR creation URL, which teams usually embed in documentation or scripts.

Treat the PR description like documentation that will outlast the review conversation. Six months later, when someone runs `git log --follow` on a file and lands on this commit, the PR description is often the only place they can find the rationale for the decision.

---

## Code Review Best Practices

Code review has two distinct purposes that are easy to conflate. The first is catching bugs and design problems before they reach production. The second is knowledge transfer: the reviewer learns how the codebase is evolving, and the author benefits from a second perspective. Both matter, and optimizing purely for one undermines the other.

### What to Look For

The highest-value review comments address correctness, logic errors, missing edge cases, and design concerns that would be costly to address after merge. Security implications, race conditions, and missing error handling fall in this category. These are the comments that pull requests exist to surface.

The second tier covers maintainability: naming that obscures intent, missing tests for important code paths, or structural decisions that will complicate future changes. Raise them even when they will not cause immediate bugs.

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

A comment that identifies a problem without suggesting a direction forces the author to guess what the reviewer wants. Prefer comments that explain the concern and offer a path forward. "This method is doing too much" is less useful than "This method is handling both parsing and validation. Splitting them would make the parsing logic easier to unit test independently."

Framing matters. There is a meaningful difference between "you should do this differently" and "have you considered doing this differently?" The former asserts authority; the latter opens a conversation. Reviews should be collaborative, not adversarial.

Use the GitHub suggestion feature for small, mechanical improvements. A suggestion block lets the author accept the change with a single click, eliminating back-and-forth for trivial fixes:

````markdown
```suggestion
private const int TimeoutMs = 5000;
```
````

Prefix non-blocking observations with labels like "nit:", "optional:", or "question:" so the author understands which comments require action and which are offered as context. Without this, authors often block themselves trying to address every comment before merging, including ones the reviewer did not intend as requirements.

### Review Etiquette

Respond to all comments before merging, even if the response is just "done" or "agreed, will address in follow-up." This closes the loop for reviewers who may be following the thread asynchronously. When you resolve a thread without addressing the concern, the reviewer may not notice and the PR may merge with open issues.

If a review discussion escalates or becomes unproductive, move it to a synchronous conversation. Comment threads are poor venues for disagreements because tone is easily misread and iterations are slow. Resolve it in a call, then summarize the conclusion in the thread.

### Avoiding Nitpick Wars

Teams sometimes fall into patterns where reviews degenerate into extended style debates or nit-picking that slows delivery without improving quality. A few practices help break these patterns. First, invest in automated tooling to handle anything that can be automated, which removes a large class of comments from human review entirely. Second, establish a team norm that nits are optional and labelled as such. Third, set a time limit on unresolved stylistic debates. If two people cannot agree in two comment exchanges, defer to a team convention or the author's judgment and move on.

---

## Routing Reviews to the Right People

A PR only moves as fast as its reviewers notice it. GitHub has two mechanisms that request reviewers automatically, so authors don't have to know who owns what.

### Code Owners

A `CODEOWNERS` file maps paths to the people or teams who own them. When a PR touches an owned path, GitHub requests a review from that owner automatically. If the base branch is protected with "require review from code owners," the PR can't merge until an owner of every touched path approves, however many other approvals it has. A change to `src/auth/` might wait on the security team even after two teammates approve, which is the point. The file format and its enforcement are part of repository governance.

### Team Review Assignment

When a review is requested from a team, whether by a person or by `CODEOWNERS`, the request goes to the whole team by default, and each member tends to assume someone else will pick it up. A team's code review settings can instead assign specific members automatically. The **round robin** algorithm rotates through members in order of who was least recently asked. **Load balance** also weighs how many reviews each member already has outstanding, aiming for an even share over any 30-day period.

---

## Issue Tracking

GitHub Issues provides the lightweight backlog and bug tracking that most teams need without requiring a separate tool. The power comes from how issues connect to code changes.

### Issue Templates

Without templates, issues range from detailed and actionable to nearly empty. Templates provide structure that guides the reporter toward the information the team actually needs. They live in `.github/ISSUE_TEMPLATE/` and come in two formats. A Markdown template pre-fills the issue body with headings for the reporter to complete. A YAML issue form, still in public preview, renders real form fields with validation, like the one below.

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

You can have multiple templates, one for each kind of issue. A feature request template looks different from a bug report template, since it might ask for use cases and acceptance criteria rather than reproduction steps. GitHub renders a template chooser when someone clicks "New Issue" if multiple templates exist.

You can also add a `config.yml` in that directory to customize the template chooser page, including adding links to external resources like a community forum or documentation:

```yaml
# .github/ISSUE_TEMPLATE/config.yml
blank_issues_enabled: false
contact_links:
  - name: Community Discussions
    url: https://github.com/org/repo/discussions
    about: For questions and general discussion, please use Discussions.
```

Setting `blank_issues_enabled: false` removes the option to open a blank issue from the chooser, so contributors are steered to a template that asks for the information the team needs.

### Labels and Milestones

Labels are the most flexible way to categorize and filter issues. A coherent label taxonomy matters more than the specific labels you choose. A common structure uses a prefix convention to make the label's purpose obvious:

- `type: bug`, `type: feature`, `type: chore` (what kind of work is it)
- `priority: high`, `priority: medium`, `priority: low` (urgency)
- `status: in-progress`, `status: blocked`, `status: needs-review` (current state)
- `area: api`, `area: ui`, `area: infrastructure` (which part of the system)

Organizations can also define issue types, such as bug, feature, and task, which apply across all their repositories and can be set from an issue form's `type` key. Where the organization uses them, they replace the `type:` labels. Large issues can be broken into sub-issues that track their own progress.

Milestones group issues and PRs around a goal, typically a release or sprint. They provide a progress bar showing how many associated items are closed, which gives a quick sense of how far through a milestone a team is.

### Linking PRs to Issues

GitHub can automatically close issues when a PR is merged if the PR description or a commit message includes a closing keyword followed by the issue reference. The keywords are `close`, `fix`, and `resolve` in any tense (`closes`, `fixed`, `resolved`, and so on):

```markdown
Closes #142
Fixes #88, fixes #91
```

When the PR merges into the default branch, GitHub closes the referenced issues and links the PR to them. A PR that targets any other branch links the issues but doesn't close them. This creates a traceable chain from issue to code change to merge, which is invaluable when tracking down when and why something was changed.

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

## Discussions and Wikis

### Discussions

[GitHub Discussions](https://docs.github.com/en/discussions){:target="_blank" rel="noopener noreferrer"} provides a forum-style space for conversations that do not fit the issue model. Issues work well for concrete, actionable items with a clear open/closed lifecycle. Discussions work better for questions that might not have a single right answer, for announcements, for design proposals that need community input, and for general Q&A.

For open-source projects, Discussions significantly reduces the noise of issues opened as questions. Redirecting "how do I do X?" conversations to Discussions keeps the issue tracker focused on bugs and features and makes it easier to search for answers to common questions.

For private repositories and internal tools, Discussions tend to be less useful because teams already have Slack, Teams, or similar channels for asynchronous conversation. Adding Discussions introduces another place to check without a clear advantage over existing tools. Adopt Discussions when you have a community that could benefit from a searchable, public forum, and skip them when you have a small, coordinated team with existing communication channels.

### Wikis

GitHub Wikis offer a simple documentation space attached to a repository. Each page is a Markdown file, and the wiki has its own git repository that can be cloned separately. The appeal is that documentation lives close to the code.

In practice, wikis suffer from discoverability and maintenance problems. They sit outside the normal PR review workflow, which means changes happen without code review, leading to outdated or inconsistent content. Teams that care about documentation quality tend to move documentation into the repository itself (a `docs/` directory) and treat documentation changes the same as code changes: reviewed via PR, subject to the same CI checks, and version-controlled alongside the code they describe.

A wiki can get a project some basic documentation quickly. When documentation quality and accuracy matter, the repository itself is the better home.

---

## GitHub CLI

The [GitHub CLI](https://cli.github.com/){:target="_blank" rel="noopener noreferrer"} (`gh`) brings the most common GitHub workflows into the terminal. For developers who spend most of their time in the command line, `gh` removes the context switch to the browser for routine tasks: creating and checking out pull requests, reviewing and merging them, filing and closing issues, and watching workflow runs. For workflows the built-in commands don't cover, `gh api` calls the GitHub REST and GraphQL APIs directly, so anything the web interface can do can also be scripted.
