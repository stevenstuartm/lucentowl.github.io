---
title: "GitHub CLI Quick Reference"
layout: resource
type: cheatsheet
category: "Developer Tools"
description: "GitHub CLI (gh) commands for pull requests, issues, repositories, Actions runs, secrets and variables, releases, rulesets, and administration through gh api, plus multi-step recipes for common workflows."
last_updated: 2026-09-23
tags: [github, gh-cli, pull-requests, issues, github-actions, releases]
related_guides:
  - /study-guides/developer-tools/github-collaboration.html
  - /study-guides/developer-tools/github-actions.html
  - /study-guides/developer-tools/github-administration-security.html
---

Commands grouped by what you are trying to do. For plain git commands, see the [Git CLI Quick Reference](/resources/git-quick-reference.html).

---

## Authentication and Setup

```bash
gh auth login                                        # authenticate with GitHub
gh auth status                                       # check current auth state
gh auth setup-git                                    # let git use gh's credentials for HTTPS
gh repo set-default                                  # set default repo for current directory
```

---

## Pull Requests

```bash
# Creating
gh pr create --title "Add retry logic" --body "Closes #88"
gh pr create --fill                                  # title and body from the commits
gh pr create --draft --title "WIP: Refactor payments"
gh pr ready 123                                      # mark a draft ready for review

# Viewing
gh pr list                                           # list open PRs
gh pr view 123                                       # view PR details in terminal
gh pr view 123 --web                                 # open in browser
gh pr status                                         # PRs you created, are reviewing, or are on
gh pr diff 123                                       # show the PR's diff
gh pr checks                                         # check CI status on your PR
gh pr checks --watch                                 # wait until checks finish

# Working locally
gh pr checkout 123                                   # check out a PR as a local branch

# Reviewing
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Add tests for the error path"

# Merging
gh pr merge 123 --squash --delete-branch             # squash merge and clean up
gh pr merge 123 --auto --squash                      # merge once required checks pass
```

---

## Issues

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

```bash
gh repo clone org/repo                               # clone a repository
gh repo fork org/repo --clone                        # fork and clone in one step
gh repo create org/new-repo --private --clone        # create a repository and clone it
gh repo view --web                                   # open the current repository in a browser
```

---

## Workflow Runs (CI/CD)

```bash
gh run list                                          # recent workflow runs
gh run list --workflow=deploy.yml                    # runs of one workflow
gh run watch                                         # watch a run as it progresses
gh run view --log-failed                             # view logs of a failed run
gh run rerun 1234567890 --failed                     # re-run only the failed jobs
gh workflow run deploy.yml -f environment=staging    # trigger a workflow_dispatch run with inputs
gh workflow list                                     # workflows in the repository
```

---

## Secrets, Variables, and Caches

```bash
gh secret set DEPLOY_TOKEN                           # prompts for the value (keeps it out of history)
gh secret set DEPLOY_TOKEN --env production          # environment-scoped secret
gh secret set NPM_TOKEN --org my-org --repos app,api # org secret shared with specific repos
gh secret list
gh variable set BUILD_CONFIGURATION --body Release   # non-secret configuration value
gh variable list
gh cache list                                        # Actions caches for the repository
gh cache delete --all                                # clear caches when a bad one sticks
```

---

## Releases

```bash
gh release create v1.2.0 --title "v1.2.0" --notes "Bug fixes and performance improvements"
gh release create v1.2.0 --generate-notes ./dist/*.zip  # notes from merged PRs, with assets
gh release list                                      # list recent releases
gh release view v1.2.0                               # view release details
```

---

## Aliases

```bash
gh alias set my-prs 'pr list --assignee @me'         # create a shortcut
gh my-prs                                            # use the alias
```

---

## Organization and Team Management

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

```bash
# Default branch
gh api repos/YOUR_ORG/YOUR_REPO \
  --method PATCH \
  --field default_branch="main"                      # set default branch

# Branch protection and rulesets
gh api repos/YOUR_ORG/YOUR_REPO/branches/main/protection  # view classic protection rules
gh ruleset list                                      # rulesets that apply to the repository
gh ruleset view 42                                   # details of one ruleset
gh ruleset check main                                # every rule that applies to a branch
```

---

## Security and Compliance

```bash
# SAML SSO (Enterprise Cloud)
gh api orgs/YOUR_ORG/credential-authorizations       # tokens and keys authorized for SSO

# Audit logs (REST API requires Enterprise Cloud)
gh api "/orgs/YOUR_ORG/audit-log?phrase=action:repo.destroy&per_page=100"
```

---

## Direct API Access

The `gh api` command gives you direct access to any GitHub REST or GraphQL endpoint. Use it for operations not covered by built-in commands.

```bash
# REST examples
gh api repos/owner/repo/pulls/123/comments           # view PR comments
gh api repos/owner/repo --method PATCH --field name="new-name"
gh api --paginate repos/owner/repo/issues            # follow every page of results

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
gh run rerun <run-id> --failed                       # retry just the failed jobs
```

### Create a Release

```bash
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
gh release create v1.2.0 --title "v1.2.0" --generate-notes
```
