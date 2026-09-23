---
title: "Git Core Concepts"
layout: guide
category: Developer Tools
subcategory: Git Fundamentals
description: "How Git works under the hood and in daily use: the object model and commit graph, refs and HEAD, the staging area, remotes and pulling, merging and resolving conflicts, tags, .gitignore, configuration scopes, and why lost commits are usually recoverable."
tags: [fundamentals, version-control, object-model, staging-area, remotes, merge-conflicts, gitignore]
---

## What Git Is and Why It Matters

Most developers use Git every day without thinking much about how it actually works. Routine tasks like committing and pushing don't need that knowledge, but it's what gets you out of trouble when things go wrong, and it's what reveals the features that could make your work significantly better.

Git is a distributed version control system. "Version control" means Git records snapshots of your project over time so you can retrieve any past state. "Distributed" means every developer has a complete copy of the entire project history on their machine, not just a checkout of the current files. There is no single server that holds the authoritative copy. When you clone a repository, you clone everything: all commits, all branches, all tags, the full history going back to the first commit.

This is a meaningful difference from older centralized systems like SVN and Perforce, where all history lived on a server and developers checked out working copies. With a centralized system, losing the server means losing history. Working offline means no commits. Creating branches is expensive because it involves server operations. Git was designed with these limitations in mind. Linus Torvalds created Git in 2005 specifically for Linux kernel development, where thousands of contributors needed to work independently and merge large patches reliably without depending on a central server.

The distributed model has practical consequences for daily work. You can commit, branch, and explore history without a network connection. You can experiment freely because local operations are cheap and branches are trivially created. You can reconstruct a complete copy of the repository from any clone if the server disappears.

---

## The Object Model

Git stores everything as objects in a content-addressable key-value store inside the `.git` directory. Every object is identified by a hash of its contents. If you change even one byte of an object's content, the hash changes, and Git treats it as a completely different object. Two properties follow from that design. Objects are deduplicated automatically, because two files with identical content have the same hash and are stored once. Corruption is detectable, because a hash mismatch means the data changed.

Repositories have historically used SHA-1, which produces the 40-character hashes you see throughout Git's output. Git also supports SHA-256 repositories, and Git 3.0 is planned to make SHA-256 the default for newly created repositories. Existing repositories keep the format they were created with. The examples in this guide show SHA-1 hashes because that is what most repositories still use.

There are four object types, and every commit, file, and tag in Git reduces to these primitives. A commit points to one tree, the tree lists blobs and subtrees, and the same blob or subtree can be shared by many trees:

```
  commit 7a1c…
    │  tree ────────► tree 4fd5… (project root)
    │                   ├── blob a8c7…  .gitignore
    │                   ├── blob e3a1…  README.md
    │                   └── tree 0577…  src/
    │                         └── blob 9b2e…  Program.cs
    └  parent ──────► commit 3e9f… (its own tree, which may reuse
                                     unchanged blobs and subtrees)
```

### Blobs

A blob stores raw file content, nothing else: no filename, no permissions, just bytes. If you have two files in different directories with identical content, Git stores one blob and references it twice.

You can inspect a blob directly:

```bash
# Hash a file and write it to the object store
git hash-object -w myfile.txt
# Output: e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 (or similar)

# Read the content of that object back
git cat-file -p e69de29
```

### Trees

A tree is Git's equivalent of a directory. It contains a list of entries, where each entry has a mode (file permissions), an object type, a hash, and a name. A tree entry can point to either a blob (a file) or another tree (a subdirectory).

```bash
# List the tree at a given commit
git cat-file -p HEAD^{tree}
# Output:
# 100644 blob a8c76fa1...    .gitignore
# 100644 blob e3a12ec8...    README.md
# 040000 tree 05773ed2...    src
```

The mode `100644` means a regular file with standard permissions. The mode `040000` means a directory (tree). This recursive structure lets a single tree hash represent an entire directory tree at a point in time.

### Commits

A commit is what you think of when you think of a "version." It contains a reference to a tree (the root of the project at that point), references to zero or more parent commits, author metadata, committer metadata, and a message.

```bash
git cat-file -p HEAD
# Output:
# tree 4fd5ab1f2e3a12ec...
# parent a8c76fa2b3d4e5f6...
# author Steven Stuart <abc@gmail.com> 1708467200 +0000
# committer Steven Stuart <abc@gmail.com> 1708467200 +0000
#
# trying to fix the menu orientation for mobile
```

The first commit in a repository has no parent. A merge commit has two parents. An octopus merge (merging three or more branches at once) has three or more parents.

Because a commit contains the hash of its tree, and that tree recursively contains hashes of all blobs and subtrees, and each commit contains the hash of its parent commit, any change anywhere in the history will produce a different hash for that commit and every commit that descends from it. This is the chain of integrity that makes Git history tamper-evident.

### Tags

A tag object stores a reference to another object (usually a commit), a tagger's name and date, a message, and optionally a signature. Only annotated tags create one. The Tags section below covers how annotated tags differ from lightweight ones and when to use each.

---

## The Directed Acyclic Graph

Git history is a directed acyclic graph, commonly called a DAG. Each commit is a node. Each parent relationship is a directed edge pointing backward in time. "Acyclic" means you can never follow parent edges and arrive back at a commit you have already visited. History has no cycles.

This structure is what makes Git's branching and merging model work. When two branches diverge, they share a common ancestor commit and then develop independently:

```
  A ◄── B ◄── C ◄── D    (main)
                ▲
                └── E ◄── F    (feature)
```

Each arrow points from child to parent, showing how Git stores parent references. Commits A, B, and C are common to both branches. Commit D exists only on `main`, and commits E and F exist only on `feature`. When you merge `feature` back into `main`, Git finds the lowest common ancestor (C), computes the diff of C-to-D and C-to-F, and combines them. That merge produces a new commit with two parents:

```
  A ◄── B ◄── C ◄── D ◄── G    (main, G is the merge commit)
                ▲           │
                └── E ◄── F─┘    (G has two parents: D and F)
```

Git's DAG also explains why rebase rewrites history. When you rebase `feature` onto `main`, Git replays commits E and F on top of D, creating new commits E' and F' with different parent chains (and therefore different hashes), while discarding the originals:

```
  A ◄── B ◄── C ◄── D ◄── E' ◄── F'    (feature, after rebase)
```

The original E and F still exist in the object store for a while, but no branch points to them anymore. The last section of this guide covers how long they survive and how to get them back.

---

## Refs, HEAD, and Branches

Git objects are permanent and immutable once created, but how does Git know which commit is "the current version"? Through references, or refs. A ref is a named pointer to a commit hash.

### Branches

A branch is not a copy of the codebase. A branch is a ref: a name that stores a single commit hash. Creating a branch is nearly instantaneous because Git only records one new name and one hash, which is why branching in Git is so much cheaper than in older version control systems.

```bash
# Create a new branch
git branch feature/my-work

# See the commit the branch points to
git rev-parse feature/my-work
# Output: 4fd5ab1f2e3a12ec8a9b3c4d5e6f7a8b9c0d1e2f
```

A freshly created branch is usually stored as a small file under `.git/refs/heads/`, but Git packs refs into `.git/packed-refs` over time, and repositories using the newer reftable backend store them in a binary format. `git rev-parse` reads a ref correctly in every case, so prefer it over reading files under `.git/` directly.

When you commit on a branch, Git creates the commit object and then moves the branch ref forward to point to the new commit. Branches are mutable. They follow you as you commit.

### HEAD

HEAD is a special ref that tells Git which branch you are currently on. Usually, HEAD contains the name of a branch rather than a commit hash:

```bash
cat .git/HEAD
# Output: ref: refs/heads/main
```

When you switch to a branch, HEAD is updated to point to that branch. When you commit, Git uses HEAD to determine which branch to advance.

```
  HEAD                    refs/heads/main           Commit Object
  ┌─────────────────┐    ┌─────────────────┐       ┌─────────────────┐
  │ ref: refs/heads/ │───►│ 4fd5ab1...      │──────►│ tree: 9a3b...   │
  │      main        │    └─────────────────┘       │ parent: e3a1... │
  └─────────────────┘                               │ author: ...     │
                                                    │ message: ...    │
  Detached HEAD                                     └─────────────────┘
  ┌─────────────────┐
  │ 4fd5ab1...      │──────────────────────────────►(same commit)
  └─────────────────┘
```

If you switch to a commit directly by its hash instead of a branch name, Git enters "detached HEAD" state, and HEAD then contains a commit hash directly:

```bash
git switch --detach 4fd5ab1
# The older equivalent is: git checkout 4fd5ab1

cat .git/HEAD
# Output: 4fd5ab1f2e3a12ec8a9b3c4d5e6f7a8b9c0d1e2f
```

In detached HEAD state, commits you make are not attached to any branch. If you switch away without creating a branch first, those commits become unreachable and will eventually be cleaned up by Git's garbage collector. This is a common source of confusion for developers who check out old commits to look around.

```bash
# Recover from detached HEAD by creating a branch at the current position
git switch -c my-recovery-branch
```

This guide uses `git switch` for changing branches and `git restore` for discarding or unstaging changes. Both arrived in Git 2.23 to split up the older `git checkout`, which does both jobs and is still fully supported. You will see `checkout` in older documentation and scripts, and it behaves the same way.

---

## The Staging Area and Three-Tree Architecture

Git maintains three distinct "trees" (in the general sense of snapshots) at all times, and understanding the relationship between them is the key to understanding how `git add`, `git commit`, `git diff`, and `git reset` actually work.

The three trees are:

- **Working directory**: Your actual files on disk as they currently exist
- **Index (staging area)**: A snapshot of what will go into the next commit
- **HEAD**: The snapshot of the last commit (the current tip of the branch)

Many older version control systems store each file as a series of diffs against its previous version. Git's model is different. A commit records a complete snapshot of all tracked files at a moment in time, and unchanged files cost nothing because the new tree simply reuses their existing blobs. (For storage efficiency, Git's packfiles do compress similar objects as deltas of each other, but that is an implementation detail beneath the snapshot model you work with.)

The index sits between the working directory and HEAD. When you run `git add`, Git takes the current version of the file from your working directory and writes it to the index. When you run `git commit`, Git takes everything currently in the index and creates a new commit object from it. Nothing in the working directory goes directly into a commit. It must pass through the index first.

This staging area design is deliberate. It lets you carefully choose exactly what goes into each commit, even when you have made many changes across many files. You can add part of a file's changes with `git add -p` (the patch flag), which walks through each modified chunk and asks whether you want to stage it.

```bash
# Stage individual hunks from a file interactively
git add -p myfile.cs
# Git presents each changed section and asks: Stage this hunk? [y,n,q,a,d,s,?]
```

The differences between the three trees map directly to the outputs of `git diff`:

- `git diff` (no arguments): compares the working directory against the index, showing changes that are not yet staged
- `git diff --staged` (or `--cached`): compares the index against HEAD, showing what is staged and will go into the next commit
- `git diff HEAD`: compares the working directory against HEAD, showing all changes since the last commit whether staged or not

```
  Working Directory          Index (Staging)           HEAD (Last Commit)
  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
  │ file.txt (v3)    │      │ file.txt (v2)    │      │ file.txt (v1)    │
  │ app.cs  (v2)     │      │ app.cs  (v2)     │      │ app.cs  (v1)     │
  │ new.txt (new)    │      │                  │      │                  │
  └──────────────────┘      └──────────────────┘      └──────────────────┘
         │                         │                         │
         ├── git diff ────────────►│                         │
         │                         ├── git diff --staged ───►│
         ├── git diff HEAD ────────┼────────────────────────►│
         │                         │                         │
         ├── git add ─────────────►│                         │
         │                         ├── git commit ──────────►│
```

---

## Basic Workflow

### Initializing and Checking Status

```bash
# Create a new repository in the current directory
git init

# Clone an existing repository
git clone https://github.com/user/repo.git

# Clone into a specific directory name
git clone https://github.com/user/repo.git my-local-name

# See the current state: branch, staged changes, unstaged changes, untracked files
git status

# Shorter output format
git status -s
```

The `git status` output groups changes into three sections: "Changes to be committed" (staged, in the index), "Changes not staged for commit" (modified tracked files, not yet staged), and "Untracked files" (files Git is not tracking at all).

### Staging and Committing

```bash
# Stage a specific file
git add src/MyClass.cs

# Stage all changes in the current directory and below
git add .

# Stage all tracked file changes (but not new untracked files)
git add -u

# Stage specific chunks from a file interactively
git add -p src/MyClass.cs

# Commit everything in the index with a message
git commit -m "Add user authentication to the login endpoint"

# Stage all tracked changes and commit in one step (skips untracked files)
git commit -am "Fix null reference in payment processor"
```

Write commit messages in the imperative mood ("Add feature", not "Added feature" or "Adding feature"). A good message describes what the commit does, not what you did. The common convention is a subject line of around 50 characters, then a blank line and a body wrapped at 72 characters that explains why the change was made. Tools like `git log --oneline` and hosting UIs show only the subject, so it has to stand on its own.

### Viewing History

```bash
# Show commit history
git log

# Compact one-line-per-commit format
git log --oneline

# Show a graph of branches and merges
git log --oneline --graph --all

# Show history for a specific file
git log --oneline -- path/to/file.cs

# Show the diff introduced by each commit
git log -p

# Show the last N commits
git log -5
```

### Viewing Differences

```bash
# Working directory vs index (unstaged changes)
git diff

# Index vs HEAD (staged changes, what the commit will contain)
git diff --staged

# Compare two commits
git diff abc1234 def5678

# Compare the tips of two branches
git diff main feature/my-work

# Show only what feature/my-work changed since it branched from main
git diff main...feature/my-work

# Show only which files changed, not the content
git diff --name-only main...feature/my-work
```

The three-dot form compares the feature branch against the point where it diverged from `main`, so commits that landed on `main` in the meantime don't show up as reversed changes. It's usually the form you want when reviewing what a branch actually did.

### Undoing Things

```bash
# Unstage a file (move it from index back to working directory only)
git restore --staged src/MyClass.cs

# Discard working directory changes for a file (destructive, not recoverable)
git restore src/MyClass.cs

# Amend the last commit (change message or add staged changes to it)
# Only safe to do before pushing to a shared branch
git commit --amend -m "Corrected commit message"

# Create a new commit that reverses the changes of a previous commit
# Safe to use on shared branches because it does not rewrite history
git revert abc1234
```

---

## Local vs. Remote

### Remotes

A remote is a named reference to another copy of the repository, typically on a server like GitHub or Azure DevOps. By convention, the remote you cloned from is named `origin`.

```bash
# List configured remotes
git remote -v
# Output:
# origin  https://github.com/user/repo.git (fetch)
# origin  https://github.com/user/repo.git (push)

# Add a remote named "upstream" (common when working with forks)
git remote add upstream https://github.com/original/repo.git

# Rename a remote
git remote rename origin old-origin

# Remove a remote
git remote remove upstream
```

### Tracking Branches

When you clone a repository, Git creates remote-tracking branches in your local repository for each branch on the remote. These are read-only snapshots of the remote's branch state at the time of the last fetch. They live under `refs/remotes/origin/` and appear in `git log --all` as names like `origin/main` or `origin/feature-branch`.

A local branch can be configured to "track" a remote-tracking branch. Tracking means Git knows which remote branch corresponds to this local branch, so it can display whether you are ahead, behind, or diverged when you run `git status`.

```bash
# When you push a branch for the first time, use -u to set the upstream
git push -u origin feature/my-work
# From now on, "git push" and "git pull" on this branch know where to go
```

### Fetch, Pull, and Push

```bash
# Download all changes from origin without merging anything
git fetch origin

# Download and integrate into the current branch
# git pull runs "git fetch" followed by "git merge" or "git rebase"
git pull

# Pull with rebase, replaying your local commits on top of the remote's
git pull --rebase

# Pull with a merge commit when the branches have diverged
git pull --no-rebase

# Push the current branch to origin
git push

# Push a specific local branch to a specific remote branch
git push origin feature/my-work:feature/my-work

# Delete a remote branch
git push origin --delete feature/old-branch
```

`git fetch` is the safe operation. It never changes your working directory or your local branches. It just updates the remote-tracking branches. `git pull` is a convenience command that runs fetch and then integrates the remote changes into your current branch.

How `git pull` integrates depends on configuration. When your branch has no local commits the remote lacks, it simply fast-forwards. When both sides have new commits, current Git versions refuse to guess. By default the pull fails and asks you to choose between merging and rebasing, either per pull with `--no-rebase` or `--rebase`, or permanently with the `pull.rebase` setting shown under Git Configuration below. If you want full control, run `git fetch` and then decide what to do with the fetched changes.

---

## Merge Commits vs. Fast-Forward Merges

When you merge one branch into another, Git has two modes of operation.

### Fast-Forward Merge

If the branch you are merging into has not diverged from the branch you are merging in (meaning the target branch is a direct ancestor of the source branch), Git can simply move the target branch pointer forward to the latest commit. No merge commit is created, and history remains linear.

```bash
# Before merge:
# main:    A -- B -- C
# feature:           C -- D -- E

git switch main
git merge feature

# After merge (fast-forward):
# main:    A -- B -- C -- D -- E
# feature:           C -- D -- E  (still points to E)
```

Fast-forward merges produce a cleaner, linear history. However, they can obscure the fact that a group of commits was developed on a feature branch. If you want to preserve that context, you can force a merge commit even when a fast-forward is possible:

```bash
git merge --no-ff feature
```

This creates a merge commit with two parents regardless of whether a fast-forward was possible, recording that these commits came from a feature branch.

### Merge Commits (Three-Way Merge)

When the two branches have diverged (both have commits the other does not have), Git performs a three-way merge using the common ancestor and the tips of both branches. If there are no conflicts, Git creates a merge commit automatically. If there are conflicts, Git pauses and asks you to resolve them before completing the merge.

```bash
# Both branches have diverged
# main:    A -- B -- C -- D
# feature:      B -- E -- F

git switch main
git merge feature
```

Rebase is the other way to integrate diverged branches. It replays one branch's commits on top of the other instead of joining them with a merge commit, which rewrites those commits' hashes, as the DAG section showed.

### Resolving Merge Conflicts

A conflict happens when both branches changed the same lines of a file since their common ancestor, or when one side edited a file the other deleted. Git merges everything it can, stops, and leaves the conflicting files in the working directory with markers around each disputed region:

```text
<<<<<<< HEAD
var timeout = TimeSpan.FromSeconds(30);
=======
var timeout = TimeSpan.FromSeconds(60);
>>>>>>> feature
```

The section between `<<<<<<<` and `=======` is the version on the branch you are merging into (HEAD), and the section after it is the incoming branch. Resolving the conflict means editing the file into the content you actually want, which might be either side, a combination, or something new, and deleting the markers.

```bash
# See which files still have conflicts
git status

# After editing each file, mark it resolved by staging it
git add src/PaymentClient.cs

# Once every conflict is staged, finish the merge
git commit
# (Git prepopulates the merge commit message)

# Or give up and return to the state before the merge started
git merge --abort
```

When the two sides alone don't make the right answer obvious, it helps to see what the line looked like before either branch touched it. Setting `merge.conflictStyle` to `zdiff3` adds a third section showing the common ancestor's version between the two sides:

```bash
git config --global merge.conflictStyle zdiff3
```

The same markers appear when a rebase, cherry-pick, or stash pop hits a conflict. The resolution step is identical, and only the command that continues or aborts the operation differs.

---

## Tags

Tags mark specific points in history as significant. They are most commonly used to mark release versions, such as `v1.0.0` or `release-2024-Q1`. Like a branch, a tag is a ref stored under `refs/tags/`, but it is meant to stay put: committing never moves it.

### Lightweight Tags

A lightweight tag is just a named pointer to a commit. It creates no tag object and stores no additional metadata.

```bash
# Create a lightweight tag at HEAD
git tag v1.0.0

# Create a lightweight tag at a specific commit
git tag v0.9.0 abc1234

# List all tags
git tag

# Filter tags by pattern
git tag -l "v1.*"
```

Lightweight tags suit temporary markers and local bookmarks. Git's own documentation reserves annotated tags for releases.

### Annotated Tags

An annotated tag is a full object in the Git database. It stores the tagger's name and email, the date, a message, and optionally a signature. Annotated tags have their own hash, separate from the commit they point to.

```bash
# Create an annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0, first stable release"

# Create a signed annotated tag (requires a GPG or SSH signing key)
git tag -s v1.0.0 -m "Release version 1.0.0"

# Show the tag object details (including the tagger and message)
git show v1.0.0

# Verify a signed tag
git tag -v v1.0.0
```

Annotated tags are the right choice for public releases. They record who tagged the release and when, separate from the commit author information. This matters when a build system or release automation creates the tag, not the original developer.

### Sharing Tags with Remotes

Tags are not pushed automatically with `git push`. You must push them explicitly.

```bash
# Push a specific tag
git push origin v1.0.0

# Push all local tags that do not exist on the remote
git push origin --tags

# Push commits plus only the annotated tags that point at them
git push --follow-tags

# Delete a tag locally
git tag -d v1.0.0

# Delete a tag on the remote
git push origin --delete v1.0.0
```

---

## .gitignore

`.gitignore` tells Git which untracked files to ignore. Git never ignores files that are already tracked. To make Git stop tracking a file, untrack it explicitly with `git rm --cached` and then add it to `.gitignore`.

### Pattern Syntax

Patterns in `.gitignore` follow these rules:

- A blank line or a line beginning with `#` is ignored
- A pattern with no slash, or only a trailing slash, matches at any depth below the `.gitignore` file
- A slash at the start or in the middle anchors the pattern to the directory containing the `.gitignore`
- A trailing `/` matches only directories
- `*` matches anything except a slash
- `**` matches across directories
- `!` negates a pattern, re-including a file that a previous pattern excluded

```gitignore
# Compiled output
bin/
obj/
*.dll
*.exe

# IDE files
.vs/
*.user
.idea/

# Sensitive configuration
appsettings.local.json
*.pfx
secrets.json

# OS-generated files
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Include a specific file that would otherwise be ignored
!src/Config/default-appsettings.json
```

### Multiple .gitignore Files

You can place `.gitignore` files in subdirectories, and they apply relative to that directory. This is useful for monorepos where different parts of the project have different ignore needs.

Beyond `.gitignore`, Git supports two other ignore mechanisms. `.git/info/exclude` works like a per-repository `.gitignore` but is not committed and not shared with others. The global gitignore file configured via `git config --global core.excludesfile` applies to all repositories on your machine, which is the right place for OS-specific ignores like `.DS_Store` or IDE-specific files you do not want to force on teammates.

---

## Git Configuration

Git configuration follows a layered hierarchy, where each level overrides the one above it. Every `git config` command that writes a value targets one of these levels, so the flag you pass decides who the setting affects.

| Level | Flag | Location | Scope |
|-------|------|----------|-------|
| **System** | `--system` | `/etc/gitconfig` (Linux/macOS), or `etc\gitconfig` under the Git for Windows install directory | All users on the machine |
| **Global** | `--global` | `~/.gitconfig` or `~/.config/git/config` | All repositories for the current user |
| **Local** | `--local` (the default when writing) | `.git/config` (inside the repository) | That repository only |
| **Worktree** | `--worktree` | `.git/config.worktree`, when `extensions.worktreeConfig` is enabled | One linked worktree of the repository |

A value passed on the command line with `git -c key=value` overrides all of them for that one command.

```bash
# Set your identity (required before committing)
git config --global user.name "Steven Stuart"
git config --global user.email "steven@example.com"

# Set the default editor for commit messages
git config --global core.editor "code --wait"

# Set the default branch name for new repositories
# (Git's built-in default is still "master"; Git 3.0 is planned to switch it to "main")
git config --global init.defaultBranch main

# Automatically set upstream tracking when pushing a new branch
git config --global push.autoSetupRemote true

# See all configuration values and where they come from
git config --list --show-origin

# Read a specific value
git config user.email

# Set a repository-local override (different email for a work project)
git config --local user.email "steven@company.com"

# Remove a setting
git config --global --unset core.editor
```

### Useful Global Defaults

Beyond identity, a few global settings meaningfully improve daily workflow:

```bash
# Always rebase when pulling (prevents accidental merge commits)
git config --global pull.rebase true

# Show the common ancestor in conflict markers
git config --global merge.conflictStyle zdiff3

# Correct minor typos in commands, running the guess after 1 second
# (the value is in tenths of a second; "prompt" asks first instead)
git config --global help.autocorrect 10

# Use a consistent line ending strategy (important on teams mixing OS)
# For Windows:
git config --global core.autocrlf true
# For Linux/macOS:
git config --global core.autocrlf input
```

Line ending configuration (`core.autocrlf`) deserves attention on mixed-OS teams. Windows uses CRLF line endings while Linux and macOS use LF. Without configuration, line ending differences can pollute diffs and cause unnecessary conflicts. Setting `autocrlf=true` on Windows tells Git to convert LF to CRLF on checkout and CRLF back to LF on commit, so the repository stores LF consistently. On Linux and macOS, `autocrlf=input` converts any accidental CRLF to LF on commit and leaves checkouts alone.

An alternative approach that is more explicit is to commit a [`.gitattributes`](https://git-scm.com/docs/gitattributes){:target="_blank" rel="noopener noreferrer"} file to the repository that declares line ending rules per file pattern, removing the dependency on each developer's local configuration.

---

## How the Object Store Keeps History Safe

"Losing" commits in Git rarely means what it sounds like. Objects are immutable once created, and branch operations like resets and rebases don't delete anything from the object store. What those operations change is which objects are reachable, meaning connected to a branch or tag through parent chains.

Git provides `git reflog` as a safety net. The reflog records every change to a ref, including HEAD, in your local repository. Entries are kept for 90 days by default, but entries for commits that are no longer reachable from any branch expire after 30 days (the `gc.reflogExpire` and `gc.reflogExpireUnreachable` settings), and the reflog is never shared with a remote:

```bash
# Show the reflog for HEAD
git reflog

# Output shows recent moves of HEAD:
# 4fd5ab1 HEAD@{0}: commit: fix mobile menu
# e3a12ec HEAD@{1}: commit: remove duplicate content
# 05773ed HEAD@{2}: rebase (finish): returning to refs/heads/main
# ...

# Recover a "lost" commit by creating a branch at its hash
git branch recovery-branch e3a12ec
```

If you reset a branch to an earlier commit and "lose" recent commits, they are still in the object store. The reflog shows the hashes of the commits that were on the branch before the reset. Create a branch there and the work is recovered.

Git's garbage collector (`git gc`, which Git also runs automatically from time to time) eventually deletes objects that nothing references anymore, neither a branch, a tag, nor a reflog entry, once they are older than two weeks by default. In practice that gives you about a month to recover a commit you walked away from, which covers most day-to-day mistakes if you act promptly. It does not cover uncommitted work: changes that were never staged or committed never became objects, so a destructive `git restore` or `git reset --hard` loses them for good.
