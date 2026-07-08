---
name: refine-prose
description: Use when asked to lint, refine, clean up, polish, or "run the linter and fix" a piece of prose content (blog post or draft). Formalizes the loop of running the mechanical linter to a clean state and then doing the narrative self-review the linter can't do. Do not use for a full publishability/editorial review (thesis, scholarly quality, title options).
---

# Refine Prose

Formal, self-contained orchestration for "run the linter and refine as needed." This directory owns everything the loop needs — the writing-standards ruleset, including the mechanical-check patterns — so it doesn't depend on anything else to run.

## File resolution

Explicit file path argument > file currently open in the IDE (`ide_opened_file` context) > ask the user. Don't ask if either of the first two signals is present.

## Orchestration — follow in order, don't skip steps

**1. Resolve the target file** and read it.

**2. Check for a matching platform doc.** Enumerate `.claude/skills/refine-prose/platforms/*.md`. Each file's frontmatter has a `detect:` field describing, in plain English, the signal that makes it apply (a config-file fingerprint, or the user naming the tech explicitly). If one or more match the current project, read them — their mechanical patterns and rules layer on top of `writing-standards.md` for steps 3–4 and 7 below. No match is the common case when sharing this skill outside its original project and is not an error; just proceed with the universal rules only.

**3. Run the mechanical checks.** `writing-standards.md`'s "Mechanical Checks" section (plus any matched platform doc's own patterns) lists a small set of regex patterns — literal phrases, em-dashes, and any platform-specific syntax checks. Run each one against the target file with the Grep tool. These are exact-match, not heuristics: a hit is always an Error, never a judgment call.

**4. Fix every Error**, one at a time, against the rule that flagged it in `writing-standards.md` or the matched platform doc — not a mechanical find/replace. Each fix should restate the point directly, not just delete the flagged phrase.

**5. Re-run each pattern. Loop steps 4–5 until every pattern returns zero matches.** This is a loop, not a single pass — merging two choppy sentences to fix one violation can produce a new em-dash or reintroduce a banned phrase. Don't stop at the first clean-looking pass without re-checking to confirm.

**6. Self-review pass** — the things a literal-string grep cannot catch. This does double duty: it's both nuanced judgment calls and the wider net for AI-tell patterns and prose-rhythm issues too variable to pin to an exact string (see `writing-standards.md`'s "Writing Principles Requiring Judgment" section for the full list — parallel-structure staccato, bare lists after a period, lazy parentheticals, command-style paragraphs, and more). Specifically:
- Header outline test: do the H2/H3 headers alone tell the complete argument to a skimming reader?
- Are examples concrete (specific numbers, named tradeoffs) or generic and dismissible?
- Is prose used for explaining/reasoning, with bullets reserved for actual lists, steps, or comparisons — not as a crutch?
- Any AI-tell pattern too variable for an exact-match grep: announcement sentences ("Here's what this means:"), redundant restatements of a point the prose just made, scaffolding sentences that only introduce what follows, choppy rhythm from missing conjunctions
- Any matched platform doc's own voice/formatting conventions (e.g. blog-post voice balance)

**7. Report back**: final mechanical-check status (should be zero matches across all patterns), a summary of what changed, which judgment-call issues were intentionally left as-is and why, and any open judgment calls to flag for the user's own read-through. Do not declare the document "done" — final judgment on accuracy and nuance stays with the user.

## Portability

To use this in a different project: copy the whole `.claude/skills/refine-prose/` directory into the target project's `.claude/skills/`. `writing-standards.md` and the orchestration in this file are both platform-agnostic as written — step 2 never names a specific platform; it only ever reads whatever `detect:` condition each file in `platforms/` declares for itself and applies that file's rules when the condition matches. SKILL.md doesn't know or care what's currently inside `platforms/` — whatever ships in that directory, gets added to it, or gets deleted from it, this file's logic doesn't change. If no file's `detect:` condition matches the target project, the skill runs with the universal rules only. No manual stripping needed, and no code to port — everything is a markdown doc plus regex patterns the agent runs directly with the Grep tool.

To add support for a project's own platform quirks (a static-site generator, a docs framework with its own markdown dialect, a house voice convention), add a new file to `platforms/` following the same shape: frontmatter with a `detect:` field, then the additional mechanical patterns and judgment-call rules. Nothing outside `platforms/` needs to change to support it.
