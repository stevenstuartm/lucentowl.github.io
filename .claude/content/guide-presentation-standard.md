# Guide Presentation Standard

The cheap refinement pass: form, tone, prose, and visual aids. It brings existing guides up to the current writing and figure standards without re-verifying what they claim. Content standards change often enough that most refinement is this kind, and it should not have to pay for web research or a consolidation audit.

The deep pass, [`guide-refinement-standard.md`](guide-refinement-standard.md), verifies facts, fills gaps, and restructures a block of guides. It runs this standard as its last step on every guide, so everything here also applies there.

Standards in force for every edit made under this document: [`.claude/skills/refine-prose/writing-standards.md`](../skills/refine-prose/writing-standards.md) (always), [`.claude/content/study-guide-guide.md`](study-guide-guide.md) (format, tagging, the Quality Checklist), and [`.claude/content/figure-guide.md`](figure-guide.md) (whenever a diagram is added).

---

## Which pass to run

| Run this presentation pass when | Run the depth pass when |
| --- | --- |
| A writing, figure, or format standard changed and existing guides lag behind it | The facts may be stale: limits, tiers, defaults, retirements |
| A guide reads badly: dense prose, missing tables, a mechanism the reader has to picture unaided | A guide is missing material a practitioner would expect |
| Tags or descriptions have drifted from the tagging policy | The set of guides itself is rough: overlap, product lists, gaps |

When in doubt, run this pass. Anything suspicious it finds becomes a lead for a later depth pass (see **Suspect claims** below).

---

## The one rule: meaning does not change

Rewording, reordering, turning prose into a table, and adding a figure must preserve every claim exactly. This pass does not verify facts, so it has no standing to change them.

- **Don't add material.** No new sections, no new trade-offs, no new examples that make a claim the guide didn't already make. Filling a gap is item 3, and item 3 belongs to the depth pass.
- **A figure depicts only what the prose already says.** A diagram asserts a mechanism, so a figure that shows more than the text states is new, unverified content.
- **Don't fix a claim that looks wrong.** Log it under **Suspect claims** and leave the text alone. A "fix" made without a source is a guess dressed as a correction.
- **Removal is allowed only for repetition.** Deleting a fact the guide states twice is presentation. Deleting a fact the guide states once is a content decision.

Without this rule the cheap pass slowly becomes an unverified content pass, and the guides it touches look more trustworthy than they are.

---

## Checklist

These are the presentation items of the [Quality Checklist](study-guide-guide.md#quality-checklist). Item numbers match that list.

| Item | What this pass does |
| --- | --- |
| **2. Redundancy** | Within the file only. Consolidate a fact, table, or explanation repeated across sections. Checking against a topic ownership map is the depth pass's job. |
| **4. Clarity** | Dense prose that a table or list would serve better; structure inconsistent with the guide's own sections. |
| **5. Diagrams** | Apply [Show What the Reader Has to Picture](study-guide-guide.md#show-what-the-reader-has-to-picture), bounded by the rule above. |
| **6. Decision trees** | Two or more comparison tables feeding one "which do I pick" question become one decision tree. |
| **8. Front matter** | Description still matches the content. |
| **9. Tag audit** | Against the [Tagging System](study-guide-guide.md#tagging-system) policy, with filler measured per category. |
| **Out-of-scope links** | Remove prerequisite callouts, "where this fits" framing, and inline links to siblings in the subcategory (see [Explicitly out of scope](study-guide-guide.md#explicitly-out-of-scope)). |
| **Prose** | Run `/refine-prose` to a clean lint and its narrative self-review. |

Run them in the order listed. `/refine-prose` goes last because every earlier item rewrites prose. The [refinement-items gotchas](study-guide-guide.md#on-the-refinement-items) in `study-guide-guide.md` apply to this pass.

---

## Two ways to run a batch

**Per guide (vertical).** Every item above on one guide, then the next. Use this when guides read badly as a whole.

**Per check (horizontal).** One item across many guides. Use this to roll out a single standards change, such as a new writing rule, a new figure convention, or a revised tag policy, without reopening everything else. Name the change being rolled out before starting, and touch nothing unrelated to it. A guide that also needs other presentation work gets a vertical pass later, not now.

---

## Tracking

A batch that finishes in one session needs no tracking file.

A batch that spans sessions gets `_drafts/<scope>-presentation-plan.md` with three sections and nothing else:

````markdown
# [Scope] Presentation Pass

Scope: [directory or config category/subcategory]. Mode: [vertical, or horizontal: the one change being rolled out]. Standard in force: [`.claude/content/guide-presentation-standard.md`](../.claude/content/guide-presentation-standard.md).

## Suspect claims

Claims that looked wrong and were left standing. Leads for the next depth pass, not findings.

| Guide | Claim | Why it looks off |
|---|---|---|

## Progress

| # | Guide | Status |
|---|---|---|
| 1 | [guide-filename.md] | Not started |
````

Status is `Not started`, `In progress`, or `Complete`. As in the depth pass, never record what changed; the diff already does.

### Suspect claims

Log every claim that looked stale, wrong, or overstated, even when no depth pass is planned. When a depth pass over that scope starts, its plan copies these rows into **Open pre-flags**, where they are re-verified before anyone acts on them. When a batch needs no tracking file, report suspect claims at the end of the session instead.

---

## Standing gotchas

- **A presentation pass is not a verification.** A guide with clean prose, figures, and tags looks verified, and it isn't. Only a depth-pass `Complete` records that item 1 ran.
- **Tables harden claims.** Moving a hedged sentence into a table cell tends to drop the hedge, because cells favour short absolutes. Carry the qualifier into the cell or a footnote row.
- **A figure is the easiest place to add content by accident.** Drawing a flow forces choices the prose never made: which component calls which, in what order. If the prose doesn't settle a choice, the figure doesn't make it.
