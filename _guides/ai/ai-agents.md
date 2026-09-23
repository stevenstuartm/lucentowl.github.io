---
title: "AI Agents"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "How a language model becomes a system that completes tasks, covering the observe-think-act loop, where each step actually executes, planning and memory, multi-agent patterns and what they cost, and the guardrails that stop a loop running away."
tags: [agents, react, multi-agent, orchestration, planning, guardrails, practical]
---

An **agent** is a language model placed in a loop with tools, pursuing a goal over many steps instead of answering one question. The model decides what to do next, something outside the model carries it out, the result comes back, and the loop runs again until the goal is met or a limit stops it. That loop is the whole idea. Everything else here is about making it terminate, stay on task, and avoid doing damage on the way.

## What Makes a System an Agent

What separates an agent from a chatbot or a workflow is not intelligence but control flow, meaning who decides what happens next.

| | Chatbot | Workflow | Agent |
|---|---|---|---|
| **Decides the next step** | The user | The developer, in advance | The model, at each step |
| **Tool access** | None | Fixed calls at fixed points | Chooses which tool, and when |
| **Termination** | When the user stops | The end of the defined path | Goal met, or a limit trips |
| **Predictability** | High | High | Lower, since the path varies per run |
| **Debugging** | Read the transcript | Follow the defined path | Reconstruct the reasoning behind each step |
| **Cost** | One call | Known in advance | Variable, and unbounded without limits |

Flexibility is the only thing an agent buys, and it is paid for in predictability, debuggability, and a bill nobody can forecast. Use a workflow wherever the steps are known ahead of time. Reach for an agent when the steps depend on what earlier steps turn up, such as a research task whose next query depends on what the last one returned, or a debugging session whose next file to read depends on the last stack trace. If an ordinary function would do the job, write the function.

---

## The Agent Loop

Nearly every agent runs the same cycle. The model observes the current state, reasons about what to do, acts through a tool, and sees the result as part of its next observation.

```
  Goal
   │
   ▼
  Observe ───► Think ───► Act ───► done, or a limit hit?
    ▲         (choose    (call         │           │
    │          a step)    tool)     no │           │ yes
    │                                  │           ▼
    └──────────────────────────────────┘         Stop
```

The loop has no natural stopping point. A model that misreads its own progress will keep going, and the only things that end the run are the model declaring success or a limit tripping. Both matter, and only one of them is under your control.

### ReAct: Interleaving Reasoning and Action

[ReAct](https://arxiv.org/abs/2210.03629){:target="_blank" rel="noopener noreferrer"} (Yao et al., ICLR 2023) is the pattern most agent implementations follow, and it interleaves a reasoning trace with the actions rather than planning everything up front. Each turn produces a thought, an action, and an observation:

```
Goal: Find the latest sales figures and email them to the team

Thought: I need recent sales data before I can summarize anything
Action: query_database("SELECT * FROM sales WHERE date > '2026-01-01'")
Observation: [rows returned]

Thought: I have the data. It needs formatting before it goes out
Action: format_report(sales_data, format="summary")
Observation: [formatted report]

Thought: Report ready. Send it
Action: send_email(to="team@company.com", subject="Sales Update", body=report)
Observation: Email sent successfully

Thought: Task complete
```

Interleaving is what makes the pattern work. Because the model sees each observation before choosing the next action, external results correct its reasoning as it goes. The authors found this reduced the hallucination and error propagation that affect reasoning-only prompting on question answering, and it improved absolute success rates by 34% on ALFWorld and 10% on WebShop over imitation and reinforcement learning baselines.

The visible reasoning trace has a second benefit that matters more in production than in the paper. It is the only record of why the agent did what it did, and without it a failed run is a sequence of tool calls with no explanation attached.

---

## Agent Execution Architecture

The loop describes what happens. It says nothing about *where* each step runs, and in most agent systems the steps are split across a network boundary that shapes both cost and data exposure.

### The Local-Execution / Remote-Inference Split

Developer-facing agents run tools on the user's machine while inference runs on the provider's servers. The model never sees the machine. It receives an assembled context, returns either text or a request to call a tool, and the runtime executes that request locally before assembling the next context.

| Operation | Runs locally | Reaches the provider as context |
|---|---|---|
| **File reads** | Content read from disk | The full file content, in the next request |
| **Shell commands** | Executed in the local shell | Command output, in the next request |
| **Git operations** | Executed by the local git | Diffs, logs, and status output |
| **MCP server tools** | Tool runs as a local process | Tool results, in the next request |
| **Model reasoning** | Does not run locally | Happens entirely on provider servers |
| **Tool selection** | Does not run locally | The model decides remotely and sends back instructions |

### What Crosses the Boundary on Every Turn

Each iteration of the loop crosses the network.

{% include figure.html id="llm-agent-boundary" %}

Every red arrow is data leaving the machine, and each request carries the entire conversation so far rather than just the newest turn. A file read at step 5 is in the request at step 6, and in every request after it. By step 20 a single request may carry the contents of dozens of files, command outputs, and search results.

### What the Provider Receives

The split means source code, configuration, and command output reach the provider's infrastructure as a condition of getting help with them. An agent cannot reason about data it has not been sent, so there is no way to get model assistance on a file without that file crossing the network.

The exposure this creates is incidental rather than malicious. A developer asking an agent to fix an authentication bug may find it reading configuration files, environment dumps, and logs holding connection strings, API keys, or tokens. None of those reads are wrong. They are the agent doing the job it was given. But those values now sit in the inference context, governed by whatever retention and access terms apply to the account. Retention periods, training-data exclusions, and enterprise carve-outs vary by provider and by plan, and they change often enough that the terms page is the only reliable source.

Two controls limit the blast radius without giving up the tool. Keep secrets out of the paths the agent can read, using scoped credentials and secret scanning rather than trusting the model to avoid them. Then treat a long session as an accumulating liability and start a fresh one when the task changes, since context pruning and session limits cap how much is in flight at once.

---

## Planning

An agent that reacts one step at a time handles short tasks well and long ones badly, because nothing holds the overall shape of the work while the model is absorbed in a subtask. Planning gives it that shape.

How a model is prompted to produce a plan, whether with no examples or with a few worked ones, is ordinary prompting applied to a planning step. What is specific to agents is decomposition, which breaks a goal into subgoals that can each be pursued, checked, and recovered from independently:

```
Goal: Launch new feature

Subgoal 1: Implement backend
  - Create database schema
  - Build API endpoints
  - Write tests

Subgoal 2: Implement frontend
  - Design components
  - Integrate with API
  - Write tests

Subgoal 3: Deploy and monitor
  - Deploy to staging
  - Run integration tests
  - Deploy to production
```

Decomposition earns its cost in three ways. A written plan survives context compaction when the reasoning behind it does not, subgoals give the agent a place to record progress so a resumed run knows what is already done, and a failure is scoped to one subgoal instead of derailing the whole task.

The cost is that a plan made before any tool has run is a guess. Agents that hold their plan too rigidly keep executing steps that the first observation already invalidated, so the plan needs revisiting whenever an observation contradicts it.

### Self-Reflection

Reflection is the one reasoning technique that belongs to agents specifically, because it needs a loop to be useful. The agent evaluates its own output or a tool result, names what went wrong, and adjusts before the next attempt:

```
Action result: Query returned 0 results

Reflection: No results came back. Three explanations fit:
1. The search terms were too specific
2. The data doesn't exist
3. The query has a syntax error

Trying a broader search first distinguishes the first from the other two.
```

[Reflexion](https://arxiv.org/abs/2303.11366){:target="_blank" rel="noopener noreferrer"} (Shinn et al., NeurIPS 2023) formalized this as keeping the verbal self-critique in an episodic memory that later attempts read, so the agent carries the lesson forward instead of repeating the same failed approach.

Reflection is weakest exactly where it is most tempting to rely on it. An agent judging its own work with no external signal tends to agree with itself, so reflection is worth the tokens when it reacts to something outside the model, like a failing test, a non-zero exit code, or an empty result set, and much less so when it grades its own prose.

---

## Memory and Context

"Memory" gets used for three different things, and most confusion about agent memory comes from not saying which one is meant.

| Scope | Lives in | Survives | Typical content |
|---|---|---|---|
| **In-context** | The current context window | Nothing; gone when the window is rebuilt | The running transcript, recent tool results |
| **Session** | Storage outside the window, re-injected each turn | Trimming or compaction of the window | A rolling summary, the current plan, task state |
| **Cross-session** | A durable store, retrieved on demand | The session ending | User preferences, past decisions, project facts |

Only the first is automatic. The other two exist only if the application writes them somewhere and puts them back into the context deliberately, which is why an agent that "forgot" something usually never had it written down.

### Implementing Memory

Keeping the full conversation in context is the simplest approach and works until the window fills. Beyond that, the common techniques are compaction, retrieval, and structured state, and most production agents use all three.

**Compaction** replaces a long stretch of history with a summary of it. Fifty messages of debugging become three sentences naming what was tried, what worked, and what remains. This preserves the thread of the task while discarding the detail, and the risk is that the summary drops the one detail that mattered. Summarizing against a fixed template, so the plan and the open questions are always carried forward verbatim, loses less than free-form summarization.

**Retrieval** stores past interactions and pulls back the relevant ones on demand, matching on similarity rather than recency. It suits cross-session memory where the useful fact may be weeks old.

**Structured state** holds specific facts in a schema the application controls, rather than trusting the model to remember them:

```json
{
  "user_preferences": {
    "language": "TypeScript",
    "style": "functional",
    "testing_framework": "Jest"
  },
  "project_context": {
    "repo": "acme/widget-service",
    "branch": "feature/new-auth"
  }
}
```

Anything the application needs to be exactly right, like the target branch or the customer's account tier, belongs here rather than in prose the model might paraphrase.

---

## Multi-Agent Systems

Splitting work across several specialized agents is the standard answer to a task that overwhelms one agent. It is often the right answer, and it is reached for well before it pays.

### What Multiple Agents Buy

| Benefit | What it gives you |
|---|---|
| **Specialization** | Each agent gets a narrower tool set and a system prompt written for one job |
| **Parallelization** | Independent branches of work run at the same time |
| **Context isolation** | One agent's noisy exploration never enters another's window |
| **Cross-checking** | An agent reviewing another's output catches errors the author will not |

Context isolation is the benefit that survives scrutiny best. A subagent can read thirty files, discard twenty-nine, and return one paragraph, so the orchestrator pays for the paragraph rather than the thirty files.

### What Multiple Agents Cost

Anthropic's writeup of its own [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system){:target="_blank" rel="noopener noreferrer"} puts a number on it. Single agents use roughly 4 times the tokens of a chat interaction, and multi-agent systems roughly 15 times. That is the cost of the architecture before any task-specific work, so the task has to be valuable enough to carry it.

The same writeup is specific about shape. Multi-agent suits work with heavy parallelization, information exceeding a single context window, and many complex tools. It suits poorly any domain where every agent needs the same context, or where subtasks depend on each other, because models are not yet good at coordinating and delegating to each other mid-task. Coding is called out directly as having fewer genuinely parallelizable subtasks than research does.

The practical test is whether the subtasks can be described completely enough up front that a worker could finish one without talking to its siblings. Where they cannot, the coordination overhead exceeds whatever parallelism buys.

### Multi-Agent Patterns

Orchestrator-worker is the pattern most systems land on. A planning agent decomposes the goal, hands each piece to a worker with its own context and tools, and assembles the returned results.

```
        ┌────────────────┐
        │  Orchestrator  │
        │   (planning)   │
        └───────┬────────┘
                │ assigns scoped subtasks
      ┌─────────┼─────────┬──────────┐
      ▼         ▼         ▼          ▼
  ┌───────┐ ┌───────┐ ┌───────┐ ┌──────────┐
  │ Code  │ │ Test  │ │ Docs  │ │ Security │
  │ agent │ │ agent │ │ agent │ │  agent   │
  └───┬───┘ └───┬───┘ └───┬───┘ └────┬─────┘
      └─────────┴────┬────┴──────────┘
                     ▼
            results back to orchestrator
```

| Pattern | Work flows | Suits | Breaks down when |
|---|---|---|---|
| **Orchestrator-worker** | Out to workers in parallel, back to a planner | Independent subtasks under one goal | Subtasks need each other's intermediate results |
| **Pipeline** | Through fixed stages in sequence | A known series of transformations | The stages are known, in which case a workflow is cheaper |
| **Debate** | Between proposing and critiquing agents, then to an arbiter | Judgment calls where errors are costly | The agents share a blind spot and agree on a wrong answer |
| **Hierarchical** | Down through managers to workers | Deep decompositions too large for one planner | Each extra level multiplies tokens and dilutes the original goal |

Pipeline deserves suspicion. If the stages are fixed and known, the flexibility of an agent is being paid for and not used, and a workflow calling the model at each stage does the same job for a predictable cost.

### Passing Information Between Agents

Every agent has its own context window, so anything one agent learned has to be re-sent for another to know it. That transfer is where multi-agent systems leak both tokens and meaning.

| Method | How it works | Suits |
|---|---|---|
| **Shared context** | All agents read one common context | Small, tightly coupled sets of agents |
| **Message passing** | Explicit, scoped messages between agents | Loosely coupled or asynchronous work |
| **Blackboard** | A central store agents read from and write to | Collaboration where contributions arrive out of order |

The orchestrator's subtask description is the highest-leverage text in the whole system. A worker that receives "look into the auth thing" burns its context rediscovering what the orchestrator already knew, and it returns something the orchestrator cannot use.

---

## Building Reliable Agents

### How Agents Fail

| Failure | What it looks like | Mitigation |
|---|---|---|
| **Looping** | The same action repeated with the same result | Step limits, plus detection of repeated identical calls |
| **Tool errors** | An external tool fails or returns something unparseable | Return the error to the model as an observation, with retry limits |
| **Invented tools** | The model calls a tool that does not exist | Validate every call against the declared tool set and reject unknown names |
| **Goal drift** | The agent solves an interesting subproblem instead of the task | Restate the goal in context periodically; check output against the original goal |
| **Context overflow** | State outgrows the window mid-task | Compaction, structured state, subagents that return summaries |
| **Silent success** | The agent reports completion without having done the work | Verify with a tool, not by asking the model whether it succeeded |

Silent success is the one that survives testing. The others announce themselves, while a confident false completion looks identical to a real one until someone checks the result.

### Guardrails

An agent loop needs a limit it cannot reason its way past, enforced by the runtime rather than requested in the prompt. Three limits cover most of it: a maximum number of iterations, a maximum number of tool calls, and a spend ceiling for the run. Set them low enough that a runaway loop is caught in seconds, and treat hitting one as a signal to inspect the run rather than as a number to raise.

Two further controls belong to the application around the loop. State-changing, irreversible, and externally visible actions route through a human approval step before executing. Structured output is validated against a schema before anything acts on it.

### Observability

An agent run is a reasoning trace, not a stack trace, so the usual logs say little about why it went wrong. Capture the full sequence of thoughts, tool calls, and observations per run, and track these across runs:

| Metric | What it tells you |
|---|---|
| **Steps to completion** | Efficiency, and a rising trend that signals confusion |
| **Tool usage distribution** | Which tools earn their place in the context, and which are never chosen |
| **Tool error rate by tool** | Which tool descriptions or interfaces the model misunderstands |
| **Token usage per run** | Cost, and context pressure before it becomes overflow |
| **Limit-trip rate** | How often runs end by guardrail rather than by success |

---

## Agent Frameworks

Frameworks in this space consolidate and rename faster than most, so pick on the shape of what you need rather than on a name.

| Kind | What it gives you | Examples |
|---|---|---|
| **Provider SDK** | The loop, tool execution, guardrails, and tracing for one provider's models | Claude Agent SDK, OpenAI Agents SDK, Google Agent Development Kit |
| **Orchestration framework** | A provider-agnostic runtime, graph or middleware based, with durable execution and state | LangGraph, Microsoft Agent Framework |
| **Role-based multi-agent** | Agents declared by role and goal, composed into teams | CrewAI |

Two recent consolidations catch people out, because plenty of tutorials still teach the superseded names. Microsoft's [Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/){:target="_blank" rel="noopener noreferrer"} is the direct successor to both AutoGen and Semantic Kernel, built by the same teams, with published migration guides from each. New work targets Agent Framework rather than either predecessor. On the other side, [LangChain and LangGraph reached 1.0 together](https://www.langchain.com/blog/langchain-langgraph-1dot0){:target="_blank" rel="noopener noreferrer"} in October 2025, with LangChain's `create_agent` as the fast path and LangGraph as the runtime underneath it for agents needing explicit control.

### Whether You Need One

A framework pays off when you want multi-agent orchestration, durable execution across restarts, or tracing you would otherwise build, and when pre-built integrations cover the tools you need.

Building the loop directly pays off more often than framework documentation suggests. A single-agent loop over a handful of tools is a short piece of code, and writing it keeps the context assembly visible, which is where most agent bugs live. Framework abstractions hide exactly the thing you need to inspect when the agent starts behaving strangely.

---

## Quick Reference

### Agent Design Checklist

1. [ ] The goal is stated precisely enough that completion is checkable
2. [ ] The tool set is the smallest one that covers the task
3. [ ] Tool descriptions are written for a reader with no other context
4. [ ] Memory scopes are chosen deliberately, and the durable ones are written down
5. [ ] Iteration, tool-call, and cost limits are enforced by the runtime
6. [ ] Tool failures return to the model as observations, with retry limits
7. [ ] Irreversible and externally visible actions require human approval
8. [ ] Full reasoning traces are captured per run
9. [ ] Completion is verified by a tool, not by asking the model

### When an Agent Is the Right Shape

| Scenario | Agent? |
|---|---|
| A single question with a single answer | No. Call the model directly |
| Steps known in advance | No. A workflow is cheaper and easier to debug |
| Next step depends on what the last step found | Yes |
| A task spanning more information than one context window | Yes, with subagents returning summaries |
| Batch processing over many similar items | Yes, with limits per item and sampling for review |
| High-stakes or irreversible decisions | Only with approval gates on the consequential actions |
