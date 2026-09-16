# Guide Refinement Standard

The reusable half of every study-guide refinement pass: what gets checked, in what order, and how to work through a batch. Domain specifics live in the plan document that accompanies each pass — see **The plan document** at the bottom for what belongs there instead of here.

Standards in force for every edit made under this document: [`.claude/skills/refine-prose/writing-standards.md`](../skills/refine-prose/writing-standards.md) (always) and [`.claude/content/study-guide-guide.md`](study-guide-guide.md) (format, tagging, content philosophy).

---

## Division of responsibility

| This document | The plan document |
| --- | --- |
| The checklist and its order of operations | Which guides are in scope, and their order |
| Process rules and the never-record-what-changed rule | The authoritative sources for the domain |
| Cross-domain gotchas learned from earlier passes | Domain-specific gotchas (source quirks, fetch failures, vocabulary traps) |
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

Apply these tests to every existing guide and every candidate gap. A guide that fails one gets a disposition other than **Keep**.

1. **One reader question.** State in one sentence what a reader comes to this guide to learn. If two guides give the same answer, merge them. If one guide needs two unrelated sentences, split it.
2. **Learning content, not lookup.** Apply the Lookup Test from [`resource-guide.md`](resource-guide.md). Material a reader consults rather than learns from, such as templates, worked pipelines, and selection tables, moves to `_resources/`.
3. **Durable substance.** A guide whose core is a list of products, tools, model names, versions, or specs goes stale faster than anyone updates it. Keep its durable reasoning and fold that into a concept guide. Drop the list.
4. **Right category.** A topic another category already owns stays there. Guides may link to guides outside the pass's scope, but they don't re-teach them.
5. **Gap test.** A candidate new guide qualifies only if a practitioner in the domain would expect the category to cover it, no existing guide owns it, and folding it into an existing guide would break that guide's one-reader-question test. Judge at study-guide altitude, not doc-completeness.
6. **Subcategory shape.** Avoid single-guide subcategories. The subcategory split should follow a real difference in reader intent, not just group guides into topic buckets.

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

**Order of operations:** run item 1 (correctness and completeness) **first** — it is the only pass that adds or rewrites content, and every later check has to operate on the corrected text, not the original. Items 2-7 then refine that content. The two front-matter items (8 and 9) run last so they confirm tags and description against the final content.

1. **Factual correctness and completeness (verify against authoritative sources) — do this first.** Distinct from item 3's *pedagogical* gaps: this checks whether the guide's technical claims are actually true and current, and whether a materially important part of the topic is missing — not treating the prose as given. Web-research the guide's falsifiable claims against the authoritative sources named in the plan: service limits, naming and character constraints, defaults, support matrices, feature availability and release/preview status, tier and pricing boundaries, and any hard number or absolute ("max 24 characters", "not supported", "always inherits", "only in the same region"). Prioritize claims that are (a) falsifiable, (b) consequential if a reader acts on them, or (c) prone to drift as the product evolves — don't spend the pass rubber-stamping prose that merely reads plausibly, and don't try to re-verify inherently stable conceptual framing. Correct stale or wrong content in place. Where a claim can't be confirmed against a source, soften it to what's verifiable and record it under **Unverified, left standing** rather than leaving an unverified absolute in place. **Completeness is judged at study-guide altitude, not doc-completeness** — flag only a missing piece a practitioner would reasonably expect given the guide's stated scope and description, not every edge case. Because this pass can add or modify content, run the remaining checks over whatever it produces. The corrections themselves are in the diff, so don't write them down anywhere (see Process below).
2. **Redundancy** — same fact, table, or explanation repeated across sections; consolidate or cross-reference within the same file.
3. **Gaps** — missing explanation of a concept before it's prescribed; missing trade-offs; missing "why would I not use this." (Pedagogical completeness — whether concepts are introduced in a learnable order — as opposed to item 1's factual completeness.)
4. **Clarity** — dense prose that a comparison table or list would serve better; inconsistent structure vs. the guide's own sections.
5. **ASCII diagrams** — reserve for genuinely technical relationships and flows: network topology, request or traffic flow, data flow between components, reconciliation loops, hub-and-spoke topologies, auth and token exchange sequences. The bar is whether it depicts actual structure (branching, parallel components, directional flow between distinct systems) that prose or a table can't already convey cleanly. Do **not** use a diagram to dress up a linear conceptual hierarchy, a scope or abstraction ladder, or anything that's really just a sequential list with arrows between prose labels — that's not practical output, it's decoration. If a sentence already says it clearly, don't diagram it. Skip where a table already conveys the comparison clearly.
6. **Decision trees** — where a guide has 2+ comparison tables that all feed into "which option do I pick," consider consolidating into one ASCII decision tree.
7. **Hierarchy and scope clarity.** When a guide introduces a resource or concept whose behavior or constraints depend on where it sits in the domain's containment hierarchy, state that scope explicitly and early rather than leaving the reader to infer it from a buried constraint bullet. The tell is a constraint bullet that only makes sense if you already know the scope — a line like "all members must be in the same VNet" tells a reader who already knows the answer, and tells nobody else. Apply this only where scope is genuinely ambiguous or consequential for how the reader would design or deploy something, not as boilerplate on every resource mentioned.
8. Confirm front matter (tags, description) still matches content after edits.
9. **Front matter tag audit.** Tags are free-form (`content-filter.js` and `guides-browser.js` read them straight off front matter, no fixed enum), so there is no technical constraint keeping them generic — and the default failure mode is a set of tags so common within the category that none of them discriminate. Policy:
   - **Drop any tag that restates the category.** It carries zero discriminating value against the category filter that already exists.
   - **Treat the category's high-frequency vocabulary tags as filler** and replace them with real content signal, unless a guide genuinely has nothing more specific to offer. The plan document records which tags those are for its category — that measurement is domain-specific and belongs there.
   - **Keep exactly one skill-level tag** (`fundamentals` / `practical` / `advanced`). That is a genuine navigation axis, not filler.
   - **Fill the remaining slots with the specific nouns a reader would type** if they remember *what* but not *where* — the actual services, patterns, products, or algorithms the guide covers, not the vocabulary-table generics. Cross-check against the guide's own description; if the description names something specific the tags don't, the tags are under-specified.
   - **Target 5-7 tags total** — replace low-value generic tags rather than appending specific ones on top.
   - **Review the description too**: confirm it still accurately reflects content after edits and isn't just a restatement of the title.

### Explicitly out of scope

Prerequisite callouts, "where this fits" framing, and inline links to sibling guides **within the same pass's scope**. The order in `assets/data/study_guides_config.json` already encodes the fundamentals-to-advanced reading path, so a guide should not add its own.

This applies retroactively: if a guide already has an inline link to a sibling in scope, remove it during this pass — keep the surrounding prose, drop the link or parenthetical. It does not apply to external links (vendor docs, third-party tools), which stay per normal inline-linking standards.

---

## Process

- **One guide at a time**, no parallel dispatch. The status column in the progress table is the single source of truth for where the pass is.
- **Per guide:** run the checklist, apply the fixes, run `/refine-prose`, set status to Complete, move to the next row. Don't stop for approval between rows. No Jekyll build — content-only edits don't break the build.
- **Never record what changed.** The progress table tracks status and nothing else, because the corrections are already in the diff and a per-guide changelog is dead weight. The only things that get written down are forward-looking:
  - a finding a *later, not-yet-done* row has to act on goes in **Open pre-flags**;
  - a fact that constrains every remaining guide goes in **Cross-guide facts in force**;
  - a claim left unverified on a finished guide goes in **Unverified, left standing**.

  Nothing else. Prune each entry when the row it targets is done.
- **Promote a gotcha when it stops being about one domain.** A lesson learned mid-pass starts in the plan's own gotchas section. When a second pass in a different domain would hit the same trap, move it here.

---

## Standing gotchas

Learned from completed passes. These hold regardless of domain.

### On the factual pass

- **The factual pass leaves no trace in a diff.** A guide whose tags, links, and diagrams look done has not necessarily had item 1 run on it. Status in the progress table, not the diff, is the record of whether item 1 ran.
- **A guide can document a feature that does not exist.** Most findings are stale numbers, wrong limits, or reversed claims — all of which start from something real. Some are pure invention: an entire subsection, with a config block and a characteristics list, for a capability the product has never had. The tell is that the docs never *mention* it, not that they contradict it. When verification returns *nothing* about a named feature rather than something different from what the guide says, that absence is the finding. Search for the setting or feature name itself before assuming the docs just cover it elsewhere.
- **Read every load-bearing hard number off the primary limits table.** A number can be invented rather than stale, and an invented one has no ancestor — so looking up the current value returns the right answer without ever signalling that the old one was fiction. Don't rely on "this looks like it drifted" as your trigger to check.
- **An archive redirect is the retirement notice.** Content retired by a vendor rarely announces its status in the prose of the page that replaced it; it announces it in the URL. When a fetch of a current-looking doc path comes back with a canonical URL under an archive or previous-versions prefix, the feature is retired regardless of how complete the content looks. The same goes for a *cross-product* redirect: a feature that moved from product A to product B usually moved to a different billing model and permission surface too, so a guide teaching it as a feature of A is wrong even where the mechanics still read correctly. **Check the canonical URL on every doc fetched for a feature the guide presents as current.**
- **Check which doc variant a claim came from.** Vendor docs are frequently pivoted — by version, by tier, by SKU, by deployment model — and two zones of the same page can describe architecturally different products. Confirm which pivot the claim came from. An FAQ often states a transition that the concept pages don't.
- **Verify code samples as claims, not as illustration.** Prose assertions are the obvious target of item 1, but the worst errors hide in code: a method overload that doesn't exist, a wrong entity API, a non-generic call assigned to a variable, a return-type mismatch. A sample that reads plausibly can still be uncompilable, and readers copy samples more literally than they follow prose. For any guide with code, check attribute names, method names, overload signatures, and return types against the current API reference.
- **A pre-flag is a lead, not a finding.** Re-verify every pre-flag against a source before acting on it. A pre-flag raised from a guide's own uncorrected prose propagates that guide's error into a second guide. When one turns out wrong, fix the guide that raised it too.

### On tables

- **A two-option comparison is a claim about how many options exist.** A "Standard vs Premium" table reads as complete because two-column tables look finished — even when the product now has three tiers, or the tiers have been renamed. Before refining any "X vs Y" table, confirm against the current tier or feature comparison page that the product still has exactly those options and that they are still called that.
- **A merged cell hides a fact.** When a table cell reads `X/Y` or names a category rather than a metric, check whether the vendor's own table splits it. Merging two SKUs into one row conceals that one half is retiring; merging two independent limits into one column conceals that they differ by an order of magnitude. The merge is usually where the stale or wrong number is hiding.
- **Verify the unmatched cells in a comparison table, not just the ones about your own subject.** A cell naming a competitor's capability with no counterpart on your side asserts an absence, whether or not the author meant it to. Item 1 hunts for missing depth on a covered topic; this is the opposite shape — a topic the table rules out before the body can reach it.

### On the refinement passes

- **Item 5 is a two-way check, not a filter.** The easy reading is to judge the diagrams already present, drop the decorative ones, and add nothing. That is half the check, and it lets a guide pass while every relationship it teaches stays in prose-and-table form. Ask both questions on every guide: does each existing diagram clear the bar, **and** does the guide explain a structure with no diagram? The second finds more than the first. Structures that qualify and are easy to miss: a control that enforces at two levels, two options whose traffic paths differ in shape rather than in attributes, and a topology whose behavior comes from routing rather than from the links drawn.
- **Sibling links hide in two forms.** Grepping `](/study-guides/` finds only markdown links; links inside HTML callout blocks use `<a href="/study-guides/...">` and will be missed. Check both. Some cross-references are also unlinked prose ("covered in the X guide") — those are "where this fits" framing and go too.
- **Run the linter even when the edit felt clean.** Heavy prose additions reliably introduce em-dashes and mis-ordered sections that are invisible while writing.

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

The plan's own version of the standing gotchas above: source quirks, endpoints that time out and their working substitutes, figures that are known not to be published anywhere citable, vocabulary traps. Anything here that a pass in a different domain would also hit should be promoted into this document instead.

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

**The checklist, the process rules, and the cross-domain gotchas live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md).** Read it first. This document carries only what is specific to this pass.

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
