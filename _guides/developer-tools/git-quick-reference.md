---
title: "Git CLI Quick Reference"
layout: guide
category: Developer Tools
subcategory: Git Fundamentals
description: "A scannable quick reference for common git commands organized by task, with links to the source guides for full explanations."
tags: [git, version-control, developer-tools, fundamentals, practical]
---

This guide is a fast-lookup companion to the full Git study guides. Commands are organized by what you are trying to do, not by which guide they appear in. Each section links to the source guide where the concepts are explained in depth. For GitHub CLI commands, see the [GitHub CLI Quick Reference](/study-guides/developer-tools/github-quick-reference.html).

---

## Creating and Cloning Repositories

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
git init                                             # create new repo in current directory
git clone https://github.com/user/repo.git           # clone a remote repo
git clone https://github.com/user/repo.git my-dir    # clone into a specific directory
git clone --recurse-submodules https://github.com/org/repo.git  # clone with submodules
```

---

## Checking Status and Viewing History

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
# Status
git status                                           # current state of working tree
git status -s                                        # short format

# Log
git log                                              # full commit history
git log --oneline                                    # one line per commit
git log --oneline --graph --all                      # visual branch graph
git log -5                                           # last 5 commits
git log -p                                           # show diff for each commit
git log --oneline -- path/to/file.cs                 # history of a specific file
git log --follow -p src/OldName.cs                   # history including renames
git log --oneline main..feature/foo                  # commits on feature not on main

# Inspecting objects
git cat-file -p <hash>                               # read any git object
git cat-file -p HEAD^{tree}                          # list tree at a commit
git show v1.0.0                                      # show tag or commit details
```

---

## Staging and Committing

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
# Staging
git add src/MyClass.cs                               # stage a specific file
git add .                                            # stage everything in current dir and below
git add -u                                           # stage all tracked file changes (not new files)
git add -p src/MyClass.cs                            # stage specific hunks interactively

# Committing
git commit -m "your message"                         # commit staged changes
git commit -am "your message"                        # stage tracked changes + commit in one step
git commit --amend -m "corrected message"            # amend the last commit (rewrites history)
```

---

## Viewing Differences

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
git diff                                             # unstaged changes (working dir vs index)
git diff --staged                                    # staged changes (index vs HEAD)
git diff abc1234 def5678                             # compare two commits
git diff main..feature/my-work                       # compare two branches
git diff --name-only main..feature/my-work           # only show which files differ
```

---

## Branching

*Full coverage: [Git Branching Strategies](/study-guides/developer-tools/git-branching-strategies.html)*

```bash
# Listing
git branch                                           # local branches
git branch -a                                        # all branches including remotes

# Creating and switching
git switch -c feature/my-work                        # create + switch (modern, Git 2.23+)
git checkout -b feature/my-work                      # create + switch (classic)
git switch main                                      # switch to existing branch
git switch -c hotfix/fix-bug v2.3.1                  # branch from specific tag/commit

# Deleting
git branch -d feature/my-work                        # delete (safe, checks merge status)
git branch -D feature/my-work                        # force delete
git push origin --delete feature/old-branch          # delete remote branch
```

---

## Merging

*See [Git Branching Strategies](/study-guides/developer-tools/git-branching-strategies.html) for full coverage.*

```bash
git merge feature                                    # merge into current branch
git merge --no-ff feature                            # force merge commit (no fast-forward)
git merge --squash feature                           # squash all commits into one, then commit

# After a squash merge you must commit manually
git commit -m "add feature X"

# Resolving merge conflicts
git add src/ConflictingFile.cs                       # mark file as resolved
git commit                                           # complete the merge
```

---

## Rebasing

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git rebase main                                      # replay current branch on top of main
git rebase origin/main                               # rebase onto remote main

# Interactive rebase (reorder, squash, edit, drop commits)
git rebase -i HEAD~4                                 # last 4 commits
git rebase -i main                                   # everything since branching from main

# During rebase conflict resolution
git add <resolved-file>
git rebase --continue                                # proceed after resolving
git rebase --abort                                   # cancel and return to pre-rebase state
```

---

## Remote Operations

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
# Managing remotes
git remote -v                                        # list remotes with URLs
git remote add upstream https://github.com/org/repo.git
git remote rename origin old-origin
git remote remove upstream

# Fetch, pull, push
git fetch origin                                     # download without merging
git pull                                             # fetch + merge (or rebase if configured)
git pull --rebase                                    # fetch + rebase
git push                                             # push current branch
git push -u origin feature/my-work                   # push and set upstream tracking
git push origin local-branch:remote-branch           # push specific branch mapping
```

---

## Tags

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
# Creating
git tag v1.0.0                                       # lightweight tag at HEAD
git tag v0.9.0 abc1234                               # lightweight tag at specific commit
git tag -a v1.0.0 -m "Release 1.0.0"                # annotated tag (recommended for releases)
git tag -s v1.0.0 -m "Release 1.0.0"                # signed tag (GPG)

# Listing and inspecting
git tag                                              # list all tags
git tag -l "v1.*"                                    # filter by pattern
git show v1.0.0                                      # show tag details
git tag -v v1.0.0                                    # verify signed tag

# Pushing and deleting
git push origin v1.0.0                               # push a specific tag
git push origin --tags                               # push all tags
git tag -d v1.0.0                                    # delete locally
git push origin --delete v1.0.0                      # delete on remote
```

---

## Stashing

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git stash                                            # save uncommitted changes
git stash push -m "WIP: refactoring payments"        # save with a descriptive name
git stash push --include-untracked                   # include new files
git stash push --all                                 # include untracked and ignored files
git stash push -p                                    # interactively choose hunks to stash

# Applying
git stash pop                                        # apply most recent + remove from list
git stash apply                                      # apply most recent, keep in list
git stash apply stash@{2}                            # apply a specific stash

# Managing
git stash list                                       # list all stashes
git stash show -p stash@{0}                          # show diff of a stash
git stash drop stash@{1}                             # remove a specific stash
git stash clear                                      # remove all stashes
git stash branch feature/recovered stash@{0}         # create branch from stash
```

---

## Cherry-Picking

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git cherry-pick <commit-hash>                        # apply a single commit
git cherry-pick abc123..def456                       # apply a range (exclusive of abc123)
git cherry-pick abc123 def456 ghi789                 # apply specific commits
git cherry-pick --no-commit <commit-hash>            # apply changes without committing
```

---

## Bisect (Finding Bugs)

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git bisect start                                     # begin binary search
git bisect bad                                       # mark current commit as broken
git bisect good v2.1.0                               # mark a known-good commit
# Git checks out the midpoint; test it, then:
git bisect good                                      # this commit works
git bisect bad                                       # this commit is broken
git bisect skip                                      # can't test this one, skip it
git bisect reset                                     # done, return to original HEAD

# Automated bisect with a test script
git bisect run ./scripts/test-for-bug.sh
```

---

## Undoing Changes

*See [Git Core Concepts](/study-guides/developer-tools/git-core-concepts.html) for full coverage.*

```bash
# Unstage a file (keep working directory changes)
git restore --staged src/MyClass.cs

# Discard working directory changes (destructive)
git restore src/MyClass.cs

# Revert a commit (creates a new commit that undoes changes)
git revert abc1234                                   # revert a specific commit
git revert HEAD                                      # revert the last commit
git revert HEAD~3..HEAD                              # revert a range
git revert --no-commit HEAD~3..HEAD                  # revert without auto-committing
```

---

## Reflog and Recovery

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git reflog                                           # show recent HEAD movements
git reflog show feature/my-branch                    # reflog for a specific branch

# Recover a lost commit or branch
git checkout -b recovery-branch <hash>               # create branch at lost commit
git branch recovery-branch e3a12ec                   # same, without switching to it
```

---

## Worktrees

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git worktree add ../my-app-hotfix hotfix/bug         # check out branch in separate directory
git worktree add -b feature/new ../my-app-new main   # create new branch in separate directory
git worktree list                                    # see all active worktrees
git worktree remove ../my-app-hotfix                 # clean up a worktree
```

---

## Submodules and Subtrees

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
# Submodules
git submodule update --init --recursive              # initialize after cloning
git submodule update --remote                        # update to latest upstream

# Subtrees
git subtree add --prefix=libs/shared <url> main --squash
git subtree pull --prefix=libs/shared <url> main --squash
git subtree push --prefix=libs/shared <url> main
```

---

## Git LFS (Large File Storage)

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
git lfs install                                      # one-time setup
git lfs track "*.psd"                                # track a file type
git lfs track "assets/large-data/*.csv"              # track by path pattern
git add .gitattributes                               # stage the LFS config
git lfs track                                        # list tracked patterns
git lfs ls-files                                     # list LFS objects in current commit
git lfs pull                                         # fetch actual binary content
```

---

## Git Hooks

*See [Git Advanced Operations](/study-guides/developer-tools/git-advanced-operations.html) for full coverage.*

```bash
mkdir .githooks                                      # create shared hooks directory
cp pre-commit-script.sh .githooks/pre-commit         # add your hook
chmod +x .githooks/pre-commit                        # make it executable
git config core.hooksPath .githooks                  # point Git at your hooks
```

---

## Common Multi-Step Workflows

### Start a Feature (GitHub Flow)

```bash
git switch -c feature/my-feature main
# ... make changes ...
git add src/Feature.cs tests/FeatureTests.cs
git commit -m "implement feature"
git push -u origin feature/my-feature
gh pr create --title "Add my feature" --body "Description here"
```

### Keep a Feature Branch Up to Date

```bash
git fetch origin
git rebase origin/main
# resolve conflicts if any, then:
git add <resolved-files>
git rebase --continue
```

### Squash Messy Commits Before Merging

```bash
git rebase -i main
# in the editor: mark commits as 'squash' or 'fixup'
# save and edit the combined commit message
git push --force-with-lease                          # update remote (rewrites history)
```

### Hotfix on a Release

```bash
git switch -c hotfix/fix-bug main
# ... fix the bug ...
git add src/BugFix.cs
git commit -m "fix: null check on payment path"
git push -u origin hotfix/fix-bug
gh pr create --title "Hotfix: payment null check" --body "Fixes #200"
```

### Backport a Fix with Cherry-Pick

```bash
git switch release/2.3
git cherry-pick <commit-hash-from-main>
git push origin release/2.3
```

### Recover from Committing to the Wrong Branch

```bash
# you committed to main by mistake
git branch feature/my-work                           # save commit on a new branch
git reset --hard origin/main                         # reset main to remote state
git switch feature/my-work                           # continue on the correct branch
```

### Undo a Pushed Commit Safely

```bash
git revert HEAD                                      # create a reverting commit
git push
```

### Recover a Deleted Branch

```bash
git reflog | grep 'feature/deleted-branch'           # find the last commit hash
git checkout -b feature/deleted-branch <hash>        # recreate the branch
```

### Split a Commit into Multiple Commits

```bash
git rebase -i HEAD~3                                 # mark the target commit as 'edit'
git reset HEAD^                                      # undo the commit, keep changes
git add path/to/first-change.cs
git commit -m "feat: add payment model"
git add path/to/second-change.cs
git commit -m "feat: add payment validation"
git rebase --continue
```

### Stash, Switch, and Return

```bash
git stash push -m "WIP: halfway through refactor"
git switch main
# ... do other work, commit, etc. ...
git switch feature/my-work
git stash pop
```

### GitFlow Release Cycle

```bash
# Cut release from develop
git switch -c release/2.4.0 develop

# Finish release
git switch main
git merge --no-ff release/2.4.0
git tag -a v2.4.0 -m "Release 2.4.0"
git switch develop
git merge --no-ff release/2.4.0
git branch -d release/2.4.0
```
