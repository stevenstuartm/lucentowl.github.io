---
title: "Git Advanced Operations"
layout: guide
category: Developer Tools
subcategory: Git Fundamentals
description: "Beyond the basics: interactive rebase and rerere, cherry-pick, bisect, reflog, stashing, worktrees, submodules and subtrees, large-repository techniques, hooks, commit signing, Git LFS, and recipes for recovering from common mistakes."
tags: [advanced, interactive-rebase, bisect, reflog, worktrees, commit-signing, git-lfs]
---

## Interactive Rebase

Interactive rebase is one of the most powerful tools in Git for cleaning up a messy commit history before merging or sharing work. You're replaying your commits, but this time you decide exactly what happens to each one.

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

| Command | Effect |
| --- | --- |
| `pick` (`p`) | Keep the commit as-is |
| `squash` (`s`) | Fold this commit into the one above it, combining their messages |
| `fixup` (`f`) | Same as squash, but discard this commit's message |
| `reword` (`r`) | Keep the commit but edit its message |
| `edit` (`e`) | Pause the rebase here so you can amend the commit |
| `drop` (`d`) | Delete the commit entirely |

To reorder commits, move the lines. Git applies them top to bottom.

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

### Planning Fixups While You Work

Instead of editing the todo list by hand, you can mark a commit as a fix for an earlier one at the moment you make it, and let rebase arrange everything later:

```bash
# Commit a fix and label it as belonging to an earlier commit
git commit --fixup a1b2c3d

# Later, rebase with autosquash: fixup commits are moved and marked automatically
git rebase -i --autosquash main
```

Setting `rebase.autoSquash` to `true` makes `--autosquash` the default for interactive rebases.

### Moving a Branch to a New Base with --onto

Plain `git rebase main` replays every commit that is on the current branch and not on `main`. Sometimes only part of a branch should move. The classic case is a branch cut from another feature branch, which now needs to sit directly on `main` without the parent feature's commits:

```bash
# Replay the commits after feature/base onto main, leaving feature/base's own commits behind
git rebase --onto main feature/base feature/child
```

The three arguments read as "new base, old base, branch to move." When one branch is stacked on another and both should move together, `git rebase --update-refs` (or `rebase.updateRefs = true`) also moves any branch refs that pointed at the rewritten commits.

### Conflicts During a Rebase

A rebase replays commits one at a time, so it can stop on a conflict at each of them. You resolve the files the same way as a merge conflict, then tell the rebase to carry on:

```bash
# After resolving conflicts in the affected files:
git add <conflicted-file>
git rebase --continue

# Skip the commit being applied (its changes are dropped)
git rebase --skip

# Or bail out entirely and return to where you started:
git rebase --abort
```

Long-lived branches that get rebased repeatedly tend to hit the same conflicts over and over. `rerere` ("reuse recorded resolution") records how you resolved each conflict and replays that resolution automatically the next time the identical conflict appears, in a rebase, merge, or cherry-pick:

```bash
git config --global rerere.enabled true
```

Git still leaves the file for you to check. It stages nothing on its own unless you also set `rerere.autoUpdate`, so review the result with `git diff` before continuing.

### When to Rebase and When Not To

Interactive rebase rewrites history, which generates new commit hashes for every commit it touches. On a private branch that only you use, this is safe and a good way to produce a coherent history. On a branch that others have checked out and are building on, rebasing is destructive because you are changing the history they based their work on. The working rule is to never rebase commits that have been pushed to a shared branch. Main, develop, and any branch other team members are actively using are off-limits. When you do rebase your own already-pushed branch, push it with `git push --force-with-lease`, which refuses to overwrite commits someone else pushed in the meantime.

---

## Cherry-Picking

Cherry-picking lets you copy a single commit (or a range of commits) from one branch and apply it to another. You reach into a branch's history and pull out exactly the commit you want.

```bash
# Apply a specific commit to the current branch
git cherry-pick <commit-hash>

# Apply a range of commits (exclusive of start, inclusive of end)
git cherry-pick abc123..def456

# Apply multiple specific commits
git cherry-pick abc123 def456 ghi789

# Cherry-pick without automatically committing (lets you review/modify first)
git cherry-pick --no-commit <commit-hash>

# Append "(cherry picked from commit ...)" to the message for traceability
git cherry-pick -x <commit-hash>
```

The most legitimate use case for cherry-pick is backporting a bug fix to a release branch. You have a fix committed to main, and you need that same fix on the `release/2.3` branch without merging all of main into it. Cherry-pick is the right tool for this.

```bash
git switch release/2.3
git cherry-pick -x abc123def  # the fix commit from main
```

Git creates a new commit on `release/2.3` with the same changes but a different hash. The two commits are related by their content, not by any Git ancestry relationship, so use `-x` for backports. The recorded source hash is the only link between them.

**When not to cherry-pick.** Cherry-pick becomes a liability when used as a substitute for proper branch management. Picking the same logical change across many branches means you now have multiple commit hashes representing the "same" fix, and Git has no way to know they're related. When those branches are later merged, the duplicated changes can conflict with each other or with later edits to the same lines. If you find yourself cherry-picking the same commit repeatedly, that's a signal to think about your branching model instead.

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

If a commit fails to compile or has test infrastructure issues unrelated to your bug, mark it as `skip` rather than good or bad:

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
git switch -c recovery-branch abc123d

# Or just reset your current branch to that point
git reset --hard abc123d
```

**Recovering a deleted branch.** Deleting a branch doesn't delete the commits. It removes the label, and Git prints the hash it pointed at (`Deleted branch feature/x (was 4fd5ab1).`), so the quickest recovery is to scroll back to that message. Otherwise, HEAD's reflog shows when you last switched away from the branch:

```bash
git reflog | grep 'feature/deleted-branch'
# Find the last commit hash for that branch, then:
git switch -c feature/deleted-branch <that-hash>
```

Reflog entries don't last forever. By default Git keeps them for 90 days, but entries pointing at commits that are no longer on any branch, which are exactly the ones you need for recovery, expire after 30 days. Treat a month as the working window. The reflog is also local to your clone, so a teammate's reflog can't recover your commits, and a fresh clone starts with an empty one.

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

`git worktree remove` refuses to delete a worktree that has uncommitted changes unless you add `--force`. If you delete a worktree's folder by hand instead, `git worktree prune` cleans up the leftover bookkeeping.

One rule to know: by default, two worktrees cannot check out the same branch at the same time. If `main` is checked out in your primary worktree, Git refuses to check out `main` in a second worktree. This prevents conflicting changes to the same branch from two locations.

### Where Worktrees Help

**Reviewing a PR while mid-task.** You're deep in a feature branch with files open everywhere. A teammate asks you to review their PR. Instead of stashing, switching branches, reviewing, switching back, and popping your stash, you create a worktree:

```bash
git fetch origin
# Creates a local auth-refactor branch tracking origin/auth-refactor
git worktree add ../review-pr auth-refactor
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

**Monorepo tooling** like [Nx](https://nx.dev){:target="_blank" rel="noopener noreferrer"} and [Turborepo](https://turborepo.dev){:target="_blank" rel="noopener noreferrer"} takes a different approach. All code lives in a single repository, and the tooling handles build caching, dependency graphs, and selective testing. Large technology organizations like Google and Meta also keep most of their code in single repositories, though on custom version control and build systems rather than these tools. The trade-off is that the tooling layer takes significant effort to set up and maintain, and repository size becomes a concern at scale, which the next section addresses.

For most teams, the choice is between submodules (for true external dependencies) and subtrees (for shared code you occasionally sync). Monorepo tooling makes sense when you're coordinating many packages that share frequent changes and you're willing to invest in the tooling layer.

---

## Working with Large Repositories

A plain `git clone` downloads every version of every file in the repository's history and checks out every file at the tip. For a large monorepo or a repository with years of history, that can mean gigabytes of download and a slow `git status` on every command. Git has three ways to take less, and they combine.

| Technique | What it skips | Cost | Good fit |
| --- | --- | --- | --- |
| **Partial clone** (`--filter=blob:none`) | File contents for past commits, downloaded on demand when you need them | Commands that read old file versions, like `git blame` or diffing old commits, fetch from the server as they run | Day-to-day development in a big repository |
| **Sparse checkout** | Files outside the directories you name, which stay in the repository but aren't written to disk | You have to name the directories you work in | Monorepos where each team touches a few folders |
| **Shallow clone** (`--depth 1`) | All history before the most recent commits | `log`, `blame`, and merge-base calculations break or mislead, and some pushes and fetches get slower | CI builds that only need the current snapshot |

```bash
# Partial clone: full history of commits and trees, file contents on demand
git clone --filter=blob:none https://github.com/org/big-repo.git

# Add sparse checkout: only the named directories are written to disk
git clone --filter=blob:none --sparse https://github.com/org/big-repo.git
cd big-repo
git sparse-checkout set services/payments libs/shared

# Shallow clone for a throwaway CI build
git clone --depth 1 https://github.com/org/big-repo.git
```

For developer machines, partial clone plus sparse checkout is usually the better choice, because it keeps the full commit history available for everyday commands. Shallow clones suit automated builds that discard the clone afterwards. Git also ships [Scalar](https://git-scm.com/docs/scalar){:target="_blank" rel="noopener noreferrer"}, a command that clones with these options already set and turns on background maintenance for very large repositories.

---

## Git Hooks

Git hooks are scripts that run automatically at specific points in the Git workflow. They live in the `.git/hooks/` directory of a repository. Git populates that directory with example files ending in `.sample` when you initialize a repository; removing the `.sample` suffix and making the file executable activates the hook.

Hooks fall into two broad categories.

**Client-side hooks** run on the developer's machine and cannot be enforced by the server. They're useful for catching issues early, before code reaches the shared repository:

| Hook | Runs | Typical use |
| --- | --- | --- |
| `pre-commit` | Before the commit message prompt. A non-zero exit aborts the commit | Linters, format checks, fast tests, secret scanning |
| `prepare-commit-msg` | Before the editor opens for the commit message | Pre-populating message templates |
| `commit-msg` | After the message is written, with the message file as its argument | Enforcing message conventions like ticket number prefixes |
| `pre-push` | Before a push. A non-zero exit aborts the push | Running a test suite before code leaves the machine |
| `post-commit` | After a successful commit. Cannot block anything | Notifications |

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

**Server-side hooks** run on the Git server and can enforce rules that clients cannot bypass:

| Hook | Runs | Typical use |
| --- | --- | --- |
| `pre-receive` | Once per push, before any refs are updated | Rejecting pushes that break policy |
| `update` | Once per ref being updated, before it changes | Per-branch policy checks |
| `post-receive` | After a successful push | Triggering deployments, notifications, or issue tracker updates |

Server-side hooks matter for enforcement because client-side hooks can be skipped with `git commit --no-verify` or `git push --no-verify`. You can only install them on a server you administer, such as a self-hosted Git server, GitHub Enterprise Server, or self-managed GitLab. Hosted services like GitHub.com don't run custom server-side hooks, so teams there get the same enforcement from branch protection, rulesets, push rules, and required CI checks.

**Managing hooks in a team.** The `.git/hooks/` directory is not tracked by Git, which means hooks aren't shared automatically. Two approaches solve this:

1. Keep hooks in a tracked directory (like `.githooks/`) and point Git at it with `git config core.hooksPath .githooks`.
2. Use a hook manager that installs hooks from a tracked config file, such as [Husky](https://typicode.github.io/husky/){:target="_blank" rel="noopener noreferrer"} for Node.js projects, which wires itself up during `npm install`, or the language-neutral [pre-commit](https://pre-commit.com/){:target="_blank" rel="noopener noreferrer"} framework.

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

## Signing Commits and Tags

Git records whatever name and email a committer configures, so the author field on a commit proves nothing about who made it. A signature does. Git can sign commits and tags with a GPG key, an SSH key, or an X.509 certificate, and hosting platforms show a signed commit as "Verified" when the signature matches a key registered to the author's account. Some organizations require signed commits on protected branches, which is a hosting-platform setting rather than a Git one.

SSH signing, available since Git 2.34, is the least setup for most developers because it reuses a key they already have:

```bash
# Sign with an SSH key instead of GPG
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Sign every commit and tag by default
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Or sign one commit explicitly
git commit -S -m "Add payment retry policy"
```

For GitHub to mark those commits Verified, the same public key must be added to your account as a signing key, which is separate from adding it as an authentication key. To check signatures locally, `git log --show-signature` shows them. For SSH signatures it also needs a `gpg.ssh.allowedSignersFile` listing whose keys to trust.

A signature proves the commit came from someone holding the key. It says nothing about whether the code is safe, and a commit rewritten by a rebase or a squash merge loses the original signature. GitHub signs the merge and squash commits it creates with its own key, but not the commits a rebase merge creates.

---

## Git LFS

Git was designed for text files. It stores every version of every file in the repository, which is fine for source code but becomes expensive for binary files like images, videos, audio, compiled artifacts, or large datasets. Git compresses similar versions of text files well, but binary formats rarely compress against each other, so a 10 MB PSD file checked in over 100 iterations can add close to 1 GB to a repository that every developer must clone in full.

[Git LFS (Large File Storage)](https://git-lfs.com){:target="_blank" rel="noopener noreferrer"} solves this by replacing large files in the repository with small text pointer files, while storing the actual binary content on a separate LFS server. From the developer's perspective, the files look normal, since Git LFS handles the upload and download transparently. From a repository perspective, each version of the large file is a pointer of roughly 130 bytes.

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

**When to use Git LFS.** Consider LFS when binary files are versioned alongside source code and those files are large enough to noticeably inflate repository size. Design assets, game assets, machine learning model weights, and sample datasets are common candidates. LFS is the wrong fix for build artifacts that shouldn't be in source control at all. Those belong in an artifact registry.

LFS does require that your Git hosting platform supports it. GitHub, GitLab, and Bitbucket all support LFS, but storage and bandwidth beyond the free tier costs money. Self-hosted Git servers need an LFS server configured separately.

With Git LFS installed, `git clone` and `git checkout` download the real content for the files in the commit being checked out, and nothing for older versions. On a machine without the LFS client, or when `GIT_LFS_SKIP_SMUDGE=1` is set, the working tree gets only the pointer files, and `git lfs pull` fetches the content later. CI is where this bites. Many checkout steps skip LFS by default (GitHub's `actions/checkout` needs `lfs: true`), so a build can run against pointer files without any error until something tries to read them.

---

## Disaster Recovery

Most Git disasters look catastrophic but are recoverable. Git rarely deletes committed data right away. It changes which references point to which objects, and objects without references stick around long enough for the reflog to help you find them. The exception is uncommitted work, which is never stored as an object, so the commands below that discard working-directory changes are the ones to run carefully.

### "I committed to the wrong branch"

You made commits on `main` when you meant to make them on a feature branch.

```bash
# Step 1: Create the branch you meant to use, pointing to your current HEAD
git branch feature/my-work

# Step 2: Reset main back to where it should be (before your errant commits)
# --hard also discards uncommitted changes, so commit or stash those first
git reset --hard origin/main

# Step 3: Your commits are now only on feature/my-work, where they belong
git switch feature/my-work
```

If you've already pushed those commits to `main`, the situation is more delicate. If main has branch protection rules, the push may have been blocked. If not, you'll need to coordinate with your team because others may have pulled those commits already.

### "I need to undo a pushed commit"

There are two approaches, and which one you use depends on whether others have pulled the commit.

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

Only if the commit is recent, the branch is yours alone, and you're confident nobody has pulled it, can you remove it from history instead. That takes a force push, which branch protection on shared branches usually blocks:

```bash
git reset --hard HEAD~1
git push --force-with-lease
```

Reverting a merge commit needs one more argument. `git revert -m 1 <merge-hash>` tells Git to keep the first parent's side (normally the branch you merged into) and undo what the merge brought in.

### "I lost a branch"

Accidentally deleting a branch before merging it is recoverable as long as the reflog still has the history, which for commits no longer on any branch means about 30 days by default:

```bash
# Find the last commit on the deleted branch
git reflog | grep 'feature/deleted-branch'
# Or just browse recent reflog entries:
git reflog

# Recreate the branch pointing to that commit
git switch -c feature/deleted-branch <commit-hash>
```

If the branch still exists on the remote, recreating it locally is simpler:

```bash
git fetch origin
git switch feature/deleted-branch   # creates a local branch tracking origin/feature/deleted-branch
```

### "I need to split a commit"

You have a single commit with too many changes mixed together and need to break it into smaller, focused commits.

```bash
# Start an interactive rebase covering the commit you want to split
git rebase -i HEAD~3

# Change the word 'pick' to 'edit' for the commit you want to split
# Save and close the editor; Git will pause at that commit

# Undo the commit but keep its changes in the working directory, unstaged
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

If credentials, API keys, or secrets made it into a commit, treat this as a security incident first. Revoke or rotate the secret immediately, before touching the Git history. A rotated secret is harmless, and for many leaks rotation alone is enough. Rewrite history as well when the secret can't be rotated or the file itself shouldn't be public.

For a secret that hasn't been pushed yet, rewrite the last commit before anyone sees it:

```bash
# Delete or edit the file to remove the secret, then:
git add path/to/config.json
git commit --amend --no-edit
# If the secret is further back than the last commit, use interactive rebase with 'edit'
```

For a secret in pushed history, you need to rewrite that history across every branch and tag it appears in. The Git project recommends [git-filter-repo](https://github.com/newren/git-filter-repo){:target="_blank" rel="noopener noreferrer"} for this, in place of the older and slower `git filter-branch`:

```bash
# Remove a specific file from all history
git filter-repo --sensitive-data-removal --path secrets.json --invert-paths

# Replace all occurrences of a secret string with a placeholder
git filter-repo --sensitive-data-removal --replace-text <(echo 'PASSWORD=secret123==>PASSWORD=REDACTED')
```

The `--sensitive-data-removal` flag (git-filter-repo 2.47 and later) adds the extra steps this case needs, such as reporting which commits changed so you can pass them to your hosting provider. After rewriting history, the repository's commit hashes have all changed and you must force-push. This is disruptive. Every team member's clone is now out of sync, and each of them needs to re-clone or carefully rebase onto the new history, or the next push reintroduces the old commits.

Hosting platforms keep copies you can't reach with a push. On GitHub, forks keep the old history, pull request refs are read-only, and cached views can still show the data, so GitHub's documented procedure ends with contacting GitHub Support to purge them. That cleanup cost is the reason prevention is so much cheaper. A pre-commit hook that scans for common secret patterns, using a tool like [detect-secrets](https://github.com/Yelp/detect-secrets){:target="_blank" rel="noopener noreferrer"} or [gitleaks](https://github.com/gitleaks/gitleaks){:target="_blank" rel="noopener noreferrer"}, catches most leaks before they leave the machine.
