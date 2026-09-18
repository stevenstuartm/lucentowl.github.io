# Guide Refinement Standard

The reusable half of every study-guide refinement pass: what gets checked, in what order, and how to work through a batch. Domain specifics live in the plan document that accompanies each pass — see **The plan document** at the bottom for what belongs there instead of here.

Standards in force for every edit made under this document: [`.claude/skills/refine-prose/writing-standards.md`](../skills/refine-prose/writing-standards.md) (always) and [`.claude/content/study-guide-guide.md`](study-guide-guide.md) (format, tagging, content philosophy, and the shared Quality Checklist and Standing Gotchas).

---

## Division of responsibility

| This document | The plan document |
| --- | --- |
| Phase 0 and how a pass runs the shared checklist | Which guides are in scope, and their order |
| Process rules and the never-record-what-changed rule | The authoritative sources for the domain |
| Gotchas specific to running a pass | Domain-specific gotchas (source quirks, fetch failures, vocabulary traps) |
| The shape of the tracking sections | The contents of those sections, and the progress table |

One plan document per pass. A pass covers whatever block of guides was scoped when the plan was made — a whole category, a subcategory, or a single large guide.

---

## Phase 0: Consolidation (run first when the set itself is rough)

The checklist below refines guides one at a time. It assumes the set of guides is already right. When a block of guides is rough, that assumption fails: topics overlap, one guide answers two unrelated questions, lookup material sits inside learning content, and obvious gaps have no guide at all. Refining a guide that is about to be merged away wastes the work, and polished prose hides the structural problem the same way it hides a weak argument in a blog draft. Phase 0 settles the structure so the refinement pass runs on the final file set.

**When to run it.** Run Phase 0 whenever the scope is a category or subcategory that has not had a consolidation pass, or when a quick read shows overlapping guides, guides made of product lists, or a subcategory split that follows topic buckets rather than reader intent. Skip it for a single guide or for a block that has already been consolidated.

| Phase | What happens | Stops for approval |
| --- | --- | --- |
| **0. Consolidation** | Audit the whole set, decide what it should contain, restructure files and config to match | Once, at the gate, before any file is touched |
| **1. Refinement** | The checklist below, one guide at a time, in the new config order, including finishing any new guides | Never |

### What earns a guide its place

Apply the six tests in [What Earns a Guide Its Place](study-guide-guide.md#what-earns-a-guide-its-place) to every existing guide and every candidate gap. A guide that fails one gets a disposition other than **Keep**.

### Disposition vocabulary

| Disposition | Meaning |
| --- | --- |
| **Keep** | Survives as its own guide; scope may be tightened by the ownership map |
| **Merge into `<file>`** | Unique content moves into the named survivor; this file is deleted |
| **Split into `<files>`** | Named sections move to other files; this file survives with the rest |
| **Move to resource** | Lookup material leaves the guide for `_resources/` |
| **Move out** | Belongs to another category; content goes to that category's guide and this file is deleted |
| **Remove** | No unique content worth keeping; deleted outright |
| **New** | A gap that passed the gap test. Created in Phase 0 as a seed holding the sections the ownership map moves into it, added to config then, and finished during Phase 1 at its row |

**Never rename a file.** A merged guide keeps the survivor's filename, and only the `title:` changes.

### The topic ownership map

The ownership map is the lasting output of Phase 0. It is a table of `Concept | Owner | Non-owners treat it as`, and it assigns every concept that more than one guide touches to exactly one owning guide. A non-owner either defines the concept in a clause where it's used, or omits it, and doesn't link to the owner. Out-of-scope owners (a guide in another category) are allowed and named by path.

The map stays in the plan for the life of the pass, and Phase 1 checklist item 2 checks each guide against it.

### Steps

1. Read everything in scope, plus the boundary material in other categories the audit must not duplicate.
2. Build the topic ownership map.
3. Fill a disposition table for every existing guide and candidate gap, with a one-sentence reader question each. Propose subcategories and reading order, with the rationale for the order.
4. **Gate:** present the proposal. Nothing is edited before approval.
5. Execute: merges, splits, and New seeds (content moved wholesale, unpolished); moves to resource (diff against any existing resource first, carry over anything missing); removals; config and front matter; inbound links to moved or deleted files; the organization table in `study-guide-guide.md`.
6. Validate without a build: config parses, every config path exists, no inbound links point at deleted files.
7. Close: build the Progress table in the new config order, rewrite pre-flags by row number, delete the disposition table, keep the ownership map.

### How Phase 0 changes Phase 1

- **New guide rows get written, not just refined.** A seed holds only moved sections, unpolished and often uncoordinated. Write the rest of the guide around them following `study-guide-guide.md` and the scope the ownership map assigns, then run the full checklist. Item 1 applies to freshly written prose with no discount, since a new guide is exactly the plausible, unverified text item 1 exists to catch.
- **Item 2 runs across guides.** Beyond within-file redundancy, check the guide against the ownership map. If it doesn't own a concept, it doesn't re-teach it.
- **Closing adds one check.** After the last row, re-run the sibling-link grep across the scope and confirm no concept is re-taught against the ownership map.

---

## Review checklist (apply to every guide)

The checklist is the [Quality Checklist](study-guide-guide.md#quality-checklist) in `study-guide-guide.md`, shared with new-guide authoring so both hold guides to the same bar. Item numbers there are the ones plans and pre-flags refer to. Two refinement-specific additions:

- **Item 1 records what it can't verify.** A claim softened because no source confirms it goes under **Unverified, left standing** in the plan. The corrections themselves are in the diff, so don't write them down anywhere (see Process below).
- **Out-of-scope sibling links are judged against the pass's scope**, not just the subcategory: remove inline links to any guide the pass covers.

---

## Process

- **One guide at a time**, no parallel dispatch. The status column in the progress table is the single source of truth for where the pass is.
- **Per guide:** run the checklist, apply the fixes, run `/refine-prose`, set status to Complete, move to the next row. Don't stop for approval between rows. No Jekyll build — content-only edits don't break the build.
- **Never record what changed.** The progress table tracks status and nothing else, because the corrections are already in the diff and a per-guide changelog is dead weight. The only things that get written down are forward-looking:
  - a finding a *later, not-yet-done* row has to act on goes in **Open pre-flags**;
  - a fact that constrains every remaining guide goes in **Cross-guide facts in force**;
  - a claim left unverified on a finished guide goes in **Unverified, left standing**.

  Nothing else. Prune each entry when the row it targets is done.
- **Promote a gotcha when it stops being about one domain.** A lesson learned mid-pass starts in the plan's own gotchas section. When a second pass in a different domain would hit the same trap, move it to [Standing Gotchas](study-guide-guide.md#standing-gotchas) in `study-guide-guide.md`, or to this document's own standing gotchas if it is about running a pass rather than about content.

---

## Standing gotchas

The domain-neutral gotchas that apply to writing and refining alike live in [Standing Gotchas](study-guide-guide.md#standing-gotchas) in `study-guide-guide.md`; read them before starting a pass. These are the ones specific to running a pass:

- **The factual pass leaves no trace in a diff.** A guide whose tags, links, and diagrams look done has not necessarily had item 1 run on it. Status in the progress table, not the diff, is the record of whether item 1 ran.
- **A pre-flag is a lead, not a finding.** Re-verify every pre-flag against a source before acting on it. A pre-flag raised from a guide's own uncorrected prose propagates that guide's error into a second guide. When one turns out wrong, fix the guide that raised it too.

---

## The plan document

One per pass, in `_drafts/`, named `<scope>-refinement-plan.md`. It carries everything this document deliberately leaves out.

### Invariants

These are not stylistic preferences. Each one exists because something else in this standard depends on it.

- **Every heading below is present from the start, even when its section is empty.** A pass that never creates an **Unverified, left standing** heading will quietly leave unverified absolutes in the guides instead of softening them, because item 1's fallback has nowhere to write. Same for pre-flags. Create the headings when the plan is created, not when the first entry appears.
- **Row numbers are assigned once and never reused or renumbered.** Pre-flags, cross-guide facts, and the unverified list all address rows by number, and those references outlive the rows they were written from. If a guide is added mid-pass, give it the next free number at the bottom of the table and note where it belongs in reading order — do not renumber to keep the table in config order.
- **Status is exactly `Not started`, `In progress`, or `Complete`.** "Status is the single source of truth" only holds if the vocabulary is closed. No `Partial`, no `Done (tags only)` — a guide that had some items run and not others is `In progress`.
- **`Complete` means all nine checklist items ran and `/refine-prose` came back clean.** Not "the diff looks substantial." Item 1 leaves no trace in a diff, so this status is the only record that it happened; setting it early destroys the information permanently.
- **A pre-flag names a row number, not just a guide.** Guide names get remembered wrong and don't sort. `| 44 data-architecture |` is the form — number first, name as the human hint.
- **Cross-guide facts lead with a bolded subject.** The section is read by scanning for a subject, not by reading top to bottom, and it grows past a screenful early in any real pass.

### Starting a new pass

1. Create `_drafts/<scope>-refinement-plan.md` from the skeleton below.
2. Decide whether the pass needs **Phase 0** (see above). If it does, run Phase 0 through its gate before building the progress table, keep the **Topic ownership map** section in the plan, and build the table from the post-consolidation config. If it doesn't, delete that section from the skeleton.
3. Build the progress table from `assets/data/study_guides_config.json`, in config order, one row per guide. That order is the consumption order.
4. Write the scope sentence and name the sources. Leave the three tracking sections empty under their headings.
5. Run the tag-frequency measurement for the category and record it under **Domain notes** — item 9 needs to know which tags are filler *here*, and that is a per-category fact.
6. Start at row 1.

### Header

State the scope in a sentence or two: which directory, which config category or subcategory, and the consumption order (normally the order in `assets/data/study_guides_config.json`, which already encodes the learning path). Link this document as the standard in force.

### Sources

Name the authoritative sources item 1 verifies against — the vendor's primary docs, the project's own documentation, the relevant specs — and any that are known-unreliable or off-limits.

### Domain notes

How the domain-neutral checklist items land in this specific domain. Two items always need it: **item 7** needs the domain's containment hierarchy spelled out, and **item 9** needs the measured tag frequencies for the category, since "which tags are filler" is a per-category fact. Add others only where a checklist item would otherwise be ambiguous in this domain.

### Domain gotchas

The plan's own version of the standing gotchas above: source quirks, endpoints that time out and their working substitutes, figures that are known not to be published anywhere citable, vocabulary traps. Anything here that a pass in a different domain would also hit should be promoted into the standing gotchas instead.

### Cross-guide facts in force

Facts verified during an earlier row that constrain every *remaining* guide touching the topic. This is the section that keeps a 60-row pass from re-researching the same retirement date twenty times. One bolded subject per bullet so it can be scanned. Entries stay for the life of the pass — unlike pre-flags, they are not pruned per row.

### Open pre-flags

A table of `Target row | Lead`. Leads for rows not yet done. Delete the entry once its row is complete. A pre-flag is a lead, not a finding.

### Unverified, left standing

Claims on *finished* guides that could not be confirmed against a source. Each was softened rather than asserted. Record which row, what the claim was, and what the guide says instead. Revisit if a source turns up.

### Progress

The tracking table, and the single source of truth for where the pass is. Columns: row number, subcategory, guide filename, status. Status is `Not started`, `In progress`, or `Complete`. **No other columns** — a notes or changes column is the changelog this standard forbids.

### Skeleton

Copy this into the new plan file and fill in the bracketed parts.

````markdown
# [Scope] Study Guides Refinement Plan

Tracks the review-and-refine pass over all guides in `_guides/[path]/`. Guides are consumed sequentially, in the order they appear in `assets/data/study_guides_config.json` (the "[Category]" category) — that order already encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope; the config ordering handles that.

**The process rules live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md); the checklist and cross-domain gotchas live in [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

## Sources

- Primary: [the vendor's or project's authoritative docs].
- Off-limits or unreliable: [sources that must not be cited as fact].

## Domain notes

**Item 7 (hierarchy and scope clarity)** in this domain means [the containment hierarchy].

**Item 9 (tag audit)** — measured across the [N] guides before the pass: [tag frequencies]. So for this category: drop [category-restating tag], and treat [filler tags] as the ones to replace with real content signal.

## Topic ownership map

*(Only when the pass runs Phase 0; delete this section otherwise. Stays for the life of the pass.)*

| Concept | Owner | Non-owners treat it as |
|---|---|---|

## Domain gotchas

*(Empty at the start. Add source quirks, timeouts and their substitutes, unpublishable figures, vocabulary traps as they are found. Promote anything cross-domain into the standard instead.)*

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

*(Empty at the start.)*

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding** — re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

*(Empty at the start.)*

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | [Subcategory] | [guide-filename.md] | Not started |
````
