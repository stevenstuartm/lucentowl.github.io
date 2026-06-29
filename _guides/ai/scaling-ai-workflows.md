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

These two files and one prompt are enough to run the full workflow. Copy them, fill in your own tasks and paths, and go.

### The Plan File

Save this as a markdown file in your project. The orchestrator reads it to know what to do and updates it as tasks complete.

```markdown
# Batch Creation Plan

## Format Reference
docs/completed/authentication-overview.md

## Output Directory
docs/guides/

## Content Rules
- No CLI commands or code snippets (concepts only, link to official docs for syntax)
- No specific dollar amounts (use relative comparisons)
- Every guide needs front matter: title, description, category, tags
- Blank line before every markdown table

## Validation Checklist
1. Front matter fields present and correct
2. All required sections in correct order
3. Linter passes: python lint_content.py <filepath>
4. File registered in docs/config.json

## Phase 1: Fundamentals
| # | Title | Filename | Model | Status |
|---|-------|----------|-------|--------|
| 1 | User Authentication Overview | authentication-overview.md | haiku | complete |
| 2 | Role-Based Access Control | rbac.md | haiku | pending |
| 3 | OAuth and OIDC Patterns | oauth-oidc.md | haiku | pending |
| 4 | Session Management | session-management.md | haiku | pending |

## Phase 2: Advanced
| # | Title | Filename | Model | Status |
|---|-------|----------|-------|--------|
| 5 | Identity Provider Selection | identity-provider-selection.md | sonnet | pending |
| 6 | Zero-Trust Architecture Patterns | zero-trust-patterns.md | sonnet | pending |
| 7 | Token Lifecycle Management | token-lifecycle.md | haiku | pending |

## Model Selection Rules
- Default: haiku (single-service, descriptive guides)
- Use sonnet when: title contains "selection" or "patterns" in an advanced
  phase, or the guide compares 3+ options across multiple dimensions
```

Guide #1 is already complete and serves as the format reference. Phases are 4-6 tasks so they fit in one sitting. The model column means the orchestrator doesn't need to re-analyze each task.

### The Orchestrator Prompt

Paste this into your session to kick off a phase. Swap the paths and phase number.

```
Read the plan at docs/PLAN.md. Execute Phase 2.

For each pending task in the phase, launch a synchronous agent at the
model specified in the plan with this prompt:

  "Read docs/completed/authentication-overview.md for structure, style,
   and front matter format. Create a guide covering [title from plan].
   Follow the content rules in docs/PLAN.md. Write the output to
   docs/guides/[filename from plan]."

Launch all agents for the phase in a single message so they run in parallel.

After all agents complete:
1. Resume each agent and ask it to validate its output against the
   checklist in the plan. Have it fix any issues.
2. Run `python lint_content.py` on each output file. Fix violations.
3. Read the first 10 lines of each output to verify front matter.
4. Add each new file to docs/config.json.
5. Update the plan: mark tasks complete, note any issues found.
```

Everything the agents need is in the plan file and the format reference. The prompt itself stays short because it points to those files rather than repeating their content.

---

## Key Takeaways

- Context accumulation makes sequential generation prohibitively expensive at scale. Agent isolation eliminates it by giving each task a clean context.
- Model tiering based on task complexity is the single largest cost lever. Most tasks in a batch are descriptive and don't need the most capable model.
- Short prompts with format references are cheaper and more consistent than embedding full formatting rules in every agent prompt.
- Validation should happen in the agent's context via resume, not the orchestrator's. Surface only small signals to the main context.
- Synchronous agents enable automated pipelines. Background agents break pipeline automation by requiring manual intervention between steps.
- Phased execution keeps the orchestrator lean and catches systemic issues early.
