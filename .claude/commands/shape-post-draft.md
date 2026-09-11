# shape-post-draft

Shape a raw blog post draft into a coherent argument before any prose work happens. Identifies the thesis, inventories the claims, audits the cited sources, finds the gaps and internal contradictions, and proposes structures. Accepts an optional file path as argument.

**Usage**: `/shape-post-draft _drafts/my-idea.md`

**File resolution**: Use the file path argument if one is given. Otherwise use the file currently open in the IDE (`ide_opened_file` context). Only ask if neither signal is present.

> **Known quirk**: the VS Code extension does not attach `ide_opened_file` to a *bare* slash-command turn (a confirmed upstream bug). If the tag is missing on the invocation turn, do not conclude that no file is open — ask the user to paste the path, and frame it as the known quirk rather than as ambiguity about their intent.

---

## What this command is for

`/refine-prose` and `/review-publishable` both assume a draft that already knows what it is. They operate on sentences. This command operates on **arguments**, and it runs before either of them.

The failure it exists to prevent: polishing prose on an argument that is about to move. Cutting a redundant clause from a section that gets rewritten an hour later is wasted work, and worse, polished prose disguises structural defects — once both sides of a contradiction read smoothly, the contradiction stops being visible.

**The primary output is the distillation.** A long draft is hard to consume as a whole, and the claim inventory, the argument spine, and the tension list exist so the author can see what their points actually are, in one view, without rereading 5,000 words to find out. Everything downstream (the structure options, the proposals, the restructure) is built on that map and is worth less than it.

**This command is also a gate.** A draft should not reach `/refine-prose` until its argument has stopped moving.

| This command | `/review-publishable` |
| --- | --- |
| Raw or half-formed material | A draft that knows what it is |
| Restructures the draft, marks new argument | Outputs a report, then edits the file |
| Never writes unmarked argument | Ends with a prose reduction pass |
| Asks "is this argument complete?" | Asks "is this argument well-said?" |
| Presents options, author decides | Applies fixes directly |

Scope is blog post drafts. Study guides have their own pass in [`guide-refinement-standard.md`](../content/guide-refinement-standard.md).

---

## Invariants

Not stylistic preferences. Each exists because something else here depends on it.

- **Structural edits are free. New argument must be marked.** The line is one test: *does this edit introduce a proposition the draft did not already contain?*

  If no, make it directly. Reordering sections, splitting or merging them, adding a header that names material already present, cutting a decorative claim, fixing a typo. None of that invents anything the author has to own, and refusing to do it would leave the command unable to shape at all.

  If yes, it goes in wrapped in a marker, per the next invariant. A new claim, a reframe, a rhetorical move, a header that asserts something the body does not yet argue. These are the author's to make, and a command that slips them in unmarked produces a post whose author is no longer certain which parts they wrote.

- **Every proposal carries a marker, in the draft itself.** New argument goes where it belongs in the draft, not exiled to a side document where it is easy to lose the thread. It goes in like this:

  ```markdown
  > **PROPOSED** — accept, rewrite, or delete.
  > Uber did not collapse 2,200 services into 70. They built a layer over them.
  ```

  A blockquote is visible in the editor, survives a copy-paste, and is greppable. The plan records the same proposals as a list so they can be reviewed together, but the draft is where they live.

  This is the invariant most easily violated by accident, because a good proposed line reads like it belongs. A post published under a byline should not contain arguments its author never consciously chose.

- **`/refine-prose` does not run while a `PROPOSED` marker remains.** This is what makes the previous invariant mechanical instead of aspirational. `grep -c '\*\*PROPOSED\*\*'` returning anything but zero means the argument is still open and polishing is premature. Resolving a marker means the author accepted the text (delete the marker, keep the prose), rewrote it, or deleted both.

- **The thesis is extracted, never invented.** If the draft does not contain a thesis, the plan reports candidate theses found *in the material* and stops. Writing a thesis for the author is the one thing this command must not do — it is the difference between shaping their idea and replacing it.

- **Every cited source gets fetched and read.** Not skimmed for the supporting quote. Read for what the source's own conclusion was. A source whose conclusion undercuts the draft's thesis is the single highest-value finding available, and it is invisible unless someone actually reads past the quotable part.

- **Counterarguments are found, not generated.** Search for published positions that contradict the thesis and quote them. Do not manufacture objections. A fabricated objection is indistinguishable in tone from a real one and there is no principled way for the author to weigh them against each other.

- **Every heading in the skeleton is present from creation, even when empty.** An absent **Unreconciled tensions** heading means tensions get noticed and then dropped, because the finding has nowhere to live.

- **Claim numbers are assigned once and never reused or renumbered.** Tensions, gaps, and decisions all reference claims by number, and those references outlive any reordering of the draft.

- **Decision status is exactly `Open`, `Decided`, or `Deferred`.** No `Mostly settled`. A decision the author has not explicitly made is `Open`.

---

## Process

### Step 1 — Read and assess shapeability

Read the draft. Report content type, approximate word count, and section count.

Note the draft's maturity as **context for the author, never as a gate on the pass**. A developed draft still gets the full inventory. A long draft needs it most, because length is exactly what makes an argument hard to hold in one view, and a 5,000-word draft that reads well section by section can still carry a contradiction no one can see from inside it.

The only material this command declines is material with no propositions in it yet: a title and a paragraph of notes. Say so plainly and name what is missing. Everything else proceeds.

Do not route a draft to `/review-publishable` instead of running this pass. That judgment is the author's, it needs the inventory to be made well, and making it here means the author asked to see their argument and got an opinion about their argument's readiness instead.

### Step 2 — Extract the thesis

Write the draft's thesis in exactly one sentence: what it **argues**, not what it covers.

Three possible outcomes, and the plan records which:

- **A single clear thesis.** State it. Confirm with the author that it is what they meant, because everything downstream is measured against it.
- **Competing theses.** The draft argues two or more things that do not reduce to one. List them, note which has more material behind it, and flag that this is the author's first decision — they lead to different posts.
- **No thesis.** The draft is *about* a topic without arguing anything. List the candidate theses present in the material and stop the pass here. Everything downstream is premature.

### Step 3 — Inventory the claims

Walk the draft and extract every distinct claim as a numbered bullet. Not every sentence, every *claim* — something that could be true or false.

Tag each one:

| Tag | Meaning |
| --- | --- |
| **Load-bearing** | The thesis collapses without it |
| **Supporting** | Strengthens the thesis, which survives without it |
| **Decorative** | Neither. Often a good line doing no argumentative work |
| **Unsupported** | Asserted with no mechanism, evidence, or source behind it |

A claim can be both load-bearing and unsupported. **That combination is the most important output of this step** — it is the argument's structural weak point, and it is where a skeptical reader will push first.

Decorative claims are not automatically cuts. Some carry voice. Flag them so the author decides knowingly.

**Then extract the argument spine**: the ordered subset of load-bearing claims the thesis actually rests on, usually ten to fifteen even in a long draft. This is the single most useful thing the pass produces. It is what lets an author see the shape of their own argument without rereading it, and it is what makes a missing step or a redundant one obvious.

Run this step in full on every draft, including one that looks finished. It is the deliverable, not a means to the restructure.

### Step 4 — Audit the sources

For every source the draft cites: fetch it, read it, and record three things.

1. **Does the draft quote it accurately?** Verify verbatim.
2. **Is the quote representative of the source?** A quote lifted from a section arguing the opposite way is technically accurate and substantively misleading.
3. **What was the source's own conclusion?** Record it whether or not it fits.

Where the source's conclusion runs against the draft's thesis, that is a finding and it goes at the top of the plan. The fix is never to drop the source. It is to engage the disagreement directly, which nearly always produces a stronger post than avoidance would.

Also flag any claim that *should* have a source and does not — statistics, market data, survey results, historical claims, and any load-bearing number.

### Step 5 — Find the internal tensions

Compare the claim inventory against itself. Which claims pull against each other?

The pattern to look for: a principle asserted in one section and quietly violated by a recommendation in another. These survive drafting because each section is locally coherent, and they survive polishing because polished prose makes both sides sound settled.

For each tension, record the two claim numbers, state the conflict in one sentence, and describe what resolving it would require. Do not resolve it. Resolution usually changes what the post argues, which is the author's call.

### Step 6 — Find the gaps

Two questions:

- **What does the thesis imply that the body never delivers?** If the draft argues at length that a problem exists and never addresses what to do about it, that gap is conspicuous precisely because the draft raised it.
- **What does a skeptical reader need that is not here?** The obvious objection, the case where the argument breaks down, the context that changes the answer.

Each gap: what is missing, why the thesis implies it, and roughly what would fill it.

### Step 7 — Propose structures

Offer **two or three** alternative structures for the argument. Not one. A single proposal is a decision wearing the costume of an option.

For each: an H2/H3 outline, one sentence on what it foregrounds, one on what it costs, and which of the tensions and gaps it resolves or leaves open.

Apply the outline test to each — reading only headers, does a skimmer get the complete argument?

Recommend one, with reasons, then ask the author to pick. Step 8 applies whichever they choose, so this is the point where the pass waits for an answer rather than assuming one.

### Step 8 — Apply the structure

Restructure the draft into the chosen shape. This is the step that makes the command shape rather than review, and the first invariant governs every edit in it.

**Apply directly**, because none of it introduces a proposition the draft did not already contain:

- Move sections into the new order
- Split a section carrying two claims, merge two carrying one
- Add or rewrite headers to name material already present
- Cut claims tagged decorative that the author agreed to cut
- Fix outright typos

**Insert as a marked proposal**, because each one is a new proposition:

- Prose filling a gap from Step 6
- A reframe that resolves a tension from Step 5
- A counterargument found in Step 4 and the response to it
- A header asserting something the body does not yet argue
- Any load-bearing claim the draft needs and does not have

Put each proposal where it belongs in the draft, in the marker form from the invariants. Do not smooth the seams between accepted prose and proposals. Visible seams are the point, and `/refine-prose` will smooth them once the argument is settled.

Leave the prose that survives alone. Rhythm, word choice, and redundancy all belong to the next stage.

### Step 9 — Write the plan document

Create `_drafts/<slug>-shaping-plan.md` from the skeleton below, where `<slug>` matches the draft's filename. Every heading present, even where empty.

### Step 10 — Report

Summarize in the chat: the thesis, the count of load-bearing-and-unsupported claims, the source-conclusion findings, the tensions, the gaps, the structure applied, and the number of `PROPOSED` markers left in the draft.

End by naming the decisions that are the author's, explicitly, and state plainly that the draft is not ready for `/refine-prose` until every marker is resolved.

---

## Explicitly out of scope

- **Writing unmarked argument into the draft.** Structural edits are in scope; new propositions are marked. See the first invariant.
- **Prose quality of any kind.** Sentence rhythm, punctuation, word choice, AI-tells. All of it belongs to `/refine-prose`, and none of it is worth assessing on prose that may not survive.
- **Title options.** `/review-publishable` handles search-discoverable titles, and a title should be written against a settled argument.
- **Front matter, tags, config files.** Later.
- **Deciding the thesis.** See **The thesis is extracted, never invented**.

---

## The plan document

One per draft, in `_drafts/`, named `<slug>-shaping-plan.md`.

The draft carries the shaped argument and the proposals. The plan carries what the draft cannot hold: the claim inventory, the source audit, the tensions and gaps, and the decisions still open. Its job is to let the author see the whole argument at once instead of reconstructing it by scrolling.

The plan is a working document, not a changelog. It records where the argument stands and what remains to decide. It does not narrate what the pass did.

Delete it once every `PROPOSED` marker is resolved and the draft moves on to `/refine-prose`. Its job ends there.

### Skeleton

```markdown
# Shaping Plan: [Draft Title]

Draft: `_drafts/[filename].md`
Status: Shaping
Standard: [.claude/commands/shape-post-draft.md](../.claude/commands/shape-post-draft.md)

## Thesis

[One sentence: what the draft argues. Or the competing theses, or the
candidates if none is present.]

Author confirmed: [Yes / Not yet]

## Claim inventory

| # | Claim | Tag |
| --- | --- | --- |
| 1 | | |

Load-bearing and unsupported: [claim numbers, or "none"]

## Source audit

| Source | Quoted accurately | Representative | Source's own conclusion |
| --- | --- | --- | --- |
| | | | |

Conclusions running against the thesis: [or "none"]
Claims needing a source and lacking one: [claim numbers, or "none"]

## Unreconciled tensions

| Claims | Conflict | What resolving it requires |
| --- | --- | --- |
| | | |

## Gaps

| # | What is missing | Why the thesis implies it |
| --- | --- | --- |
| | | |

## Structure options

### Option A — [name]

[Outline. What it foregrounds. What it costs. Which tensions and gaps it resolves.]

### Option B — [name]

### Recommended

[Which, and why.]

## Open proposals

Every `PROPOSED` marker currently in the draft, so they can be reviewed as a set
rather than found by scrolling. Delete the row when the marker is resolved.

| # | Section | What it proposes | Resolves |
| --- | --- | --- | --- |
| 1 | | | |

Markers remaining: [count]. `/refine-prose` runs when this reaches zero.

## Open decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | | Open |
```
