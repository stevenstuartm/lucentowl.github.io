---
title: "Scaling Generative AI Workflows"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "Practical patterns for scaling repetitive AI work: agent orchestration, model tiering, context management, and validation pipelines."
tags: [ai, generative-ai, llm, agents, automation, practical, cost-analysis]
---

## When This Matters

Generating many similar outputs at scale, like batches of reports, guides, or data transformations, exposes cost and quality problems that don't surface when working with one or two items. These patterns address the gap between "AI can write one thing well" and "AI can write fifty things efficiently."

### The Context Accumulation Problem

LLMs process the entire conversation history on every message. Writing items sequentially in one session means each new item pays for every previous item sitting in memory. Item one costs X tokens, item two costs 2X, item ten costs 10X. Cost grows linearly per message and the total cost across all items grows quadratically.

For a handful of items this overhead is negligible. For dozens, it dominates. A 600-line output repeated thirty times accumulates 18,000 lines of dead context inflating every subsequent API call. The quality also degrades as the model's attention dilutes across irrelevant prior outputs.

---

## Approaches to Scaling

There are several ways to handle volume, each with different tradeoffs.

### Fresh Session Per Task

Start a clean session for each task. Point it at a plan file and a format reference, let it produce one output, validate, and end. No session ever carries baggage from another task.

This is the simplest approach and produces the highest quality because each task gets the best model's full attention with zero context noise. The downsides are cost (full model rate for every task with no reuse) and speed (sequential unless you manually run multiple sessions).

### Sequential in One Session

Write everything in one long session. This avoids session management overhead but context accumulation makes it progressively more expensive and slower. By task ten, the model is processing nine completed outputs it will never reference again. Context windows may fill before the batch is complete.

### Parallel Agents with Isolated Contexts

Each task gets its own agent launched from an orchestrating session. Agents run in clean context windows, produce their output, and return. The orchestrator never holds the full body of every output; it only sees small signals like validation results and metadata checks.

Multiple agents launched in a single message run concurrently, so five tasks complete in roughly the time of one. Per-task cost stays constant regardless of total volume because each agent's context contains only its own work.

### Which Approach Fits

| Scenario | Best approach |
|----------|--------------|
| 1-3 tasks, quality paramount | Fresh session per task |
| 5-10 tasks, stepping away to let it run | Fresh session per phase (accept some accumulation) |
| Full batch of a phase, cost-conscious | Parallel agents with model tiering |
| Need simplicity over optimization | Fresh session per task |
| Tasks require cross-referencing each other | Sequential (shared context needed) |

---

## Core Orchestration Patterns

### Model Tiering

Not every task requires the same reasoning capability. Matching model to task complexity is one of the highest-leverage cost optimizations available.

**Single-dimension tasks** have well-defined structure and widely available information. Comparisons happen along known axes like "compare pricing tiers" or "describe how service X works." A cheaper, faster model handles these because the reasoning is straightforward.

**Multi-dimension synthesis tasks** require cross-cutting analysis where multiple factors interact. A cheaper model tends to flatten these into simple heuristics while a more capable model identifies non-obvious tensions and edge cases.

**How to classify automatically**: Use metadata already present in your task plan. Title keywords like "selection" or "comparison," placement in advanced categories, and notes that mention cross-cutting concerns all serve as signals. The heuristic doesn't need to be perfect. A descriptive task sent to the capable model just costs slightly more with no quality downside, while a synthesis task sent to the cheaper model produces slightly generic output that review catches.

### Format References Over Embedded Instructions

When all outputs follow the same structure, embedding formatting rules in every agent prompt wastes tokens. Instead, point each agent to an existing output that demonstrates the target format.

A 30-line prompt that says "read this reference file and follow its structure" replaces 150 lines of formatting instructions. The agent reads the reference once in its own context, and the prompt stays short for the orchestrator that launches it.

This also improves consistency. Agents pattern-match against a concrete example rather than interpreting abstract rules, which reduces formatting drift across outputs.

### Self-Validation via Resume

After an agent produces its output, the same agent can be resumed for validation. The agent retains its full context from the writing phase, so the output is already in memory. Validation costs only the incremental tokens for the review prompt and any corrections.

The alternative is reading the full output in the orchestrator's context to validate, which negates the savings from agent isolation. Keep validation in the agent's context and surface only small signals (pass/fail, specific issues) to the orchestrator.

### Layered Validation

A practical validation pipeline has three layers.

**Structural review in the agent context**: The resumed agent checks its own output against a content checklist. This catches section ordering, missing components, and format violations without any cost to the orchestrator.

**Automated linting in the orchestrator**: A shell command (linter, formatter, schema validator) runs against the output file. The orchestrator sees only the violation output, typically 5-10 lines. This catches mechanical issues like style violations or formatting errors that agents tend to miss.

**Targeted spot-checks in the orchestrator**: Read only the critical metadata (front matter, config entries, file headers) in the orchestrator's context. These are the highest-impact checks because wrong metadata means the output won't render, integrate, or be discoverable.

---

## Pipeline Execution

### Synchronous vs Background Agents

Agent execution mode determines whether pipelines can run hands-free.

**Synchronous agents** launched in a single message run in parallel and block until all complete. The orchestrator receives all results at once and immediately launches the next phase. This enables fully automated pipelines where write, validate, lint, and publish steps chain without user intervention.

**Background agents** return immediately with a task ID. The orchestrator can do other work while they run, but it has no event-driven way to detect completion. Every step transition requires the user to send a "continue" message. This makes background agents suitable for long-running independent work but not for multi-step pipelines.

For pipelines with dependent steps, synchronous agents are the correct choice.

### Phased Execution

Rather than processing each item through the full pipeline individually, batch items by phase:

1. Launch all write agents simultaneously (synchronous, in one message)
2. When all complete, launch all validation agents (resume the writers)
3. Run all automated checks
4. Run all spot-checks
5. Update any configuration or tracking files

This phased approach keeps the orchestrator's context clean by processing one type of result at a time. It also catches systemic issues early. If all agents make the same formatting mistake, you discover it after one phase rather than after processing every item individually.

### Keeping the Orchestrator Lean

The orchestrator's context is the most expensive in the system because every message pays for everything already in it. Minimize what enters it:

- **Automated check output** (~5-10 lines): Surface only violations, not full reports
- **Metadata spot-checks** (~10 lines): Verify critical fields that affect rendering or discoverability
- **Status signals**: Pass/fail from agent validation, not the full validation transcript

The full output body should never enter the orchestrator's context. If something specific needs verification, read only the relevant lines, not the entire file.

---

## Approaches Compared

| Approach | Cost | Speed | Quality | Process Complexity |
|----------|------|-------|---------|-------------------|
| Fresh session per task | Highest | Sequential | Highest | Lowest |
| Sequential in one session | High (accumulates) | Sequential | Degrades over time | Low |
| Parallel agents, single model | Moderate | Parallel | Consistent | Moderate |
| Parallel agents, model tiering | Lowest | Parallel | High for most, slightly generic for synthesis tasks | Highest |

For small batches where quality is paramount, fresh sessions are simplest. For large batches where cost matters, parallel agents with model tiering and validation pipelines provide the best tradeoff. For moderate batches, parallel agents with a single model balances savings against process complexity.

---

## Minimal Working Example

This workflow produces three artifacts. The plan file is a single tracking document the orchestrator reads and updates for the life of the batch. The format reference is one hand-written output that every generated task pattern-matches against. The task outputs are the files agents produce during dispatch. The plan file itself is written in two passes, since the format reference has to exist before the plan can assign models or define a checklist against it.

The batch below writes nine entries for a distributed systems glossary: six single-term definitions and three comparisons that require reasoning across multiple terms. Nine is already past the point where writing them one by one in a single session would start accumulating dead context; a real glossary might run 30 or more.

### Step 1: Draft the Plan File

The first pass only enumerates the work. There's no format reference yet and no model assignments, since both depend on having an example already written.

```markdown
# Batch Creation Plan

## Output Directory
output/

## Content Rules
- Every output needs front matter: term, category, tags
- Blank line before every markdown table

## Phase 1
- Idempotency
- Quorum
- Backpressure
- Fencing Token
- Vector Clock
- Circuit Breaker

## Phase 2
- CAP Theorem: What Consistency and Availability Each Cost (synthesis)
- Optimistic vs Pessimistic Concurrency Control (synthesis)
- Vector Clocks vs Lamport Timestamps: Ordering Events Without a Shared Clock (synthesis)
```

### Step 2: Hand-Write the Format Reference

Write the first task yourself, by hand or in one plain session with no plan or orchestrator involved, covering every structural element every later output must contain, like front matter, section order, and at least one table. Here's `output/idempotency.md`:

```markdown
---
term: Idempotency
category: Reliability
tags: [distributed-systems, reliability, api-design]
---

## Definition

An operation is idempotent if performing it more than once produces the same effect as performing it exactly once. A client can safely retry an idempotent request after a timeout without worrying about duplicating the underlying effect.

## Details

| Aspect | Value |
|--------|-------|
| Typical mechanism | A client-supplied idempotency key the server deduplicates against |
| Common home | Payment APIs, where a retried charge must not bill twice |
| What it doesn't guarantee | That the response is identical on retry, only that the effect is |

## Related Terms

Exactly-once delivery tries to guarantee an operation happens once at the transport level; idempotency reaches the same practical outcome by making repeats harmless instead of preventing them.
```

This file is now the Format Reference. Every write agent in the batch will be pointed at it instead of receiving formatting instructions directly.

### Step 3: Finalize the Plan File

With the format reference in hand, add the fields that depend on it: the Format Reference path, a Validation Checklist that mirrors the reference's structure, and Model Selection Rules. Then classify every remaining task against those rules and record the result in the task table, so the orchestrator never has to classify a task at launch time.

```markdown
# Batch Creation Plan

## Format Reference
output/idempotency.md

## Output Directory
output/

## Content Rules
- Every output needs front matter: term, category, tags
- category must be one of: Consistency, Concurrency, Scalability, Reliability
- Include Definition, Details, and Related Terms sections, in that order
- Blank line before every markdown table

## Validation Checklist
1. Front matter includes term, category, and at least 2 tags
2. category is one of the four values listed in Content Rules
3. Definition, Details, and Related Terms sections present, in that order
4. Linter passes: <lint-command> <filepath>
5. Output registered in <tracking-file>

## Phase 1
| # | Title | Filename | Model | Status |
|---|-------|----------|-------|--------|
| 1 | Idempotency | idempotency.md | haiku | complete |
| 2 | Quorum | quorum.md | haiku | pending |
| 3 | Backpressure | backpressure.md | haiku | pending |
| 4 | Fencing Token | fencing-token.md | haiku | pending |
| 5 | Vector Clock | vector-clock.md | haiku | pending |
| 6 | Circuit Breaker | circuit-breaker.md | haiku | pending |

## Phase 2
| # | Title | Filename | Model | Status |
|---|-------|----------|-------|--------|
| 7 | CAP Theorem: What Consistency and Availability Each Cost (synthesis) | cap-theorem.md | sonnet | pending |
| 8 | Optimistic vs Pessimistic Concurrency Control (synthesis) | optimistic-vs-pessimistic-locking.md | sonnet | pending |
| 9 | Vector Clocks vs Lamport Timestamps: Ordering Events Without a Shared Clock (synthesis) | vector-clocks-vs-lamport-timestamps.md | sonnet | pending |

## Model Selection Rules
- Default: haiku for a single glossary term
- Use sonnet for any task that compares or synthesizes across multiple terms
```

Task 1 is marked `complete` because it's the output you already wrote by hand, not something the pipeline produced; that's also why it doubles as the Format Reference. Every other row starts `pending` with its model already assigned. From this point forward, this is the only file the orchestrator reads and updates.

### Step 4: The Orchestrator Prompt

Paste this into your session to run a phase, swapping in the real paths and phase number. It works through four jobs in order: find the pending work, hand it off to agents, validate what comes back, and record the result.

```
Read the plan at <plan-file-path>.

ENUMERATE: Find every row in Phase 1 with Status = pending.

DISPATCH: Hand off each pending task to its own synchronous agent, at the
model specified in its row, with this prompt:

  "Read <format-reference-path> for structure, style, and front matter
   format. Produce output covering [title from plan]. Follow these content
   rules: [content rules copied from the plan]. Write the output to
   <output-directory>/[filename from plan]."

Launch all agents for the phase in a single message so they run in parallel.

VALIDATE: Once every agent has returned, check their work yourself. Don't
read the full output files; check only what the Validation Checklist in
the plan asks for.
1. Run the project's linter on each output file and fix violations.
2. Read the front matter and section headers of each output file to
   confirm the fields, the category value, and the section order the
   checklist requires.

RECORD: Update the plan so each finished task's Status reads complete,
register each output in <tracking-file>, and note any issues found.
```

> **Note:** On a phase's first run, every row is already pending, so ENUMERATE has nothing to filter out yet. Its value shows up on a rerun, when some rows already carry Status = complete and only the leftovers should be dispatched again.

> **Note:** The agent never opens the plan file. DISPATCH resolves the title, filename, and content rules into the prompt text itself, so the only file the agent reads is the format reference. A batch of fifty tasks costs each agent nothing extra over a batch of five, because none of them ever see the other forty-nine rows.

Resolved against Task 2, the DISPATCH prompt the orchestrator actually sends looks like this:

```
Read output/idempotency.md for structure, style, and front matter format.
Produce output covering Quorum. Follow these content rules: front matter
needs term, category (one of Consistency, Concurrency, Scalability,
Reliability), and tags; include Definition, Details, and Related Terms
sections in that order; leave a blank line before markdown tables. Write
the output to output/quorum.md.
```

> **Note:** This version has the orchestrator validate every output itself. The Self-Validation via Resume pattern described earlier trades that clarity for lower cost by having each agent check its own output first, which cuts what the orchestrator needs to verify down to the mechanical checks above.

### The Resulting Output

Once the agent above finishes, `output/quorum.md` exists on disk:

```markdown
---
term: Quorum
category: Consistency
tags: [distributed-systems, consistency, replication]
---

## Definition

A quorum is the minimum number of nodes in a distributed system that must agree before a read or write counts as successful. Systems tune read and write quorum sizes against the total replica count to trade consistency, availability, and latency against each other.

## Details

| Aspect | Value |
|--------|-------|
| Common formula | Strong consistency requires read quorum + write quorum > total replicas |
| Typical home | Dynamo-style stores like Cassandra and Riak |
| Failure mode when misconfigured | Two writes can both succeed against disjoint node sets, producing a split-brain |

## Related Terms

Vector clocks and last-write-wins are two ways to resolve the conflicting versions a poorly tuned quorum can produce.
```

Validation here catches a real category of mistake, not just formatting. If the agent had written `category: "Consistent"` instead of the exact value `Consistency`, the front matter spot-check would fail immediately, since that string isn't one of the four values Content Rules allows, and the row would stay `pending` for a retry instead of getting marked complete.

The plan file's Phase 1 table now reads:

```markdown
| # | Title | Filename | Model | Status |
|---|-------|----------|-------|--------|
| 1 | Idempotency | idempotency.md | haiku | complete |
| 2 | Quorum | quorum.md | haiku | complete |
| 3 | Backpressure | backpressure.md | haiku | pending |
| 4 | Fencing Token | fencing-token.md | haiku | pending |
| 5 | Vector Clock | vector-clock.md | haiku | pending |
| 6 | Circuit Breaker | circuit-breaker.md | haiku | pending |
```

The plan file tracks what's left and which model to use for it, the format reference defines what a finished output looks like, and the validation layer keeps the orchestrator's context down to pass/fail signals instead of the output bodies themselves.

---

## Key Takeaways

- Context accumulation makes sequential generation prohibitively expensive at scale. Agent isolation eliminates it by giving each task a clean context.
- Model tiering based on task complexity is the single largest cost lever. Most tasks in a batch are descriptive and don't need the most capable model.
- Short prompts with format references are cheaper and more consistent than embedding full formatting rules in every agent prompt.
- The orchestrator can validate output itself as long as it checks mechanical signals (lint output, front matter, section headers) instead of reading the full body. Resuming the agent to self-check first cuts cost further, at the expense of the orchestrator no longer being the one that catches problems.
- Synchronous agents enable automated pipelines. Background agents break pipeline automation by requiring manual intervention between steps.
- Phased execution keeps the orchestrator lean and catches systemic issues early.
