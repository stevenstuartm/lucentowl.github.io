---
title: "Scaling Generative AI Workflows"
layout: guide
category: AI & Machine Learning
subcategory: AI in Engineering Practice
description: "Patterns for running many similar AI tasks without cost and quality collapsing, covering why one long session fails at volume, isolating work in parallel agents, model tiering, format references, layered validation, and keeping the orchestrator lean."
tags: [orchestration, batch-processing, agents, automation, cost-analysis, practical]
---

Producing one good output with a model and producing fifty consistent ones are different problems. Batches of reports, documentation pages, data transformations, or test fixtures expose cost and quality problems that never appear when working on one or two items at a time, and the patterns here close the gap between "the model can write one of these well" and "the model can write fifty of these efficiently."

## Why One Long Session Fails at Volume

The obvious approach is to work through the batch in a single session, one item after another. It degrades in three ways at once.

**Cost grows quadratically.** Each request carries everything produced earlier in the session, so item ten pays to reprocess items one through nine. Per-request cost rises linearly with position, and total cost across the batch rises with the square of its length. Thirty outputs of 600 lines each leave 18,000 lines of finished work inflating every later request.

**Prompt caching softens this but does not remove it.** In a sequential session the accumulated history is a stable prefix, so a provider's prefix cache can serve most of it at around a tenth of the normal input rate. That turns a punishing quadratic term into a smaller one. It is still quadratic, it depends on each request landing within the cache's lifetime, and it does nothing for the other two problems.

{% include figure.html id="llm-batch-cost" %}

**Quality degrades and the window fills.** Nine completed outputs the model will never reference again compete for its attention with the task in front of it, and long batches exhaust the context window before they finish. Neither is a pricing problem, so no pricing mechanism fixes them.

---

## Isolating Each Task

The alternatives all give each task a context containing only its own work. They differ in who launches the task and how many run at once.

### Fresh Session Per Task

Start a clean session for every item, pointed at a plan file and a format reference. It produces one output, gets validated, and ends. No task ever carries another's baggage.

This is the simplest option and usually the highest quality, because each task gets the model's full attention with nothing else in the window. The costs are manual effort and speed, since someone has to start each session and they run one at a time unless several are opened by hand.

### Parallel Agents with Isolated Contexts

An orchestrating session hands each task to its own agent. Each agent runs in a clean context, produces its output, and returns a short result. The orchestrator never holds the body of any output, only small signals like validation results and metadata checks.

Launched together, agents run concurrently, so a batch of five finishes in something close to the time of one. Per-task cost stays roughly flat regardless of batch size, because each agent's context holds only its own work.

Isolation is not free, and the economics depend on what each agent has to relearn. Every agent re-pays for the shared setup: instructions, the format reference, and any background material. Isolation trades that repeated fixed cost for the accumulating one it avoids. For a long batch of substantial outputs the trade wins decisively, while for a short batch of small outputs with heavy shared setup it can lose. Concurrency is also bounded by rate limits, and token-per-minute limits usually bind before request limits do, so ten simultaneous agents may effectively run as four.

### Sequential, When Tasks Depend on Each Other

Isolation assumes tasks are independent. Where a later item has to reference or stay consistent with an earlier one, such as a glossary where definitions cross-reference, or a series where each part builds on the last, shared context is doing necessary work and cannot simply be removed.

The middle path is to isolate what can be isolated and pass forward only what later tasks need. A compact summary of decisions made, or the list of terms already defined, carries the dependency without carrying every finished output.

### Choosing an Approach

| Approach | Cost | Speed | Quality | Effort to run |
|---|---|---|---|---|
| **One long session** | Highest at volume; quadratic even with caching | Sequential | Degrades as the batch grows | Lowest |
| **Fresh session per task** | High, with no reuse | Sequential unless parallelized by hand | Highest | Manual per task |
| **Parallel agents, one model** | Moderate; fixed setup cost repeats per agent | Parallel, up to rate limits | Consistent | Moderate |
| **Parallel agents, model tiering** | Lowest for large batches | Parallel, up to rate limits | High, slightly generic on synthesis tasks | Highest |
| **Provider batch API** | Roughly half standard rates | Hours, asynchronous | Same as the model used | Moderate; no interactive validation loop |

Small batches where quality matters most suit fresh sessions. Large batches where cost matters suit parallel agents with tiering and a validation pipeline. Anything with no one waiting on the result is a candidate for a provider's batch API, where the discount often outweighs everything else here, provided the validation can run after the fact rather than inside the loop.

---

## Model Tiering

Tasks in a batch are rarely uniform in difficulty, and matching the model to each task is usually the largest cost lever available at volume.

**Descriptive tasks** have a well-defined structure and draw on widely available information. They compare along known axes, like "compare these pricing tiers" or "describe how this service works." A smaller, faster model handles them well because the reasoning is straightforward.

**Synthesis tasks** require analysis where several factors interact. A smaller model tends to flatten these into generic heuristics, while a more capable one finds the non-obvious tensions and edge cases that make the output useful.

Classification can usually be automated from metadata the plan already holds. Title keywords like "selection" or "comparison," placement in an advanced section, and notes mentioning cross-cutting concerns are all usable signals. The heuristic does not need to be precise, because its errors are asymmetric. A descriptive task sent to the capable model costs a little more with no quality loss. A synthesis task sent to the smaller model produces generic output that validation should catch and route back.

Measure the misroute rate. If a meaningful share of tasks sent to the smaller model come back for rework, the combined cost of both attempts can exceed sending them to the capable model in the first place.

---

## Format References Over Embedded Instructions

When every output shares a structure, repeating the formatting rules in every agent's prompt wastes tokens and still drifts. Point each agent at one finished output that demonstrates the target format instead.

A short prompt saying "read this reference file and follow its structure" replaces a long block of formatting rules. The agent reads the reference in its own context, and the orchestrator's launch prompt stays small.

This also improves consistency, which matters more than the savings. Models match a concrete example more reliably than they interpret abstract rules, so outputs converge on the reference instead of on each agent's reading of the instructions. The hand-written reference becomes the single definition of "correct," and changing the format means changing one file.

---

## Layered Validation

Validation at volume has to be cheap per item, or it quietly stops happening. Three layers, ordered by where they run, catch different classes of problem.

### Structural Review Inside the Worker

Have the agent that produced an output check it against a content checklist before returning. Its context already holds the output, so the review costs only the checklist prompt and any corrections. This catches missing sections, wrong ordering, and format violations without any of it reaching the orchestrator.

Whether this works as a continuation of the same agent or as a second step within its task depends on the tooling, but the principle does not. Keep the full output inside the context that produced it, and send only a verdict outward. The expensive alternative is reading each full output in the orchestrator to validate it, which undoes the isolation that made the pipeline affordable.

Self-review has a known limit. An agent checking its own work tends to agree with itself, so this layer is good for mechanical and structural completeness and weak for judging whether the content is correct.

### Automated Checks in the Orchestrator

Run a linter, formatter, or schema validator against each output file. The orchestrator sees only the violation output, typically a few lines, and never the file. Tooling catches the mechanical problems that agents reliably miss, like style violations and malformed structure, and it catches them identically every time.

### Targeted Spot-Checks

Read only the metadata that determines whether an output works at all, meaning front matter, configuration entries, and file headers. These are the highest-impact checks per token, because wrong metadata means an output that will not render, integrate, or be discoverable, however good its body is.

---

## Running the Pipeline

### Phase the Work

Rather than taking each item through every step before starting the next, batch the work by phase:

1. Launch every write task together
2. When all have returned, run structural review for each
3. Run the automated checks across every output
4. Run the metadata spot-checks
5. Update configuration and tracking files once, at the end

Phasing keeps the orchestrator processing one kind of result at a time, which keeps its context predictable. It also surfaces systemic problems early. If every agent makes the same formatting mistake, you find out after one phase and fix the reference or the instructions once, instead of discovering it item by item.

### Know How Completion Is Signaled

A pipeline with dependent phases needs to know when a phase is done, and agent tooling differs in how it reports that. Some launch modes block until every agent in a group returns, which makes chaining phases trivial. Others return immediately and report completion later, either by notifying the orchestrator or by requiring it to check.

The distinction that matters is whether completion arrives as an event the orchestrator can act on, or whether someone has to prompt it to look. Event-driven completion supports a hands-free pipeline with either mode. Completion that has to be polled or prompted for turns every phase boundary into a manual step. Check which behavior your tooling has before designing a multi-phase pipeline around it, because it changes between tools and between versions of the same tool.

### Keep the Orchestrator Lean

The orchestrator's context is the most expensive one in the system, since everything that enters it is paid for on every later turn and it lives for the whole batch. Admit only small signals:

| Enters the orchestrator | Typical size |
|---|---|
| **Automated check output** | A few lines of violations, not a full report |
| **Metadata spot-checks** | The handful of fields that affect rendering or discovery |
| **Worker verdicts** | Pass, fail, or a short list of issues, not the review transcript |

The body of an output should never enter the orchestrator's context. When something specific needs a closer look, read the relevant lines rather than the whole file.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **One long session for a large batch** | Cost climbs quadratically, quality drops, the window fills | Isolate each task's context |
| **Assuming caching makes accumulation free** | Still quadratic, still dilutes attention, still fills the window | Treat caching as a discount, not a fix |
| **Isolating tasks that depend on each other** | Inconsistent outputs that contradict one another | Pass forward a compact summary of shared decisions |
| **Launching more agents than rate limits allow** | Throttling erases the concurrency and adds retries | Size concurrency to token-per-minute limits |
| **The largest model for every task** | Paying synthesis prices for descriptive work | Tier by task type, and measure the misroute rate |
| **Formatting rules repeated in every prompt** | Wasted tokens and drift across outputs | One hand-written reference every agent reads |
| **Reading full outputs in the orchestrator** | The orchestrator re-accumulates the context isolation removed | Surface verdicts and violations only |
| **Trusting self-review for correctness** | Agents approve their own errors | Use it for structure; use tooling and spot-checks for the rest |
| **A pipeline built on unverified completion signaling** | Every phase boundary silently needs a manual nudge | Confirm how your tooling reports completion first |
| **Interactive rates for work nobody is waiting on** | Roughly double the necessary spend | Use a provider batch API where validation can run afterward |
