---
title: "Beads: Durable Work Memory for Coding Agents"
layout: guide
category: AI & Machine Learning
subcategory: AI in Engineering Practice
description: "Why coding agents lose track of work between sessions and how Beads fixes it with a dependency graph of work items stored in Dolt, covering ready-work computation, claiming, hash IDs, sync topology, formulas and molecules, agent integration, adoption cost, and when a plain task list is enough."
tags: [beads, dolt, agent-memory, task-tracking, dependency-graph, practical]
---

[Beads](https://github.com/gastownhall/beads){:target="_blank" rel="noopener noreferrer"} is an issue tracker built for coding agents rather than for people. It stores work as a graph of small items with typed dependencies, keeps that graph in a version-controlled database next to the code, and answers one question an agent asks constantly: what can I work on right now? Its command-line tool is `bd`, and its [documentation](https://beads.gascity.com/){:target="_blank" rel="noopener noreferrer"} is the primary reference for everything below.

---

## Why Agents Lose Track of Work

### Every Session Starts Blank

A coding agent knows only what is in its context window. When a session ends, or when the context is compacted to make room, the agent's understanding of what it finished, what it deferred, and what it found along the way goes with it. Crossing a session boundary is routine and cheap on its own. Agents are started fresh all the time, to keep context small or to run an expensive phase of work separately, and re-priming a new session costs little when the task can be restated in a paragraph. The cost lands on projects that have been running long enough to accumulate their own history of decisions, deferrals, and findings, where no such paragraph exists. There the agent either re-derives the state of the project from the code or trusts whatever notes survived.

### Markdown Plans Decay

The usual fix is a plan file the agent reads at the start of each session. Plans work for a while and then drift. An agent that finishes step four may not mark it done, an agent that discovers a bug mid-task may note it in prose three screens away from where anyone will look, and after a few rounds the file holds several overlapping lists, none of them current. Prose also cannot answer a structural question. Nothing in a Markdown list says that step seven cannot start until steps three and five are closed, so the agent has to infer ordering from wording every time it reads the plan.

### Parallel Agents Collide

With more than one agent, a shared plan file becomes a merge conflict. Two agents on separate branches both append "task 12," both pick the same next item, or both edit the same checklist line. Sequential numbering needs a central counter, and parallel agents have no counter they can safely share.

---

## The Work Graph

### A Bead Is a Unit of Work

A bead is one tracked item with an ID, title, description, type, priority from 0 (critical) to 4 (backlog), and status. The common types are bug, feature, task, epic, and chore, and the common path through the statuses runs from open to in progress to closed, with others for blocked and deferred work. Beads can also carry labels, comments, an assignee, acceptance criteria, and a deferral date.

Epics hold child beads, and children get IDs derived from the parent's, so an epic's subtasks read as `bd-a3f8.1`, `bd-a3f8.2`, and so on, up to three levels deep.

### Dependencies Decide What Is Ready

Beads are connected by typed edges, and the type determines whether an edge affects scheduling. Only blocking types hold work back.

| Edge type | Blocks ready work | Meaning |
| --- | --- | --- |
| `blocks` | Yes | The dependent cannot start until the blocker closes |
| `parent-child` | Indirectly | A child is held back while its parent is blocked |
| `conditional-blocks` | Yes | The dependent runs only if the blocker fails, for error-handling paths |
| `waits-for` | Yes | The dependent waits for all of another bead's children, for fan-in |
| `related`, `tracks`, `discovered-from`, `caused-by`, `validates`, `supersedes` | No | Annotations that record context without affecting order |

A bead is **ready** when it is open and every blocking dependency is closed, and when it is not deferred or waiting on a gate. The set of ready beads is the frontier of the graph. It holds everything an agent could pick up right now without stepping on unfinished prerequisites.

{% include figure.html id="bd-ready-frontier" %}

Closing the schema bead released the API and migration beads at once, so two agents could take them in parallel, and one already has. The rollout stays off the frontier until both close and its gate clears. The flaky-test bead filed mid-task is ready too, because a provenance edge never blocks. The agent never reasons about this ordering itself. It asks for ready work and gets back exactly the API bead and the flaky test.

Beads checks for cycles when a dependency is added and rejects one that would close a loop. The check can be skipped, and the documentation includes a recovery procedure for cycles that get in anyway, so the check keeps the graph sound in normal use rather than guaranteeing it.

### Claiming Takes Work Off the Frontier

When an agent takes a ready bead, it claims it. The claim sets the assignee and moves the bead to in progress in one operation, and if two agents try to claim the same bead in the same database, the first wins. This is what lets several agents draw from one ready set without a coordinator handing out assignments. The guarantee holds only within a single database, which the sync section below makes concrete.

### Discovered Work Gets Recorded, Not Remembered

Agents routinely find problems outside the task they are on, like a flaky test, a missing index, or a function with an off-by-one error. In a plan-file workflow those findings live in the session transcript and vanish with it. With Beads, the agent files a new bead linked to the current one with a `discovered-from` edge. The finding survives the session, carries its provenance, and enters the same prioritization as everything else instead of derailing the task in hand.

---

## Storage and Sync

### Hash IDs Remove the Need to Coordinate

Bead IDs are short hashes derived from the title, the creation time, and a random salt, such as `bd-a1b2`. Two agents on different branches can each create a bead without either knowing the other exists, and the IDs are very unlikely to collide when the branches merge. The length adapts to the size of the database, starting at four characters and growing as the bead count rises (to five past 500 beads and six past 1,500 by default), so collisions stay improbable without anyone managing it.

### Dolt Is the Source of Truth

Beads stores its data in [Dolt](https://www.dolthub.com/){:target="_blank" rel="noopener noreferrer"}, a SQL database with Git-style versioning: branches, commits, diffs, merges, push, and pull, applied to tables. In embedded mode, every write is committed to Dolt's history by default. Earlier versions of Beads kept a SQLite database and synced through a JSONL file committed to Git. Current versions can still export `.beads/issues.jsonl` for viewers, migration, and backup, but the export is off unless configured, and it is not how data moves between machines.

Dolt runs in one of two main modes, and the choice turns on how many processes write at once.

| Mode | Writers | Suits |
| --- | --- | --- |
| Embedded (default) | One process at a time, enforced by a file lock | A single agent, scripts, CI, containers |
| Server | Many concurrent writers through a `dolt sql-server` process | Several agents writing to the same database |

Only configuration lands in Git. `bd init` writes a `.gitignore` that keeps the database directory (`.beads/embeddeddolt/` in embedded mode, `.beads/dolt/` in server mode) and the server's runtime files out of commits. `.beads/config.yaml` and `.beads/metadata.json` are tracked, so every clone agrees on the storage mode, the issue prefix, and the sync remote.

{% include figure.html id="bd-containers" %}

### Sync Rides Alongside the Code

To share beads across machines, `bd` pushes and pulls Dolt history through a remote. That remote can be the same Git origin as the code, because Dolt stores its data under a separate ref (`refs/dolt/data`) that never appears in a source branch. A plain `git clone` does not fetch that ref, so a new clone runs Beads' bootstrap step to pull the issue history down before its first use.

{% include figure.html id="bd-claim-topology" %}

The two layouts behave differently under contention. In server mode every agent claims against one database, so claiming is a true lock. Across clones, each agent claims against its own local copy, and two agents can both claim the same bead before either pushes. Dolt merges at the level of individual cells, so most concurrent changes to different beads or different fields merge cleanly, but a double claim is only discovered at merge time, as a conflict or as a silent merge of two agents' identical claims. The Beads documentation advises against concurrent modification from multiple clones without a Dolt server for this reason. Parallel agents that need to draw from the same backlog belong on one shared database. Gas City takes this route. It runs one Dolt server for each city and gives every registered project an issue prefix on that server instead of a database of its own.

Sync is also explicit. A change is local until it is pushed, so an agent that closes three beads and ends its session without pushing leaves every other agent working from a stale graph. The Git hooks Beads installs do not change this. They are thin shims that call `bd hooks run`, the pre-commit hook refreshes the JSONL export when export is enabled, and none of them push Dolt history.

### Bead State Is Separate From Code State

Because bead history lives on its own ref, closing a bead does not mean its code has merged. An agent can close the bead for a feature on a branch that is later abandoned, and the graph will report the work as done. A plan file committed with the code at least travels with that code. Beads trades that coupling for a single shared view of work across branches, and gates, covered below, are the mechanism for tying a step to an outside fact like a merged pull request.

---

## Repeatable Workflows

### Formulas, Protos, and Molecules

Some work has the same shape every time, like a release, a dependency upgrade, or a security review. Beads captures that shape as a **formula**, a TOML or JSON file that declares steps, the steps each one needs before it can start, and variables such as a version number. Compiling a formula with `bd cook` produces a **proto**, a template epic. Pouring the proto with `bd mol pour` produces a **molecule**, an epic whose children are ordinary beads wired with the formula's dependencies. The CLI names these phases after states of matter. The proto is the solid phase, a reusable template carrying a `template` label that is not yet live work. The molecule is the liquid phase, persistent and synced like any other bead. Wisps, covered below, are the vapor phase.

{% include figure.html id="bd-workflow-phases" %}

Because a molecule's steps are just beads, they flow through the same ready computation as everything else. Steps with no dependency between them are ready at the same time and can run in parallel. The formula expresses the method once, and each run of it becomes durable, queryable work. Molecules can also be bonded to build a larger workflow out of smaller ones, most often by making one depend on another.

A formula pays off only for work that recurs. For a one-off body of work, an epic with hand-written children is simpler.

### Gates Wait on the Outside World

A **gate** blocks a bead until something outside the graph happens. It appears in the graph like any other blocker, so the waiting step stays off the ready frontier until the gate clears. How it clears depends on the type.

| Gate | Clears when | How it is resolved |
| --- | --- | --- |
| Human | Someone approves | Only by explicit manual resolution |
| Timer | A duration elapses | The next gate check after the time passes |
| GitHub run | A CI run passes | A gate check that queries GitHub |
| GitHub PR | A pull request merges | A gate check that queries GitHub |
| Bead | Another bead closes | A gate check for beads in the same database; manual resolution for beads in another project |

Gate checks do not run by themselves. The documentation recommends running them on a schedule, from cron, CI, or an orchestrator loop, so timer and GitHub gates close without a person or an agent watching for them.

### Wisps Keep Operational Runs Out of the Record

A **wisp** is an ephemeral molecule, instantiated from a proto with `bd mol wisp` instead of `bd mol pour`. Its beads are flagged as ephemeral, hidden from the ready query unless explicitly included, excluded by default from federation (which shares beads between separate databases), and deletable in bulk afterward. Wisps suit routine operational runs, like a diagnostic sweep or a pre-release checklist, whose individual steps have no value once the run is over. If a wisp turns up something the project should keep, squashing it leaves a permanent digest. Burning it deletes it outright.

---

## Wiring Beads Into an Agent

### Priming Instead of Tool Schemas

An agent has to know Beads exists and how to use it. Beads recommends a command-line integration over a [Model Context Protocol](https://modelcontextprotocol.io/){:target="_blank" rel="noopener noreferrer"} server wherever the agent has a shell. A session-start hook runs `bd prime`, which injects a short summary of the workflow and the project's stored memories, and the agent calls `bd` directly from then on. The [Beads Claude Code integration docs](https://beads.gascity.com/integrations/claude-code){:target="_blank" rel="noopener noreferrer"} estimate this at 1,000 to 2,000 tokens, against 10,000 to 50,000 for MCP tool schemas loaded into every request. The MCP server remains the option for clients with no shell. Because the hook also fires after context compaction, the agent's workflow knowledge is restored at the moment it would otherwise be lost.

### The Session Discipline

Beads only works if the agent treats the graph as the record of work rather than an optional log. The pattern the documentation recommends has three parts:

- **At the start of a session,** ask for ready work and claim one bead, rather than choosing work from memory or from a plan file.
- **During the session,** file anything discovered as a new bead linked to the current one, and add blocking edges when new work must precede existing work.
- **At the end,** close finished beads and push, so the next session, on this machine or another, starts from the true state.

These instructions belong in the project's agent instructions file (`AGENTS.md`, `CLAUDE.md`, or the equivalent), which Beads' setup commands write for the major coding agents.

### Memories and Cleanup

Beads also stores **memories**, short project facts like "run tests with the race detector" that are injected at prime time, so knowledge that is not tied to any single bead still reaches every session.

A graph that only grows eventually costs space and query time, since every write adds history. Garbage collection deletes old closed beads and squashes old Dolt commits, which also means past states do not stay queryable forever. A separate compaction mode replaces old closed beads with short summaries. The documentation calls it "permanent graceful decay" because the original content leaves the live record, though it can be restored while a pre-compaction snapshot or the Dolt history still holds it.

---

## When Beads Is the Right Tool

Beads earns its setup cost on a long-running body of work whose full scope is not known at the start, and on any backlog that several agents draw from. It adds overhead without benefit when the work is something you could write down completely before beginning it.

The number of sessions is a weak signal on its own. Splitting one task across several sessions is ordinary practice, whether to keep context small or to run costly phases separately, and a plan file carries a task like that well enough, because the list of steps does not move while you work through it. The list moving is what a tracker is for. On a project with open-ended scope, closing one item reveals two more, a bug found in passing has to go somewhere, and the ordering between items keeps shifting as the work teaches you what it actually involves. Maintaining that graph by hand in prose is where plan files come apart.

| Situation | Fit |
| --- | --- |
| A task whose steps you could write down before starting, however many sessions it takes | A plan file holds it. The steps do not move while you work |
| A long-running project with open-ended scope, where finished work keeps producing new work | Beads. This is the core case |
| Several agents drawing from the same backlog | Beads on one shared server-mode database |
| A human team planning in a web UI with dashboards and cross-repo reporting | GitHub Issues, Jira, or Linear. Beads can sync with these in both directions when agents also need the work |
| Repeatable multi-step processes such as releases | Beads formulas and molecules |

The Beads FAQ says it is usable by people, since the ready query helps anyone managing dependencies, but it is designed for agents that need offline, version-controlled work memory with graph semantics. Every query runs against the local database, so it works without a network connection.

### What Adoption Costs

Beads brings Dolt with it, which is a second versioned store to install, sync, back up, and occasionally repair alongside Git. Initializing a project writes configuration under `.beads/`, adds or updates the agent instructions file, and installs Git hooks by default, all of which land in a shared repository and affect everyone who clones it. For someone who wants Beads on a repository they do not control, the project offers a stealth mode that keeps Beads' files out of commits and skips the hooks and agent files, and a contributor mode that routes planning into a separate repository, so personal work tracking stays out of the upstream project.

---

## Common Pitfalls

**Syncing through the JSONL export.** Older tutorials describe committing `issues.jsonl` to Git as the sync mechanism. Importing it is upsert-only and cannot tell that a bead absent from the file was deleted, so syncing this way leaves beads deleted elsewhere alive in every clone that imports it. Sync through Dolt push and pull.

**Using a non-blocking edge where ordering matters.** A `related` or `discovered-from` edge does not hold work back. If B truly cannot start before A, the edge has to be `blocks`, or B will appear on the ready frontier early and an agent will start it.
