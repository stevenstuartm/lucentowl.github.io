---
title: "AI Batch Generation Pipeline Template"
layout: resource
type: code
category: "AI & Machine Learning"
description: "A copy-paste plan file and orchestrator prompt for running parallel AI agents through a batch content-generation pipeline, with model tiering and validation built in."
last_updated: 2026-07-02
tags: [ai, generative-ai, llm, agents, automation, workflow]
related_guides:
  - /study-guides/ai/scaling-ai-workflows.html
---

Three artifacts, used together: a format reference (one hand-written output every agent copies the shape of), a plan file (tracks tasks, models, and status), and an orchestrator prompt (hands each task to its own agent, then validates what comes back). Write the format reference first; the plan file's Format Reference field and Validation Checklist both point back to it.

The example below batches nine entries for a distributed systems glossary: six single-term definitions and three comparisons that require reasoning across multiple terms. Swap in your own domain, section names, and fields; the mechanics don't change.

### Format Reference

`output/idempotency.md` is a real, finished output written by hand. Every write agent reads this file for structure, style, and front matter instead of receiving formatting instructions directly.

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

### Plan File

`<plan-file-path>` is the file the orchestrator reads and updates for the life of the batch. Every task already has a model assigned, so the orchestrator never classifies a task at launch time. Task 1 is `complete` because it's the format reference above, not something the pipeline produced.

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

### Orchestrator Prompt

Paste this into your session to run a phase, swapping in the real paths and phase number.

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

> **Note:** The agent never opens the plan file. DISPATCH resolves the title, filename, and content rules into the prompt text itself, so the only file the agent reads is the format reference.

Resolved against Task 2, the DISPATCH prompt the orchestrator actually sends looks like this:

```
Read output/idempotency.md for structure, style, and front matter format.
Produce output covering Quorum. Follow these content rules: front matter
needs term, category (one of Consistency, Concurrency, Scalability,
Reliability), and tags; include Definition, Details, and Related Terms
sections in that order; leave a blank line before markdown tables. Write
the output to output/quorum.md.
```

### Resulting Output

`output/quorum.md`, once the agent above finishes:

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

> **Note:** Validation here catches a real category of mistake, not just formatting. If the agent had written `category: "Consistent"` instead of the exact value `Consistency`, the front matter spot-check would fail immediately, since that string isn't one of the four values Content Rules allows, and the row would stay `pending` for a retry instead of getting marked complete.

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
