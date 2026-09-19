---
title: "Gas City: Orchestrating Fleets of Coding Agents"
layout: guide
category: AI & Machine Learning
subcategory: AI in Engineering Practice
description: "What it takes to run many coding agents reliably and how Gas City provides it, covering its origin in Gas Town, the six primitives, the reconciling orchestrator and health patrol, formulas, sling, and orders, runtime providers, trust boundaries, and when a simpler setup is enough."
tags: [gas-city, gas-town, multi-agent, orchestration, health-patrol, advanced]
---

[Gas City](https://github.com/gastownhall/gascity){:target="_blank" rel="noopener noreferrer"} is an open-source toolkit for building systems that run many coding agents at once on long-lived engineering work. It does not supply a fixed team of agents. It supplies the machinery underneath one: durable work tracking, a supervisor that keeps agents running, a way to express multi-step methods that fan out across agents, and a configuration format for describing the team. Its [documentation](https://docs.gascity.com/){:target="_blank" rel="noopener noreferrer"} is the primary reference for everything below, and its [architecture notes](https://github.com/gastownhall/gascity/tree/main/engdocs/architecture){:target="_blank" rel="noopener noreferrer"} describe how each subsystem works in the code. By default, Gas City stores its work in [Beads](https://github.com/gastownhall/beads){:target="_blank" rel="noopener noreferrer"}, a dependency-aware issue tracker for agents.

The general trade-offs of multi-agent systems, what parallel agents buy and what they cost, are covered in [AI Agents](/study-guides/ai/ai-agents.html).

---

## What Breaks When One Agent Becomes Twenty

### Sessions Die and Take Their Work With Them

An agent session is a process with a context window. It crashes, hits a rate limit, runs out of context, or wanders off task, and when it ends, whatever it knew about its work in progress ends with it. With one agent, a person notices and restarts it. With twenty, sessions end continuously, and the question becomes whether the work they were doing survives them.

### Someone Has to Hand Out Work

Parallel agents need a source of work that tells each one what to do next without handing two of them the same task. A person dispatching by hand becomes the bottleneck well before twenty agents, and a script that assigns tasks up front cannot react when a task fails, spawns follow-up work, or turns out to depend on another.

### Stalled Agents Go Unnoticed

An agent that crashes is easy to detect. An agent that sits idle, exhausts its context and stops making progress, or keeps restarting and crashing is not, and each one quietly holds work that nothing else will pick up. At fleet scale, something has to watch every session and act on what it sees.

### Hand-Rolled Coordination Doesn't Travel

Teams that run several agents by hand accumulate the arrangement in scattered places, like role prompts in one directory, setup steps in a chat thread, and conventions in someone's memory. The arrangement works for the person who built it and cannot be reviewed, versioned, or reused by anyone else.

---

## From Gas Town to Gas City

Gas City grew out of [Gas Town](https://github.com/gastownhall/gastown){:target="_blank" rel="noopener noreferrer"}, the multi-agent orchestrator Steve Yegge released at the start of 2026. Gas Town ran a fixed cast of roles, each with a name and a job: a Mayor that coordinates, Polecats that do the coding, a Refinery that merges, a Witness and a Deacon that watch over the others, Dogs for maintenance chores, and Crew workspaces where a person works hands-on alongside the agents. The cast worked, but it was hardcoded, so a team that wanted a different shape of organization had to fight the tool.

Gas City, built by Julian Knutsen and Chris Sells, extracts the reusable machinery from Gas Town and removes the roles from the engine entirely. The orchestrator hardcodes no roles at all, with no built-in manager or reviewer. Every role is configuration, and Gas Town itself becomes one configuration that Gas City can load.

| Gas Town role | In Gas City |
| --- | --- |
| Mayor | A configured agent with a coordinating prompt |
| Polecats | A pool of interchangeable agents, sized by configuration |
| Crew | A persistent agent configuration |
| Refinery | A post-processing agent that runs as a workflow step |
| Deacon | The orchestrator's built-in health patrol, optionally paired with a configured agent |
| Witness | Optional behavior built from events and formulas |
| Dogs | Orders that run shell commands, or an agent for work that needs a model |

The shift from roles to primitives is what makes Gas City a toolkit rather than a product. The same engine becomes a different orchestrator depending on which configuration it loads.

---

## The Six Primitives

Everything in Gas City is built from six user-facing primitives.

| Primitive | Answers | What it is |
| --- | --- | --- |
| Agent | Who | A configured worker: name, provider, prompt template, and scope |
| Bead | What | One unit of durable work, stored in Beads |
| Formula | How | A reusable, written-down method that produces work when applied |
| Rig | Where | An external project, usually a Git repository, registered with the city |
| Pack | Configures | A directory of configuration declaring agents, formulas, orders, and more |
| Event | Observe | An immutable notification fired by activity, for people and agents to watch |

**Beads are the universal store.** Tasks, mail between agents, session records, and convoys (batches of related work) are all beads that differ only by type. Because every piece of state lives in one durable store, anything that crashes can be rebuilt from what the store holds.

**A rig scopes work and agents.** Each registered project gets its own bead namespace and its own agent scope, so rig-scoped agents working on one repository do not pick up work belonging to another. Each rig has its own bead store, by default a prefix-scoped namespace on the city's shared Dolt server, and only city-scoped agents serve work across stores. The city runs one Dolt server, and each rig's `.beads/` configuration points at it with its own issue prefix, which `bd` applies as a filter on every read and write. Running `bd list` inside one rig does not show another rig's beads, even though both sit in the same database.

{% include figure.html id="bd-claim-topology" %}

**The city is itself a pack.** A pack is a directory whose `pack.toml` declares agents, prompt templates, formulas, orders, and supporting files. The city directory is the root pack, and it imports shared packs by name, so a team definition can be versioned, reviewed, and reused like code. Imported definitions read the same as local ones, and later layers override earlier ones in a fixed order, so a city can adopt a published pack and adjust only what it needs. For formulas, the layers run from system formulas embedded in the `gc` binary, through imported packs, to the city's own formulas, and a rig adds its own imports and local formulas on top of the city's. The winning file for each name is staged as a symlink in that scope's `.beads/formulas/` directory, where `bd` finds it.

{% include figure.html id="gc-pack-layering" %}

---

## The Orchestrator

### One Supervisor Hosts Every City

A machine runs one `gc supervisor` process. It hosts an orchestrator for each registered city, which the code calls the controller, along with a typed HTTP and Server-Sent Events API that the `gc` CLI and the built-in dashboard both use. The API listens on the loopback address by default. A lock file in the city's `.gc/` directory keeps a second controller from running against the same city.

{% include figure.html id="gc-containers" %}

### Reconciling Desired State Against Running Sessions

The orchestrator is a control loop. On each tick, 30 seconds by default, it reloads configuration if it has changed, works out which agents and how many sessions should be running, compares that against what is running, and starts, stops, or restarts sessions to close the gap. It then evaluates orders and dispatches any whose trigger has fired. This is the same reconciliation pattern that Kubernetes applies to containers, applied to agent sessions.

The steps run in a fixed order. A file watcher marks the configuration dirty between ticks, and a reload that fails validation keeps the previous configuration instead of stopping the city. Pool sizes come from each pool's `scale_check` command, and the checks run in parallel, though a check that hangs holds up the whole tick. Sessions are themselves tracked as session beads, so reconciliation compares three things: the session beads, the live processes the runtime provider reports, and the configuration. Between reconciling sessions and dispatching orders, the tick also deletes closed wisps older than a configured time-to-live.

{% include figure.html id="gc-controller-tick" %}

### State Lives in the Store, Not in Callbacks

The orchestrator acts on sessions but never waits for sessions to report back to it. It reads progress from the bead store and the event bus. This is what makes the system survive crashes on both sides. When an agent dies, its work stays in the store, still in progress. When the orchestrator itself restarts, it adopts the sessions it finds still running rather than respawning them, and it resumes from the ground truth in the store.

The event bus is separate from the bead store. By default it is an append-only JSON Lines file in the city's `.gc/` directory, and every event carries an increasing sequence number, so a watcher can replay the stream from any point. Bead, session, convoy, and order activity all record events there, and event-triggered orders read the same stream people watch.

{% include figure.html id="gc-crash-recovery" %}

Sessions are disposable by design. An agent with on-demand sessions spins them up when work arrives and lets them go when idle. An always-on named session stays available for a person to attach to and talk with. A pool of identical sessions scales between a configured minimum and maximum against one shared queue of work.

### Health Patrol Supervises Like Erlang

Health patrol is the orchestrator's supervision logic, modeled on the Erlang/OTP supervisor. On every tick it looks for conditions including these. A session whose process is gone has crashed, and health patrol captures its terminal output for diagnosis before restarting it. A session with no activity past its idle timeout, which each agent opts into, is stalled. A session whose command or environment no longer matches configuration has drifted, which health patrol detects by comparing a hash of the session's command and environment with the current configuration. An agent that has exhausted its context can also ask to be restarted. Each one is corrected by restarting or replacing the session. Sessions that no longer belong to the configuration are drained gracefully when they are surplus pool members and stopped outright when they are true orphans.

The model is "let it crash." Agents are not expected to recover themselves. They die and are replaced. Restarts are one-for-one, in OTP terms: only the failed session restarts, with no cascade to agents that work alongside it. To stop a broken agent from restarting forever, health patrol counts restarts in a sliding window and quarantines an agent that reaches the limit (five restarts within an hour, by default) until the window passes. The crash counts, idle timers, and in-flight order state are all held in memory, following OTP's rule that a restarted supervisor starts its children's counts from zero, so quarantine resets if the orchestrator itself restarts.

{% include figure.html id="gc-health-patrol" %}

---

## How Work Moves

### Formulas Become Graphs of Beads

A formula is a TOML file describing a method: its steps, the dependencies between them, the variables that parameterize it, and the control flow around it. Applying a formula materializes it as beads, and from then on the run is independent of both the file and any session.

Gas City has two formula contracts. A formula uses the first unless it declares the second, and the documentation recommends the second for new work.

| | v1 | v2 (workflows) |
| --- | --- | --- |
| Executed by | One agent, end to end | The orchestrator, across agents and pools |
| Steps | Fixed when the formula is applied | Independently routable units |
| Control flow | None once started | Check, retry, fan-out, and tally loops |
| Shape | Parent and child steps | A flat graph of blocking edges |

Under v2, the orchestrator drives the run, fanning ready steps out to agents and pools and holding each downstream step until its dependencies close. Under v1, the agent the run was sent to works through every step itself.

A v2 formula compiles into three kinds of bead. The workflow root represents the run. Step beads are ordinary work, and each can be routed to a different agent or pool. Control beads hold the method's control flow, such as a drain that fans work out, a check, a retry, and a final workflow-finalize step. No model executes a control bead. The control dispatcher does, a deterministic `gc` process that the built-in core pack declares as an agent with no prompt. It runs as a session like any other, one for each bead store, and it claims routed control beads through the store the same way agents claim work. The root depends on the finalize step, so it becomes ready only when the whole workflow has finished.

{% include figure.html id="gc-formula-contracts" %}

### Sling Creates and Routes in One Step

Applying a formula has three verbs. **Cook** compiles it and writes the beads without routing them. **Sling** cooks and routes in one motion, naming a target agent or pool and letting Gas City resolve the rest. **Orders** apply a formula automatically each time a trigger fires. Sling is the everyday dispatch verb, used by people and by agents alike when they hand work onward.

### Routed Work Finds Its Session

Dispatch does not hand work to a particular session. It stamps each bead with the agent or pool it is routed to and leaves it in the store. Work for a pool gets a `gc.routed_to` metadata field naming the pool, and work for a named agent gets that agent as its assignee. On each tick, the orchestrator counts ready, unassigned work routed to each pool and starts sessions to meet the demand, up to the pool's maximum.

When a session starts, its hook looks for work in three tiers and takes the first it finds:

1. Work already assigned to this agent or session and in progress, which is how a restarted agent resumes a task it was in the middle of
2. Ready work assigned to this agent or session
3. Ready, unassigned work routed to it, highest priority first and oldest first within a priority, which the session then claims

A session that finds nothing exits cleanly.

This ordering is what makes "let it crash" work in practice. When a session dies mid-task, its bead stays in the store, still in progress and still assigned. When the agent comes back, the first thing its hook finds is that unfinished bead, so it resumes rather than starting something new. Work belongs to the store, not to the session that happened to be running it.

The claim itself is a `bd update --claim` that the agent's prompt tells it to run, and `bd` performs it as an atomic compare-and-swap. Gas City's own code does not enforce the claim. It makes the work visible and routes it, and the prompt tells the agent to run whatever it finds.

{% include figure.html id="gc-routed-work" %}

### Spawning and Claiming Must Agree

Two readers ask the store the same question. The orchestrator's `scale_check` counts ready, unassigned work routed to a pool to decide whether the pool needs another session, and a new session's third hook tier claims the first bead of that same set. Gas City builds both queries from one shared predicate. When an earlier version let them drift apart, the orchestrator counted beads that sessions would never claim, so sessions started, found nothing, exited, and were started again on the next tick, in a loop the project calls a spawn storm. A team that overrides `scale_check` or `work_query` for a pool steps outside that shared predicate and inherits the job of keeping the two in agreement. Configuration validation covers only the write side, rejecting a pool that customizes `sling_query` without also customizing `work_query`.

{% include figure.html id="gc-claim-rules" %}

### Orders Decide When Work Happens

Formulas describe what work looks like, and orders describe when it happens. An order pairs a trigger with an action, and the orchestrator checks every order's trigger on each tick.

| Trigger | Fires when |
| --- | --- |
| Cooldown | A set interval has passed since the last run |
| Cron | The wall clock matches a schedule |
| Condition | A shell command exits successfully |
| Event | A named event appears on the event bus |
| Manual | Only when invoked by hand |

A formula order sends work to a pool of agents. An exec order runs a shell script directly on the orchestrator with no agent involved, which suits mechanical chores like pruning branches or running a linter. Before dispatching, the orchestrator checks that the order has no open work already, so a slow run is not buried under repeat firings. Orders replaced Gas Town's plugins, and they are how a city does anything on its own initiative, like a scheduled dependency upgrade or periodic cleanup.

### Agents Coordinate Through the Store

Agents never reference each other directly. They coordinate through two indirect channels, **mail** and **slung work**, and a third, lighter mechanism for live sessions.

| Channel | Stored as | Survives a crash | Suits |
| --- | --- | --- | --- |
| Mail | A bead | Yes | Messages that must be read, with a subject |
| Slung work | Beads routed to an agent or pool | Yes | Delegating a task |
| Nudge | Input typed into the session's terminal | No | Waking a session or redirecting it right away |

Gas City wires these channels into each agent through hooks in the agent's harness. It installs them automatically for Claude Code, and for other harnesses when the agent lists them in its `install_agent_hooks` setting. The hooks fire at session start, before each turn, and just before the harness compacts its context. They prime the agent, deliver unread mail into its context, drain queued nudges, and save a handoff before a context cycle, so messages arrive without the agent polling for them. Mail does not wake a sleeping recipient, though. It waits for that agent's next turn unless the sender asks for a notification or follows up with a nudge.

{% include figure.html id="gc-coordination" %}

### Reliability Comes From the Method

Because any single agent can misread a task or produce broken work, v2 formulas build reliability into the method. A **check** re-runs a step until a verification script passes, up to a limit. A **retry** re-runs only on transient failures. A **review loop** fans out several independent review lanes, synthesizes their findings, applies fixes, and repeats until a check passes. Each of these costs more model usage, so reliability becomes a setting the formula's author chooses per workflow instead of a property of the model.

---

## Where Agents Run

Gas City separates what an agent is from where its session runs. The **harness** is the coding agent CLI that does the work, and Gas City ships built-in support for sixteen, including Claude Code, Codex CLI, Gemini CLI, Cursor Agent, and GitHub Copilot. Each agent chooses its own, so one city can run a mixed fleet of harnesses.

The **runtime provider** decides where sessions live, and it is set once for the whole city. The default runs each session in a tmux pane on the local machine, which a person can attach to and watch. Other providers run sessions as headless subprocesses, as Kubernetes pods, over SSH on another host, or through a custom script, so the same city configuration can move from a laptop to a cluster.

---

## Trust Boundaries

Gas City runs shell commands in many places, like exec orders, session providers, and dispatch, and its documentation is explicit that "those commands are a feature, not a sandbox." They can do anything their execution context can do.

The trust model separates three main kinds of input. City configuration is trusted operator code and deserves review like any code that runs commands. Imported packs are trusted dependency code, so they should be pinned to a version and reviewed before use, the same care owed to any third-party script. Bead titles, pull request text, and other user-controlled content are untrusted data and must never be concatenated into a shell command, because an agent that files a bead titled with a shell payload has just written a command for the orchestrator to run. The orchestrator strips environment variables with names like `TOKEN` and `API_KEY` from the shell commands it runs itself, like order checks and exec orders, but values placed explicitly in configuration pass through by design.

{% include figure.html id="gc-trust-boundaries" %}

---

## When Gas City Is Worth It

Gas City solves the problems of many long-running agents working a shared, evolving body of work. Most agent use does not have those problems yet.

| Situation | Fit |
| --- | --- |
| One agent, one session at a time | No orchestration needed |
| A batch of independent, similar tasks | A fresh session per task, launched by a script, is simpler and cheaper |
| One agent on multi-day work | Beads alone gives durable memory without an orchestrator |
| Several agents on a shared backlog, occasionally | Beads on a shared database, with agents started by hand |
| A standing team of agents with recurring workflows, reviews, and automation that must run unattended | Gas City |

### What Adoption Costs

Gas City is free and MIT-licensed, and the direct cost is model usage, which scales with every pool, review lane, and retry the configuration adds. The operational cost is less visible. A city depends on tmux, Git, jq, Dolt, and the Beads CLI, among other tools (a file-based store can stand in for Dolt and Beads in minimal setups), keeps its own state on disk, and has runbooks for problems like Dolt history growing out of control. The project also reached 1.0 only in April 2026, so its concepts and configuration format are still settling, and a team adopting it should expect to track upstream changes.

---

## Common Pitfalls

**Running an important workflow through one agent.** A single agent is a single point of failure for quality as well as uptime. Use a v2 formula with a check or review loop for any workflow whose output ships.

**Keeping the team in prompts instead of packs.** Role prompts, setup steps, and conventions scattered across files and chat history are the hand-rolled coordination Gas City exists to replace. Put them in the city's pack, where they are versioned and reviewable.

**Starting new work on v1 formulas.** A v1 run is bound to one agent and cannot be routed to a pool or recover with checks and retries. New formulas should declare the v2 contract.

**Letting untrusted text reach a shell.** Anything an agent or an outside contributor wrote, including bead titles and PR descriptions, is data. Pass it through environment variables or files, never through command interpolation.

**Sizing pools without a budget.** A pool's maximum size also caps how much it can spend at once. Set limits against what the work is worth, and let queues wait rather than scaling every pool to its ceiling.
