---
title: "GitHub CLI Quick Reference"
layout: guide
category: Developer Tools
subcategory: GitHub
description: "A scannable quick reference for the GitHub CLI (gh), covering pull requests, issues, workflows, releases, org administration, and common multi-step workflows."
tags: [github, git, developer-tools, collaboration, devops, practical]
---

This guide is a fast-lookup companion to the full GitHub study guides. Commands are organized by what you are trying to do. Each section links to the source guide where the concepts are explained in depth. For git commands, see the [Git CLI Quick Reference](/study-guides/developer-tools/git-quick-reference.html).

## Authentication and Setup

*See [GitHub Collaboration](/study-guides/developer-tools/github-collaboration.html) for full coverage.*

```bash
gh auth login                                        # authenticate with GitHub
gh auth status                                       # check current auth state
gh repo set-default                                  # set default repo for current directory
```

---

## Pull Requests

*See [GitHub Collaboration](/study-guides/developer-tools/github-collaboration.html) for full coverage.*

```bash
# Creating
gh pr create --title "Add retry logic" --body "Closes #88"
gh pr create --draft --title "WIP: Refactor payments"

# Viewing
gh pr list                                           # list open PRs
gh pr view 123                                       # view PR details in terminal
gh pr view 123 --web                                 # open in browser
gh pr checks                                         # check CI status on your PR

# Working locally
gh pr checkout 123                                   # check out a PR as a local branch

# Reviewing
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Add tests for the error path"

# Merging
gh pr merge 123 --squash --delete-branch             # squash merge and clean up
gh pr merge --auto --squash "$PR_URL"                # enable auto-merge when checks pass
```

---

## Issues

*See [GitHub Collaboration](/study-guides/developer-tools/github-collaboration.html) for full coverage.*

```bash
# Creating
gh issue create --title "Timeout on checkout" --body "504 at peak load" --label "bug,priority: high"

# Viewing and filtering
gh issue list                                        # list open issues
gh issue list --label "priority: high"               # filter by label
gh issue view 88                                     # view issue details

# Managing
gh issue close 88 --comment "Fixed in #91"
gh issue reopen 88
```

---

## Repositories

*See [GitHub Collaboration](/study-guides/developer-tools/github-collaboration.html) for full coverage.*

```bash
gh repo clone org/repo                               # clone a repository
gh repo fork org/repo --clone                        # fork and clone in one step
```

---

## Workflow Runs (CI/CD)

*See [GitHub Actions](/study-guides/developer-tools/github-actions.html) for full coverage.*

```bash
gh run list                                          # recent workflow runs
gh run watch                                         # watch a run in real time
gh run view --log-failed                             # view logs of a failed run
```

---

## Releases

*See [GitHub Collaboration](/study-guides/developer-tools/github-collaboration.html) for full coverage.*

```bash
gh release create v1.2.0 --title "v1.2.0" --notes "Bug fixes and performance improvements"
gh release list                                      # list recent releases
gh release view v1.2.0                               # view release details
```

---

## Aliases

*See [GitHub Collaboration](/study-guides/developer-tools/github-collaboration.html) for full coverage.*

```bash
gh alias set my-prs 'pr list --assignee @me'         # create a shortcut
gh my-prs                                            # use the alias
```

---

## Organization and Team Management

*See [GitHub Administration and Security](/study-guides/developer-tools/github-administration-security.html) for full coverage.*

```bash
# Organizations
gh org list                                          # list your organizations
gh api orgs/YOUR_ORG                                 # view org settings

# Teams
gh api orgs/YOUR_ORG/teams \
  --method POST \
  --field name="backend-engineers" \
  --field privacy="closed"                           # create a team

gh api orgs/YOUR_ORG/teams/backend-engineers/memberships/USERNAME \
  --method PUT \
  --field role="member"                              # add member to team
```

---

## Repository Administration

*See [GitHub Administration and Security](/study-guides/developer-tools/github-administration-security.html) for full coverage.*

```bash
# Default branch
gh api repos/YOUR_ORG/YOUR_REPO \
  --method PATCH \
  --field default_branch="main"                      # set default branch

# Branch protection
gh api repos/YOUR_ORG/YOUR_REPO/branches/main/protection  # view protection rules
```

---

## Security and Compliance

*See [GitHub Administration and Security](/study-guides/developer-tools/github-administration-security.html) for full coverage.*

```bash
# SAML SSO
gh api orgs/YOUR_ORG/credential-authorizations       # check SSO status

# Audit logs
gh api "/orgs/YOUR_ORG/audit-log?phrase=action:repo.destroy&per_page=100"
```

---

## Direct API Access

The `gh api` command gives you direct access to any GitHub REST or GraphQL endpoint. Use it for operations not covered by built-in commands.

```bash
# REST examples
gh api repos/owner/repo/pulls/123/comments           # view PR comments
gh api repos/owner/repo --method PATCH --field name="new-name"

# GraphQL example
gh api graphql -f query='{ viewer { login } }'
```

---

## Common Multi-Step Workflows

### Create a Feature PR (GitHub Flow)

```bash
git switch -c feature/my-feature main
# ... make changes ...
git add src/Feature.cs tests/FeatureTests.cs
git commit -m "implement feature"
git push -u origin feature/my-feature
gh pr create --title "Add my feature" --body "Description here"
```

### Review and Merge a PR Locally

```bash
gh pr checkout 123                                   # check out the PR
# ... test locally ...
gh pr review 123 --approve
gh pr merge 123 --squash --delete-branch
```

### Create a Hotfix PR

```bash
git switch -c hotfix/fix-bug main
# ... fix the bug ...
git add src/BugFix.cs
git commit -m "fix: null check on payment path"
git push -u origin hotfix/fix-bug
gh pr create --title "Hotfix: payment null check" --body "Fixes #200"
```

### Triage Issues by Label

```bash
gh issue list --label "bug" --label "priority: high"
gh issue view 88
gh issue close 88 --comment "Resolved in PR #91"
```

### Monitor a Deployment

```bash
gh run list --workflow=deploy.yml                    # list deployment runs
gh run watch                                         # watch current run
gh run view --log-failed                             # debug if it fails
```

### Create a Release

```bash
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
gh release create v1.2.0 --title "v1.2.0" --notes "Bug fixes and performance improvements"
```
