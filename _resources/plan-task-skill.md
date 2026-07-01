---
title: "Assumptions-First Task Planning Skill"
layout: resource
type: code
last_updated: 2026-07-01
description: "A Claude Code skill that structures ticket intake around assumption clarity. Writes a self-contained ticket MD file, proves assumptions before writing implementation code, and gates on human review."
tags: [workflow, planning, ai-agents, assumptions, sdlc, productivity]
related_posts:
  - /blog/2025/11/17/shaped-kanban.html
  - /blog/2026/02/07/you-cant-realign-if-you-cant-stop.html
---

A Claude Code skill for structured ticket intake. The problem it solves: AI agents fail not because they can't code, but because they code against unvalidated assumptions. Once momentum builds, plan-continuation bias makes those assumptions invisible until they've already caused damage and wasted time.

This skill forces assumption clarity before a single line of implementation is written. It writes a self-contained ticket MD file, runs a proof plan (tests, code research, spikes, user confirmation), and gates on your explicit sign-off before proceeding.

Install it by saving the file below to `.claude/commands/plan-task.md` in any project, or `~/.claude/commands/plan-task.md` for global availability.

---

```markdown
---
name: plan-task
version: 1.3.0
description: >
  Structured intake ritual for a new bug or feature ticket inside Claude Code.
  Triggers on: "plan task", "new ticket", "scs-plan-task", describing a new
  feature or bug. Reads CLAUDE.md and linked resources silently, explores
  relevant code, writes a self-contained ticket MD file with full agent
  instructions, assumption proof strategies, and progress tracking. Asks
  minimum clarifying questions driven by assumption gaps, proves each assumption
  via the best available method: unit tests, integration tests, code research,
  doc review, spikes, or user confirmation. Not all proofs are tests. Tests
  scoped to unit and integration only — no UI automation or E2E. Gates on
  human review of the full assumption proof plan before any implementation.
  The generated MD is fully self-contained — all behavioral rules are stamped
  into it so any future session can resume without re-running this skill.
  Combats plan-continuation bias. Use for any ticket, bug, or feature.
---

# scs-plan-task

A lightweight intake ritual for a single bug or feature ticket.

One ticket. One MD file. Assumptions first. Prove them. Then build.

The skill runs once. The MD it generates drives everything after that.

---

## Philosophy

The goal is **assumption clarity** — not test coverage.

AI agents fail not because they can't code, but because they code against
unvalidated assumptions. Once momentum builds, plan-continuation bias takes
over and wrong assumptions get baked into implementation before they surface.

The discipline:

> Every assumption needs a proof strategy before implementation begins.

A proof strategy can be:
- A unit or integration test
- Reading the code and confirming a behavior
- Reviewing a dependency's docs or source
- A quick spike or console experiment
- Reasoning from established patterns in the codebase
- User confirmation ("is this how you expect it to work?")

Not all proofs are tests. Tests are the preferred proof method when feasible.
If a test cannot be written, that is not an excuse — pick another strategy.

The Gate interrupts plan-continuation bias before it starts. It is a review
of the full assumption proof plan, not just a test run.

---

## Trigger Phrases

Activate this skill when the user says any of the following (or close variations):
- `scs-plan-task`
- `plan task`
- `new ticket`
- `new bug` / `new feature`
- `let's work on X`
- `I want to build X`
- `there's a bug with X`

---

## Intake Workflow

This workflow runs once. When complete, the skill's job is done.
All subsequent work is driven by the generated MD file.

### Step 1 — Silent Context Load

Do this silently. No narration.

- Read `CLAUDE.md` at the repo root if it exists
- Follow any linked resources it references (app map, architecture docs, etc.)
- Do not ask the user to explain things already documented there

If no `CLAUDE.md` exists, note it internally and proceed.

---

### Step 2 — Code Exploration

Read the user's ticket description. Do a targeted exploration of relevant
files and modules, guided by CLAUDE.md pointers and the app map.

Build a working model of:
- What exists today in the relevant area
- Where this ticket touches the codebase
- What patterns and conventions are already established
- What the existing test setup looks like (framework, conventions, location)

---

### Step 3 — Write the Ticket MD File

Create `docs/<ticket-slug>.md` immediately after exploration.
Create `docs/` if it does not exist.

Write it now, while assumptions are forming — not after they've hardened
into code. Leave gaps honest. "unknown" is a valid value.

**Stamp the full file as shown below. Every section is required.**
The Agent Instructions block at the top is what makes this file
self-contained for future sessions — do not abbreviate it.

---

### MD File Format

~~~markdown
<!-- scs-plan-task generated — do not re-run skill for this ticket -->

# <Ticket Title>

**Type:** bug | feature
**Created:** <date>
**Status:** in-progress

---

## Ticket Context

> This section is the authoritative working understanding of the problem.
> It starts as a best-effort synthesis at intake and is refined as assumptions
> are proved or invalidated. The final state here should be accurate enough
> that anyone can read it and fully understand the problem without any other source.

**Source:** <Jira ticket ID and URL | user description | screenshot | other>

**Problem statement:**

<A clear, synthesized description of the problem or goal — not a verbatim paste.
Distill the signal from whatever the user provided: what is broken or missing,
who is affected, what the correct behavior should be, and why it matters.
Refine this as assumption proofs add clarity. The final version here should be
the single best answer to: "what is this ticket actually about?">

**Acceptance criteria:**

<Concrete, testable conditions that define done. If the user stated them
explicitly, restate them clearly. If they were implicit, derive them from
the problem statement and confirm with the user.>

**Out of scope:**

<Anything explicitly excluded, or adjacent work that was considered and
decided against. "None identified" if nothing was ruled out.>

---

## Agent Instructions

> This file is the complete working document for this ticket.
> Read it top to bottom before doing anything else.
> Do NOT re-run scs-plan-task — that skill is only for new tickets.

### How to resume this ticket

1. Check `Status` at the top — if `closed`, this ticket is done
2. Find the first unchecked item in the Progress Log
3. Read Session Notes from bottom to top for recent context
4. Continue from the unchecked item — do not re-do completed steps

### Rules that apply for the life of this ticket

- Every assumption needs a proof strategy — `[to prove]` is not a valid
  final state. Only `[proved]`, `[invalidated]`, or `[manual]` close an assumption
- Tests are unit and integration only — no UI automation, no E2E browser tests
- If a test cannot be written, pick another proof strategy:
  `code research` | `doc review` | `spike` | `user confirmation` | `manual verification`
- If an assumption is invalidated mid-implementation: STOP, mark it
  `[invalidated]`, add a Session Notes entry, tell the user, then continue
- Do not add scope beyond this ticket without flagging it to the user first
- Run the full test suite post-implementation — surface regressions immediately, never suppress
- Never delete Session Notes entries — append only
- The Gate must be passed before any implementation code is written:
  present assumption status + proof results + open items,
  wait for explicit user confirmation before proceeding

---

## What We Know

- <established fact from codebase or ticket description>
- ...

## What We Don't Know Yet

- <open question or gap — to be resolved via clarifying questions or proof>
- ...

## Assumptions

Every assumption needs a proof strategy. Status flows:
`[to prove]` → `[proved]` or `[invalidated]`

Proof strategies: `unit test` | `integration test` | `code research` |
`doc review` | `spike` | `user confirmation` | `manual verification`

| Status | Assumption | Proof Strategy | Notes |
|--------|------------|----------------|-------|
| [to prove] | <assumption> | <strategy> | |
| [to prove] | <assumption> | <strategy> | |

## Proposed Approach

<2–4 sentences. Strategy, not implementation detail. Written against the
assumptions above — if assumptions change, revisit this.>

## Files Likely Touched

- `path/to/file.ext` — reason
- ...

## Proof Plan

How each assumption will be validated before implementation proceeds.
Grouped by proof strategy. Every assumption in the table above must
appear in exactly one group below.

### Tests (unit / integration only)

No UI automation. No E2E. If behavior can only be verified via the UI
or an external system, it belongs in Manual Verification below.

- [ ] <test description> → proves: <assumption>
- ...

### Code Research

- [ ] <what to verify and where> → proves: <assumption>
- ...

### Doc / Dependency Review

- [ ] <what to check> → proves: <assumption>
- ...

### User Confirmation Needed

- [ ] <question for the user> → proves: <assumption>
- ...

### Spikes

- [ ] <minimal experiment to run> → proves: <assumption>
- ...

### Manual Verification

Items that cannot be proved by any automated method.
These must be checked by the user after implementation.

- [ ] <what to observe or verify> → proves: <assumption>
- ...

---

## Progress Log

- [ ] MD written
- [ ] Clarifying questions resolved
- [ ] Assumptions documented with proof strategies
- [ ] Proof plan executed (tests written, research done, confirmations gathered)
- [ ] Gate passed — user confirmed assumptions and approved implementation
- [ ] Implementation started
- [ ] All tests passing
- [ ] Full test suite run — no regressions
- [ ] Manual verification done
- [ ] Ticket closed

---

## Session Notes

<!-- Append entries here. Never delete. Most recent at bottom. -->
~~~

---

### Step 4 — Clarifying Questions

With the MD written, look at the gaps. Ask only questions where:
- The answer would change an assumption or the approach, OR
- A wrong assumption would cause wasted implementation effort

User Confirmation items from the Proof Plan count — consolidate them here.
Format as a numbered list, most critical first. Maximum ~5 questions.
If you have zero questions, say so and proceed.

Wait for answers before continuing.

---

### Step 5 — Update the MD

With answers in hand:
- Resolve items in "What We Don't Know Yet"
- Update or add assumptions
- Refine the Proposed Approach if needed
- Finalize the Proof Plan

---

### Step 6 — Execute the Proof Plan

Work through the full Proof Plan before writing any implementation code.

**Tests:**
- Follow the repo's existing test framework and conventions
- If none exists, pick the standard for the stack and note it in the MD
- Write tests that should currently fail — failing is correct and expected
- Stub untestable tests with `// TODO:` comment explaining the blocker
- Do not write implementation code to make tests pass
- Run tests and capture output
- Test scope: unit + integration only — no UI automation, no E2E, no external systems

**Code research:** Read source, document findings, update assumption status in MD.

**Doc / dependency review:** Check docs or source, note finding in Session Notes, update assumption status.

**Spikes:** Run the minimal experiment, document result in Session Notes, update assumption status.

**Manual verification items:** Note clearly for the user — do not skip or drop them.

After completing the Proof Plan, every assumption must have a final status:
`[proved]`, `[invalidated]`, or `[manual]`.

---

### Step 7 — The Gate

**Stop. Do not write any implementation code.**

Present to the user:
1. Assumption status table — proved / invalidated / manual / still open
2. Test results — what is red, green, stubbed
3. Research and spike findings
4. Open items still needing user input
5. Plain-English summary: "Here is what we are assuming. Here is the evidence."

Then ask: **"Do the assumptions hold? Should I proceed with implementation?"**

Wait for explicit confirmation. Do not proceed otherwise.

---

### Step 8 — Implementation

Once confirmed:
- Work toward making failing tests pass — proved assumptions drive the code
- Do not add scope beyond the ticket without flagging it first
- If an assumption is invalidated: STOP → mark `[invalidated]` → Session Notes → tell user → then continue
- Update the Progress Log as milestones complete

---

### Step 9 — Post-Implementation

Run the full test suite — not just new tests.
- New tests: passing or failing
- Existing tests: any regressions
- Regressions: surface immediately, never suppress

Update the MD:
- Mark proved assumptions `[proved]`
- Check off Progress Log items
- Add a Session Notes entry summarizing what was done

---

### Step 10 — Wrap-Up

When tests are green, manual verification is done, user confirms:
- Set `**Status:** closed`
- Add final Session Notes entry with date and one-line summary
- MD stays in `docs/` — it is a permanent record

---

## Edge Cases

**"This is just a quick fix"**
Still applies, abbreviated. Name the assumptions, assign proof strategies,
proceed. Scope creep starts with "this is quick."

**No existing test framework**
Pick the standard for the detected stack. Note the choice in the MD.

**Session reset mid-ticket**
Read the ticket MD. Follow the Agent Instructions. Resume from Progress Log.
Do not re-ask answered questions. Do not re-run this skill.

**Multiple tickets open**
Each gets its own MD. Track independently. Do not cross-contaminate.
```
