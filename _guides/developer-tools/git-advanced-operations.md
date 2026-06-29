---
title: "Git Advanced Operations"
layout: guide
category: Developer Tools
subcategory: Git Fundamentals
description: "Beyond the basics: interactive rebase, cherry-pick, bisect, reflog, stashing, submodules, hooks, Git LFS, and disaster recovery techniques for confident Git usage."
tags: [git, version-control, advanced, practical, developer-tools]
---

## Table of Contents

- [Interactive Rebase](#interactive-rebase)
- [Cherry-Picking](#cherry-picking)
- [Bisect: Binary Search for Bugs](#bisect-binary-search-for-bugs)
- [Reflog: Your Safety Net](#reflog-your-safety-net)
- [Stashing](#stashing)
- [Worktrees](#worktrees)
- [Submodules, Subtrees, and Monorepos](#submodules-subtrees-and-monorepos)
- [Git Hooks](#git-hooks)
- [Git LFS](#git-lfs)
- [Disaster Recovery](#disaster-recovery)

---

## Interactive Rebase

Interactive rebase is one of the most powerful tools in Git for cleaning up a messy commit history before merging or sharing work. The core idea is simple: you're replaying your commits, but this time you decide exactly what happens to each one.

You invoke it by telling Git how far back you want to go:

```bash
# Rebase the last 4 commits interactively
git rebase -i HEAD~4

# Rebase everything since branching from main
git rebase -i main
```

Git opens your configured editor with a list of commits, oldest at the top:

```
pick a1b2c3d Add user authentication middleware
pick e4f5g6h Fix typo in error message
pick i7j8k9l Add unit tests for auth
pick m0n1o2p WIP: debugging session cruft
```

Each line starts with a command. You change those commands to control what happens:

- `pick` — keep the commit as-is
- `squash` (or `s`) — merge this commit into the one above it, combining their messages
- `fixup` (or `f`) — same as squash, but discard this commit's message
- `reword` (or `r`) — keep the commit but edit its message
- `edit` (or `e`) — pause the rebase here so you can amend the commit
- `drop` (or `d`) — delete the commit entirely
- `reorder` — just move the lines to change the order commits are applied

A common workflow is to squash WIP commits before merging a feature branch:

```
pick a1b2c3d Add user authentication middleware
squash e4f5g6h Fix typo in error message
squash i7j8k9l Add unit tests for auth
drop m0n1o2p WIP: debugging session cruft
```

This collapses the first three into a single clean commit and throws away the WIP commit entirely. Here's what happens visually:

```
  BEFORE rebase (4 messy commits):

  main: ... ── X
                \
  feature:       A ── B ── C ── D
                 │    │    │    │
                 │    │    │    └── m0n1o2p WIP: debugging session cruft
                 │    │    └─────── i7j8k9l Add unit tests for auth
                 │    └──────────── e4f5g6h Fix typo in error message
                 └───────────────── a1b2c3d Add user authentication middleware


  AFTER rebase -i (squash B+C into A, drop D):

  main: ... ── X
                \
  feature:       A'
                 │
                 └── 7f8e9d2 Add user authentication middleware
                     (contains all changes from A + B + C,
                      new SHA because history was rewritten)
```

When you save and close the editor, Git walks through the list, pausing when it needs your input (like when combining commit messages after a squash).

If a rebase hits a conflict, Git pauses and lets you resolve it:

```bash
# After resolving conflicts in the affected files:
git add <conflicted-file>
git rebase --continue

# Or bail out entirely and return to where you started:
git rebase --abort
```

**When to rebase and when not to.** Interactive rebase rewrites history. That means it generates new commit hashes for every commit it touches. On a private branch that only you use, this is completely safe and highly recommended for producing a coherent history. On a branch that others have checked out and are building on, rebasing is destructive because you are changing the history they based their work on. The rule is simple: never rebase commits that have been pushed to a shared branch. Main, develop, and any branch other team members are actively using are off-limits.

---

## Cherry-Picking

Cherry-picking lets you copy a single commit (or a range of commits) from one branch and apply it to another. The name is apt: you're reaching into a branch's history and pulling out exactly the commit you want.

```bash
# Apply a specific commit to the current branch
git cherry-pick <commit-hash>

# Apply a range of commits (exclusive of start, inclusive of end)
git cherry-pick abc123..def456

# Apply multiple specific commits
git cherry-pick abc123 def456 ghi789

# Cherry-pick without automatically committing (lets you review/modify first)
git cherry-pick --no-commit <commit-hash>
```

The most legitimate use case for cherry-pick is backporting a bug fix to a release branch. You have a fix committed to main, and you need that same fix on the `release/2.3` branch without merging all of main into it. Cherry-pick is the right tool for this.

```bash
git checkout release/2.3
git cherry-pick abc123def  # the fix commit from main
```

Git creates a new commit on `release/2.3` with the same changes but a different hash. The two commits are related by their content, not by any Git ancestry relationship.

**When not to cherry-pick.** Cherry-pick becomes a liability when used as a substitute for proper branch management. Picking the same logical change across many branches means you now have multiple commit hashes representing the "same" fix, and Git has no way to know they're related. This creates confusion when merging: the changes may conflict, or Git may try to apply the same logical change twice. If you find yourself cherry-picking the same commit repeatedly, that's a signal to think about your branching model instead.

Cherry-pick can also create situations where a commit's context is missing on the target branch. If commit B depends on changes from commit A, and you only pick B, you may get a confusing partial application or a conflict.

---

## Bisect: Binary Search for Bugs

`git bisect` is a debugging tool that uses binary search to find the exact commit that introduced a bug. Instead of manually checking out commits one by one, Git does the math for you: with 1,000 commits to search, bisect finds the culprit in at most 10 steps.

The workflow starts by telling Git the boundaries of the search:

```bash
# Start the bisect session
git bisect start

# Tell Git a commit where the bug exists (usually HEAD or a recent commit)
git bisect bad

# Tell Git a commit where things were known good
git bisect good v2.1.0
```

Git checks out the commit exactly halfway between good and bad. You test whether the bug exists in that state, then tell Git the result:

```bash
# If the bug is present at this commit:
git bisect bad

# If the bug is not present at this commit:
git bisect good
```

Git keeps halving the search space. With 1,000 commits, the search looks like this:

```
  1,000 commits between good and bad

  Round 1:  Test commit #500 (midpoint)
            Result: bad ──► search narrows to commits 1-500

  Round 2:  Test commit #250
            Result: good ──► search narrows to commits 250-500

  Round 3:  Test commit #375
            Result: bad ──► search narrows to commits 250-375

  Round 4:  Test commit #312
            Result: good ──► search narrows to commits 312-375

  ...continues halving...

  Round 10: Test commit #347
            Result: bad ──► commit #347 is the first bad commit!

  1,000 commits searched in 10 steps (log₂ 1000 ≈ 10)
  vs. checking each commit one by one: up to 1,000 steps
```

Until it identifies the first bad commit:

```
b5e4a3c2 is the first bad commit
```

When you're done, clean up by returning to your original HEAD:

```bash
git bisect reset
```

**Automating bisect.** If you have a test script that returns exit code 0 for "good" and non-zero for "bad", you can let Git run the entire bisect automatically:

```bash
git bisect start
git bisect bad HEAD
git bisect good v2.1.0
git bisect run ./scripts/test-for-bug.sh
```

Git will check out each candidate commit, run your script, interpret the exit code, and continue until it finds the culprit with no interaction required. This is especially useful for performance regressions or subtle behavioral bugs where the test is mechanical but the number of commits to search is large.

A few things to watch for: if a commit fails to compile or has test infrastructure issues unrelated to your bug, mark it as `skip` rather than good or bad:

```bash
git bisect skip
```

This tells Git to try a nearby commit instead. If you skip too many commits, bisect may not be able to narrow things down completely, but it will report the range of suspicious commits.

---

## Reflog: Your Safety Net

The reflog is Git's internal journal. Every time a reference changes (a commit, a checkout, a rebase, a reset), Git records the old and new state of that reference in the reflog. This makes it possible to recover from almost any mistake, including ones that seem catastrophic.

```bash
# View the reflog for HEAD
git reflog

# View the reflog for a specific branch
git reflog show feature/my-branch
```

The output looks like this:

```
abc123d (HEAD -> main) HEAD@{0}: commit: Add payment processing
e4f5g6h HEAD@{1}: rebase (finish): returning to refs/heads/main
i7j8k9l HEAD@{2}: rebase (pick): Fix validation error
m0n1o2p HEAD@{3}: checkout: moving from feature/payments to main
q2r3s4t HEAD@{4}: commit: WIP: payment integration
```

Each entry is a snapshot in time. The `HEAD@{N}` syntax lets you reference any of them.

**Recovering lost commits.** If you accidentally ran `git reset --hard` and lost commits you needed, or if a branch was deleted before its commits were merged, the reflog holds the answer. Find the commit hash from the reflog output and create a new branch pointing to it:

```bash
# Recover a lost commit
git checkout -b recovery-branch abc123d

# Or just reset your current branch to that point
git reset --hard abc123d
```

**Recovering a deleted branch.** Deleting a branch doesn't delete the commits, it just removes the label. The reflog will show when you were last on that branch:

```bash
git reflog | grep 'feature/deleted-branch'
# Find the last commit hash for that branch, then:
git checkout -b feature/deleted-branch <that-hash>
```

Reflog entries don't last forever. Git's garbage collector eventually prunes old entries, but the default retention is 90 days for reachable objects and 30 days for unreachable ones. In practice, this means the reflog covers anything you've done in the last few months.

---

## Stashing

Stashing is a way to save your working state temporarily without committing it. The canonical use case is when you're mid-task and need to switch to another branch urgently: stash your changes, switch branches, do the urgent work, come back, and pop your stash.

```bash
# Save all tracked changes (staged and unstaged) to the stash
git stash

# Save with a descriptive name
git stash push -m "WIP: refactoring payment module"

# Include untracked files as well
git stash push --include-untracked

# Include both untracked and ignored files
git stash push --all
```

Retrieving stashed work:

```bash
# Apply the most recent stash and remove it from the stash list
git stash pop

# Apply the most recent stash but keep it in the stash list
git stash apply

# Apply a specific stash by index
git stash apply stash@{2}

# See all stashes
git stash list

# See the diff of a specific stash
git stash show -p stash@{0}
```

Stash management:

```bash
# Remove a specific stash
git stash drop stash@{1}

# Clear all stashes
git stash clear

# Create a branch from a stash (useful when the stash conflicts with current state)
git stash branch feature/recovered-work stash@{0}
```

**Partial stashing.** Sometimes you only want to stash some of your changes, not all of them. The `-p` (patch) flag lets you interactively select which hunks to stash:

```bash
git stash push -p
```

Git shows you each changed hunk and asks what to do: stash it (`y`), skip it (`n`), quit (`q`), or split it into smaller pieces (`s`). This gives you precise control when you're partway through two logically separate changes and need to separate them.

One thing to be aware of: stashes are local. They don't get pushed to the remote, so they won't survive a machine change. If you need to transfer uncommitted work between machines, a WIP commit is more reliable than a stash.

---

## Worktrees

Normally, a Git repository has one working directory. You're on `main`, you want to look at `hotfix/payment-bug`, so you stash your work, switch branches, do the work, switch back, and pop your stash. Worktrees eliminate that dance entirely by letting you have multiple working directories for the same repository, each checked out to a different branch.

Think of it like having multiple desks in the same office. Each desk has its own set of papers spread out (a different branch), but they all share the same filing cabinet (your `.git` directory with all the commits, objects, and history). You can walk between desks without cleaning up first.

### How the Filesystem Looks

Here's what your filesystem looks like before and after creating a worktree:

```
BEFORE (normal single worktree):

  ~/projects/
    my-app/                  <-- your one and only working directory
      .git/                  <-- the shared repository database
      src/
      README.md
      (checked out: main)


AFTER running: git worktree add ../my-app-hotfix hotfix/payment-bug

  ~/projects/
    my-app/                  <-- original working directory (still on main)
      .git/                  <-- the shared repository database
      src/
      README.md
      (checked out: main)

    my-app-hotfix/           <-- NEW working directory (separate folder!)
      .git  (file, not dir)  <-- tiny file that points back to my-app/.git/
      src/
      README.md
      (checked out: hotfix/payment-bug)
```

Both directories are fully functional. You can open `my-app/` in one editor window and `my-app-hotfix/` in another. You can run tests in one while coding in the other. They share the same commit history, the same branches, and the same remote configuration because they share the same `.git` database. But each has its own working files, its own staged changes, and its own checked-out branch.

The new worktree directory contains a `.git` *file* (not a directory) that simply points back to the original `.git/` directory. This is why worktrees are much lighter than cloning the repository again.

### Creating and Managing Worktrees

```bash
# Add a worktree checked out to an existing branch
git worktree add ../my-app-hotfix hotfix/payment-bug

# Add a worktree and create a new branch at the same time (branching from main)
git worktree add -b feature/new-dashboard ../my-app-dashboard main

# See all active worktrees
git worktree list
# /home/you/projects/my-app             abc1234 [main]
# /home/you/projects/my-app-hotfix      def5678 [hotfix/payment-bug]
# /home/you/projects/my-app-dashboard   abc1234 [feature/new-dashboard]

# Remove a worktree when you're done (deletes the directory too)
git worktree remove ../my-app-hotfix
```

One rule to know: two worktrees cannot check out the same branch at the same time. If `main` is checked out in your primary worktree, you can't also check out `main` in a second worktree. This prevents conflicting changes to the same branch from two locations.

### When Worktrees Solve Real Problems

**Reviewing a PR while mid-task.** You're deep in a feature branch with files open everywhere. A teammate asks you to review their PR. Instead of stashing, switching branches, reviewing, switching back, and popping your stash, you create a worktree:

```bash
git worktree add ../review-pr teammate/auth-refactor
# open ../review-pr in a second editor, review the code, then clean up:
git worktree remove ../review-pr
```

Your feature branch workspace is untouched the entire time.

**Running tests on one branch while developing on another.** Long test suites don't have to block your work. Run the tests in a worktree while you keep coding in the main directory:

```
  Terminal 1 (my-app/):        Terminal 2 (my-app-tests/):
  ┌──────────────────────┐     ┌──────────────────────┐
  │ Editing code on       │     │ Running test suite    │
  │ feature/new-dashboard │     │ on main branch        │
  │                       │     │                       │
  │ > vim src/Dashboard.cs│     │ > dotnet test         │
  │                       │     │ Passed: 847           │
  │                       │     │ Failed: 0             │
  └──────────────────────┘     └──────────────────────┘
         Both share the same .git database
```

**Comparing behavior between branches.** If you need to run the same application on two branches side by side (maybe to compare a performance change or a UI difference), worktrees let you do that without juggling stashes or making throwaway commits.

### Worktrees vs. Cloning Again

You could achieve something similar by cloning the repository a second time, but worktrees are better for a few reasons. They share the object database, so there's no duplicate storage. A commit you make in one worktree is immediately visible from the other (no need to push and pull). And branch tracking stays unified, so you can't accidentally diverge your two copies.

---

## Submodules, Subtrees, and Monorepos

When one repository needs to include code from another, teams reach for one of three approaches: submodules, subtrees, or a dedicated monorepo tooling layer. Each has a distinct model with its own trade-offs.

| | Submodules | Subtrees | Monorepo Tooling |
|---|---|---|---|
| How code is stored | Pointer to another repo at a specific commit | Copy of the other repo's history merged in | All code lives in one repo natively |
| Contributor experience | Requires extra `git submodule` commands | Works with standard Git commands | Depends on tool (Nx, Turborepo, etc.) |
| History | Separate, main repo tracks a commit hash | Merged, full history present | Unified, all history in one place |
| Updates | Manual, maintainer must bump the pointer | Explicit pull using `git subtree pull` | No concept of "updating a dependency" |
| CI complexity | Must clone with `--recurse-submodules` | Standard clone is sufficient | May need build-graph-aware orchestration |
| Good fit | Dependency you don't frequently change | Shared library with occasional syncs | Large codebases with many related packages |

**Submodules** treat a dependency as a pinned reference. The parent repository stores the URL and commit hash of the submodule, but not the code itself. This means the two repositories remain fully independent, which is a legitimate need when the depended-upon code is owned by a different team or organization. The cost is that every clone of the parent repository must also fetch the submodule:

```bash
# Clone a repository and initialize its submodules
git clone --recurse-submodules https://github.com/org/parent-repo.git

# Or initialize submodules after a plain clone
git submodule update --init --recursive

# Update all submodules to their latest remote commits
git submodule update --remote
```

The friction shows up when contributors forget that submodules exist, or when multiple submodules are nested. Pipelines need the `--recurse-submodules` flag to work correctly. Bumping a submodule to a newer version means updating the pointer and committing that change in the parent.

**Subtrees** embed the code directly into the parent repository's history using `git subtree`. Once merged, the code looks like any other files and contributors don't need special commands to work with it:

```bash
# Add an external repository as a subtree at a specific path
git subtree add --prefix=libs/shared https://github.com/org/shared.git main --squash

# Pull updates from the upstream
git subtree pull --prefix=libs/shared https://github.com/org/shared.git main --squash

# Push changes back upstream (if you have permission)
git subtree push --prefix=libs/shared https://github.com/org/shared.git main
```

Subtrees eliminate the contributor confusion problem but make history messier and updates more deliberate. They work well for stable shared libraries that you control but don't modify constantly.

**Monorepo tooling** like [Nx](https://nx.dev){:target="_blank" rel="noopener noreferrer"} and [Turborepo](https://turbo.build){:target="_blank" rel="noopener noreferrer"} take a different approach: all code lives in a single repository, and the tooling handles build caching, dependency graphs, and selective testing. This is where large technology organizations like Google and Meta have landed for their internal codebases. The trade-off is that the tooling layer is non-trivial to set up and maintain, and repository size can become a concern at scale.

For most teams, the choice is between submodules (for true external dependencies) and subtrees (for shared code you occasionally sync). Monorepo tooling makes sense when you're coordinating many packages that share frequent changes and you're willing to invest in the tooling layer.

---

## Git Hooks

Git hooks are scripts that run automatically at specific points in the Git workflow. They live in the `.git/hooks/` directory of a repository. Git populates that directory with example files ending in `.sample` when you initialize a repository; removing the `.sample` suffix and making the file executable activates the hook.

Hooks fall into two broad categories.

**Client-side hooks** run on the developer's machine and cannot be enforced by the server. They're useful for catching issues early, before code reaches the shared repository:

- `pre-commit` — runs before the commit message prompt. Use it to run linters, format checks, or tests. A non-zero exit code aborts the commit.
- `prepare-commit-msg` — runs before the editor opens for the commit message. Use it to pre-populate message templates.
- `commit-msg` — runs after the message is written, receives the message file as an argument. Use it to enforce message conventions like ticket number prefixes.
- `pre-push` — runs before a push operation. Use it to run a test suite before code leaves the local machine.
- `post-commit` — runs after a successful commit. Non-blocking; good for notifications.

A simple `pre-commit` hook that prevents committing if a linter fails:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running linter..."
dotnet format --verify-no-changes
if [ $? -ne 0 ]; then
  echo "Linter check failed. Please run 'dotnet format' before committing."
  exit 1
fi
exit 0
```

A `commit-msg` hook that enforces a format:

```bash
#!/bin/bash
# .git/hooks/commit-msg

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Enforce format: TYPE: description (e.g., "feat: add user login")
if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|refactor|test|chore|ci): .+"; then
  echo "ERROR: Commit message must follow the format: type: description"
  echo "Types: feat, fix, docs, refactor, test, chore, ci"
  exit 1
fi
exit 0
```

**Server-side hooks** run on the Git server (GitHub, GitLab, Gitea, or self-hosted Git) and can enforce rules that clients cannot bypass:

- `pre-receive` — runs before any refs are updated. Use it to reject pushes that violate branch protection rules, fail CI, or don't meet policy requirements.
- `update` — similar to `pre-receive` but runs once per branch being updated.
- `post-receive` — runs after a successful push. Use it to trigger deployments, send notifications, or update issue trackers.

Server-side hooks are more powerful for enforcement because client-side hooks can be skipped with `git commit --no-verify`. However, most teams rely on branch protection rules and CI/CD pipelines on hosted platforms like GitHub rather than maintaining custom server-side hook scripts.

**Managing hooks in a team.** The `.git/hooks/` directory is not tracked by Git, which means hooks aren't shared automatically. Two approaches solve this:

1. Keep hooks in a tracked directory (like `.githooks/`) and configure Git to use it: `git config core.hooksPath .githooks`
2. Use a tool like [Husky](https://typicode.github.io/husky/){:target="_blank" rel="noopener noreferrer"} for Node.js projects. Husky installs hooks automatically after `npm install` and stores them in a tracked directory.

```bash
# Using a custom hooks directory (works for any language/toolchain)
mkdir .githooks
cp pre-commit-script.sh .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks

# Commit the .githooks directory to share hooks with the team
git add .githooks
git commit -m "chore: add shared git hooks"
```

The `core.hooksPath` setting only affects the current repository unless you set it globally. Document this in your project README or onboarding guide so new contributors know to configure it.

---

## Git LFS

Git was designed for text files. It stores every version of every file in the repository, which is fine for source code but becomes expensive for binary files like images, videos, audio, compiled artifacts, or large datasets. A 10 MB PSD file checked in over 100 iterations becomes a 1 GB repository that every developer must clone in full.

[Git LFS (Large File Storage)](https://git-lfs.com){:target="_blank" rel="noopener noreferrer"} solves this by replacing large files in the repository with small text pointer files, while storing the actual binary content on a separate LFS server. From the developer's perspective, the files look normal, since Git LFS handles the upload and download transparently. From a repository perspective, each version of the large file is just a 130-byte pointer.

The pointer file looks something like this:

```
version https://git-lfs.github.com/spec/v1
oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393
size 12345678
```

**How to use Git LFS.**

First, install the LFS client and initialize it for the repository:

```bash
# Install Git LFS (one-time setup per machine)
git lfs install

# Tell Git LFS which file types to track
git lfs track "*.psd"
git lfs track "*.mp4"
git lfs track "*.zip"
git lfs track "assets/large-data/*.csv"
```

The `track` commands add entries to a `.gitattributes` file, which you should commit:

```bash
git add .gitattributes
git commit -m "chore: configure git lfs tracking for binary files"
```

From this point on, any file matching those patterns that you `git add` will be stored in LFS automatically. You can verify what's being tracked:

```bash
# List tracked patterns
git lfs track

# List all LFS objects in the current commit
git lfs ls-files
```

**When to use Git LFS.** Consider LFS when binary files are versioned alongside source code and those files are large enough to noticeably inflate repository size. Design assets, game assets, machine learning model weights, and sample datasets are common candidates. LFS is less useful for build artifacts that shouldn't be in source control at all; those belong in an artifact registry.

LFS does require that your Git hosting platform supports it. GitHub, GitLab, and Bitbucket all support LFS, but storage and bandwidth beyond the free tier costs money. Self-hosted Git servers need an LFS server configured separately.

One important consideration: `git clone` by default downloads only the LFS pointers, not the actual files. Running `git lfs pull` fetches the binary content. CI/CD pipelines that need the actual files must be configured to do this explicitly.

---

## Disaster Recovery

Most Git disasters look catastrophic but are recoverable. Git rarely deletes data permanently; it just changes which references point to which objects, and objects without references stick around long enough for the reflog to help you find them.

### "I committed to the wrong branch"

You made commits on `main` when you meant to make them on a feature branch.

```bash
# Step 1: Create the branch you meant to use, pointing to your current HEAD
git branch feature/my-work

# Step 2: Reset main back to where it should be (before your errant commits)
git reset --hard origin/main

# Step 3: Your commits are now only on feature/my-work, where they belong
git checkout feature/my-work
```

If you've already pushed those commits to `main`, the situation is more delicate. If main has branch protection rules, the push may have been blocked. If not, you'll need to coordinate with your team because others may have pulled those commits already.

### "I need to undo a pushed commit"

There are two approaches, and which one you use depends on whether others have pulled the commit.

If the commit is recent and you're confident nobody has pulled it, you can rewrite history with a force push (use with extreme caution on shared branches):

```bash
git revert HEAD   # creates a new commit that undoes the previous one
git push
```

`git revert` is almost always the right answer for pushed commits. It creates a new commit that applies the inverse of the bad commit, leaving the original history intact. This is safe regardless of whether others have pulled the code.

```bash
# Revert a specific commit
git revert <commit-hash>

# Revert a range of commits (creates one revert commit per commit)
git revert HEAD~3..HEAD

# Revert without auto-committing (lets you review or combine reverts)
git revert --no-commit HEAD~3..HEAD
git commit -m "revert: roll back broken payment integration"
```

### "I lost a branch"

Accidentally deleting a branch before merging it is recoverable as long as the reflog still has the history (within the 90-day window):

```bash
# Find the last commit on the deleted branch
git reflog | grep 'feature/deleted-branch'
# Or just browse recent reflog entries:
git reflog

# Recreate the branch pointing to that commit
git checkout -b feature/deleted-branch <commit-hash>
```

If someone else pushed that branch to the remote, you can fetch it:

```bash
git fetch origin
git checkout -b feature/deleted-branch origin/feature/deleted-branch
```

### "I need to split a commit"

You have a single commit with too many changes mixed together and need to break it into smaller, focused commits.

```bash
# Start an interactive rebase covering the commit you want to split
git rebase -i HEAD~3

# Change the word 'pick' to 'edit' for the commit you want to split
# Save and close the editor — Git will pause at that commit

# Undo the commit but keep the changes staged
git reset HEAD^

# Now selectively stage and commit the first logical chunk
git add path/to/first-change.cs
git commit -m "feat: add payment model"

# Stage and commit the second chunk
git add path/to/second-change.cs
git commit -m "feat: add payment validation"

# Continue the rebase
git rebase --continue
```

### "I accidentally committed sensitive data"

If credentials, API keys, or secrets made it into a commit, treat this as a security incident first: rotate the secret immediately, before worrying about the Git history. Once rotated, the secret in the history is less dangerous, but you still want it out.

For a secret that hasn't been pushed yet:

```bash
# Remove the file from the last commit entirely
git reset HEAD~1
# Remove or modify the file to remove the secret
git add .
git commit -m "fix: remove accidental secret"
```

For a secret in pushed history, you need to rewrite that history across all branches it appears in. The official tool for this is [git-filter-repo](https://github.com/newren/git-filter-repo){:target="_blank" rel="noopener noreferrer"}, which replaces the older and slower `git filter-branch`:

```bash
# Remove a specific file from all history
git filter-repo --path secrets.json --invert-paths

# Replace all occurrences of a secret string with a placeholder
git filter-repo --replace-text <(echo 'PASSWORD=secret123==>PASSWORD=REDACTED')
```

After rewriting history, the repository's commit hashes have all changed and you must force-push. This is disruptive: every team member's clone is now out of sync and they'll need to re-clone. This is another reason why secrets should never reach source control in the first place. A pre-commit hook that scans for common secret patterns, using a tool like [detect-secrets](https://github.com/Yelp/detect-secrets){:target="_blank" rel="noopener noreferrer"} or [gitleaks](https://github.com/gitleaks/gitleaks){:target="_blank" rel="noopener noreferrer"}, is a much cheaper prevention.

If the repository is on GitHub and the secret appeared only in the most recent commit on the default branch, GitHub provides a "Remove file" option in the web UI that handles the force-push for you, but it still affects all forks.
