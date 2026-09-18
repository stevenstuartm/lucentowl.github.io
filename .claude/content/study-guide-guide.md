# Study Guide Guide

This guide covers format requirements, tagging, organization, and quality standards for study guides, plus the workflow for writing a new one and the quality checklist every guide must pass. Always also read [writing-standards.md](../skills/refine-prose/writing-standards.md) — the universal rules apply to all guide content.

The [Quality Checklist](#quality-checklist) and [Standing Gotchas](#standing-gotchas) below are shared with [`guide-refinement-standard.md`](guide-refinement-standard.md). A new guide passes them before it is handed over, so it never needs a first refinement round; the refinement standard exists for re-checking existing guides as sources drift.

---

## Format Requirements

**File location**: Place in `_guides/` organized by category subdirectory (e.g., `_guides/architecture/`, `_guides/dsa/`).

**Required front matter**:
```yaml
---
title: "Guide Title"
layout: guide
category: Main Category
subcategory: Subcategory
description: "Brief description of the guide content"
tags: [tag1, tag2, tag3, tag4, tag5]
---
```

**Important**: Tables in Markdown must have a blank line before them to render correctly in Jekyll/Kramdown.

---

## CRITICAL: Update the Configuration File

When adding or removing study guide files, ALWAYS update `assets/data/study_guides_config.json`. This file controls which guides appear on the study guides listing page. A guide that exists in `_guides/` but isn't listed in this file will not be discoverable on the website.

**Standard procedure for adding a new study guide**:
1. Create the markdown file in `_guides/` (organized by category subdirectory)
2. Include proper YAML front matter with category, subcategory, description, and tags
3. **Immediately update** `assets/data/study_guides_config.json`:
   - Add new subcategory if needed (with name and description)
   - Add the guide filename to the appropriate subcategory's `guides` array, at its place in the reading order
4. Confirm the config still parses and the path exists

**Example configuration entry**:
```json
{
  "name": "Business & Economics",
  "description": "Cost analysis, ROI, and financial aspects of architecture",
  "guides": [
    "tco-roi.md"
  ]
}
```

Always modify both the guide file and the config file together.

---

## Tagging System

Tags are free-form: `content-filter.js` and `guides-browser.js` read them straight off front matter, with no fixed enum. Nothing technical keeps them from going generic, and the default failure is a set of tags so common within the category that none of them discriminate.

**Tag format**: lowercase, hyphenated (e.g., `decision-making`, `cost-analysis`), as a YAML array.

**Policy**:
- **Target 5-7 tags.** Replace a low-value generic tag with a specific one rather than appending on top.
- **Keep exactly one skill-level tag** (`fundamentals` / `practical` / `advanced`). That is a genuine navigation axis.
- **Never use a tag that restates the category.** An `ai` tag on a guide in AI & Machine Learning carries no value against the category filter that already exists.
- **Fill the remaining slots with the specific nouns a reader would type** if they remember *what* but not *where*: the actual services, patterns, products, or algorithms the guide covers. Cross-check against the description; if the description names something specific the tags don't, the tags are under-specified.
- **Use the cross-cutting tags below only where they carry real signal** across categories, not as filler. Tags that are high-frequency within the category are filler there.

**Cross-cutting tags** (reuse these spellings rather than inventing synonyms):

| Category | Tags |
| --- | --- |
| Core Disciplines | `architecture`, `algorithms`, `data-structures`, `security`, `design-patterns`, `distributed-systems`, `infrastructure`, `cloud-computing`, `databases`, `networking`, `testing`, `devops` |
| Skill Levels | `fundamentals`, `advanced`, `practical` |
| Application Contexts | `performance`, `scalability`, `reliability`, `maintainability`, `observability` |
| Specific Technologies | `aws`, `microservices`, `kubernetes`, `oop`, `functional-programming`, `cicd`, `terraform`, `cloudformation` |
| Business & Process | `cost-analysis`, `decision-making`, `governance`, `leadership`, `collaboration`, `sdlc`, `agile`, `modeling`, `threat-modeling` |
| Common Concepts | `statistics`, `analytics`, `hypothesis-testing`, `messaging`, `consistency`, `resilience`, `legacy-systems`, `modernization`, `risk-management`, `workflow`, `transactions`, `caching`, `rate-limiting`, `deployment`, `consensus`, `coordination`, `integration`, `automation`, `documentation`, `complexity-analysis` |

**Review the description with the tags**: it should reflect the final content and not just restate the title.

---

## Content Philosophy

**Focus on actionable knowledge over reference material**:
- Avoid generic "Further Reading" sections with book lists and external links
- Avoid template sections with fill-in-the-blank structures (readers can create their own)
- Avoid extensive checklists that become reference cards rather than learning material
- DO NOT add "Resources" sections unless explicitly requested by the user
- DO NOT add "Next Steps" sections — study guides should be self-contained
- Links to tools/frameworks should be inline where mentioned, not collected in a separate section

**Do include**:
- Core concepts, definitions, and formulas
- Decision frameworks and comparison models
- Real-world examples that demonstrate practical application
- Common pitfalls and how to avoid them
- Best practices derived from experience
- Key takeaways that summarize actionable insights
- Inline links using `{:target="_blank" rel="noopener noreferrer"}` for external resources when mentioned

Readers should learn things they didn't know and understand what they can do with that knowledge, without being overwhelmed by supplementary reference material. Study guides must be effective on their own.

---

## Content Quality Standards

**Explain before prescribing**:
- Always provide substantive explanations of what concepts, frameworks, and tools actually ARE before describing when/how to use them
- Don't jump straight to "When to use" without first explaining the fundamentals
- Readers need to understand the subject matter before they can make informed decisions about applying it
- When documenting a framework, explain its structure, components, and how it works BEFORE listing use cases

**Link inline, not in separate sections**:
- If you reference a specific tool, framework, organization, website, or resource in the content, provide an inline link where it's mentioned
- Use descriptive link text so readers know what they're clicking on
- Format: `[Tool Name](https://example.com){:target="_blank" rel="noopener noreferrer"}`
- Do NOT create separate "Resources" or "Further Reading" sections
- Do NOT link to sibling guides in the same subcategory or add "where this fits" framing; see [Explicitly out of scope](#explicitly-out-of-scope)

**Concepts over code syntax**:
- Unless the guide's topic is directly coupled to code, remain conceptual
- Avoid CLI examples, API syntax, or implementation code that rapidly becomes outdated
- Focus on the WHY and WHEN, not the exact HOW
- Describe operations conceptually (e.g., "use the CLI to create a change set")
- Link to official documentation inline where relevant for current syntax
- Exception: Include code when the guide teaches coding concepts (algorithms, design patterns, language features)

---

## Writing a New Guide

A drafted guide is plausible, unverified text, which is exactly what the quality checklist exists to catch. The workflow separates writing from testing and hands the testing to a reviewer who did not write the draft, because an author re-reading their own prose confirms what they meant rather than what they wrote.

### 1. Scope gate (before any prose)

State the guide's reader question in one sentence and run it through [What earns a guide its place](#what-earns-a-guide-its-place). When writing more than one related guide, also draft a topic ownership map (`Concept | Owner | Non-owners treat it as`) so no two guides teach the same concept, and check it against existing guides that already own neighboring concepts.

**Gate:** present the reader question(s), the ownership map if any, the proposed subcategory and reading position, and the primary sources you will draft from. Nothing is written before approval.

### 2. Research before drafting

Draft from primary sources (vendor or project docs, specs, the author's own writing), not from memory. Memory is where invented features and invented numbers come from. Fast-moving tools get concept-level guides; command syntax belongs in a `_resources/` cheatsheet (see the [resource guide](resource-guide.md)).

### 3. Draft

Write the guide, front matter, and config entry following this document. Wrap the body in `{% raw %}` / `{% endraw %}` if it contains any `{{` or `{%`.

### 4. Independent review

Dispatch a fresh subagent (`general-purpose`, since it needs web access) with the brief below. The reviewer reports; the author fixes. Keeping the fixes with the author means the reviewer never grades its own edits.

**Reviewer brief** (fill in the brackets):

```
You are reviewing a newly drafted study guide before publication. You did not write it; treat every claim as unverified.

Guide: [path]
Reader question: [one sentence]
Primary sources: [list]
Ownership map (if any): [table, or "none"]

Read .claude/content/study-guide-guide.md (the Quality Checklist and Standing Gotchas sections are your checklist) and .claude/skills/refine-prose/writing-standards.md. Then:

1. Item 1 first. List every falsifiable claim, hard number, absolute, code sample, and "X vs Y" table in the guide. Verify each against a primary source with web research. For every named feature, confirm the source actually mentions it; absence is a finding.
2. Run items 2-9 against the guide as written.
3. Do not edit the file.

Report, most severe first:
- Factual errors: quote, what the source says, source URL.
- Unverifiable claims: quote, and what could be verified instead.
- Missing material a practitioner would expect given the reader question.
- Findings for items 2-9, each with the section it applies to.
- A verdict: "ready" only if there are no factual errors and no missing material.
```

### 5. Fix and re-review

Apply the findings, re-checking any that look wrong against the source rather than taking them on trust. Soften any claim that cannot be verified to what can be. If the fixes corrected facts or added material, dispatch a new reviewer on the revised guide; stop when a round returns "ready". After three rounds without "ready," stop and bring the open findings to the user.

### 6. Mechanical checks

- `/refine-prose` until clean
- Config parses, the path exists, and front-matter `category`/`subcategory` match the config exactly
- No `{{` or `{%` outside a raw block
- No sibling links in either form (`](/study-guides/` and `<a href="/study-guides/`)
- Tag policy holds

### Done

The guide is done when the last review returned "ready" and the mechanical checks pass. This is the same bar as `Complete` in the refinement standard. When handing it over, report any claims that were softened because they could not be verified; there is no plan document to record them in.

---

## What Earns a Guide Its Place

Apply these tests to a candidate new guide at the scope gate, and to every existing guide during a refinement pass's consolidation phase.

1. **One reader question.** State in one sentence what a reader comes to this guide to learn. If two guides give the same answer, merge them. If one guide needs two unrelated sentences, split it.
2. **Learning content, not lookup.** Apply the Lookup Test from [`resource-guide.md`](resource-guide.md). Material a reader consults rather than learns from, such as templates, worked pipelines, and selection tables, belongs in `_resources/`.
3. **Durable substance.** A guide whose core is a list of products, tools, model names, versions, or specs goes stale faster than anyone updates it. Keep its durable reasoning and fold that into a concept guide. Drop the list.
4. **Right category.** A topic another category already owns stays there. Guides may link to guides in other categories, but they don't re-teach them.
5. **Gap test.** A new guide qualifies only if a practitioner in the domain would expect the category to cover it, no existing guide owns it, and folding it into an existing guide would break that guide's one-reader-question test. Judge at study-guide altitude, not doc-completeness.
6. **Subcategory shape.** Avoid single-guide subcategories. The subcategory split should follow a real difference in reader intent, not just group guides into topic buckets.

---

## Quality Checklist

Every guide passes this checklist, whether newly written or under refinement.

**Order of operations:** run item 1 (correctness and completeness) **first** — it is the only pass that adds or rewrites content, and every later check has to operate on the corrected text, not the original. Items 2-7 then refine that content. The two front-matter items (8 and 9) run last so they confirm tags and description against the final content.

1. **Factual correctness and completeness (verify against authoritative sources) — do this first.** Distinct from item 3's *pedagogical* gaps: this checks whether the guide's technical claims are actually true and current, and whether a materially important part of the topic is missing — not treating the prose as given. Web-research the guide's falsifiable claims against its authoritative sources (named in the plan document during a refinement pass): service limits, naming and character constraints, defaults, support matrices, feature availability and release/preview status, tier and pricing boundaries, and any hard number or absolute ("max 24 characters", "not supported", "always inherits", "only in the same region"). Prioritize claims that are (a) falsifiable, (b) consequential if a reader acts on them, or (c) prone to drift as the product evolves — don't spend the pass rubber-stamping prose that merely reads plausibly, and don't try to re-verify inherently stable conceptual framing. Correct stale or wrong content in place. Where a claim can't be confirmed against a source, soften it to what's verifiable rather than leaving an unverified absolute in place. **Completeness is judged at study-guide altitude, not doc-completeness** — flag only a missing piece a practitioner would reasonably expect given the guide's stated scope and description, not every edge case. Because this pass can add or modify content, run the remaining checks over whatever it produces.
2. **Redundancy** — same fact, table, or explanation repeated across sections; consolidate or cross-reference within the same file. Where an ownership map exists, a guide that doesn't own a concept doesn't re-teach it.
3. **Gaps** — missing explanation of a concept before it's prescribed; missing trade-offs; missing "why would I not use this." (Pedagogical completeness — whether concepts are introduced in a learnable order — as opposed to item 1's factual completeness.)
4. **Clarity** — dense prose that a comparison table or list would serve better; inconsistent structure vs. the guide's own sections.
5. **ASCII diagrams** — reserve for genuinely technical relationships and flows: network topology, request or traffic flow, data flow between components, reconciliation loops, hub-and-spoke topologies, auth and token exchange sequences. The bar is whether it depicts actual structure (branching, parallel components, directional flow between distinct systems) that prose or a table can't already convey cleanly. Do **not** use a diagram to dress up a linear conceptual hierarchy, a scope or abstraction ladder, or anything that's really just a sequential list with arrows between prose labels — that's not practical output, it's decoration. If a sentence already says it clearly, don't diagram it. Skip where a table already conveys the comparison clearly.
6. **Decision trees** — where a guide has 2+ comparison tables that all feed into "which option do I pick," consider consolidating into one ASCII decision tree.
7. **Hierarchy and scope clarity.** When a guide introduces a resource or concept whose behavior or constraints depend on where it sits in the domain's containment hierarchy, state that scope explicitly and early rather than leaving the reader to infer it from a buried constraint bullet. The tell is a constraint bullet that only makes sense if you already know the scope — a line like "all members must be in the same VNet" tells a reader who already knows the answer, and tells nobody else. Apply this only where scope is genuinely ambiguous or consequential for how the reader would design or deploy something, not as boilerplate on every resource mentioned.
8. Confirm front matter (tags, description) still matches content after edits.
9. **Front matter tag audit** against the [Tagging System](#tagging-system) policy. Which tags count as filler is measured per category: during a refinement pass the plan document records it; for a new guide, count tag frequency across the guide's category before choosing.

### Explicitly out of scope

Prerequisite callouts, "where this fits" framing, and inline links to sibling guides in the same subcategory (or, during a refinement pass, within the pass's scope). The order in `assets/data/study_guides_config.json` already encodes the fundamentals-to-advanced reading path, so a guide should not add its own.

This applies retroactively: if a guide already has an inline link to such a sibling, remove it — keep the surrounding prose, drop the link or parenthetical. It does not apply to external links (vendor docs, third-party tools), which stay per normal inline-linking standards.

---

## Standing Gotchas

Learned from completed passes. These hold regardless of domain, and they apply as much to writing a guide as to refining one.

### On the factual pass

- **A guide can document a feature that does not exist.** Most findings are stale numbers, wrong limits, or reversed claims — all of which start from something real. Some are pure invention: an entire subsection, with a config block and a characteristics list, for a capability the product has never had. The tell is that the docs never *mention* it, not that they contradict it. When verification returns *nothing* about a named feature rather than something different from what the guide says, that absence is the finding. Search for the setting or feature name itself before assuming the docs just cover it elsewhere.
- **Read every load-bearing hard number off the primary limits table.** A number can be invented rather than stale, and an invented one has no ancestor — so looking up the current value returns the right answer without ever signalling that the old one was fiction. Don't rely on "this looks like it drifted" as your trigger to check.
- **An archive redirect is the retirement notice.** Content retired by a vendor rarely announces its status in the prose of the page that replaced it; it announces it in the URL. When a fetch of a current-looking doc path comes back with a canonical URL under an archive or previous-versions prefix, the feature is retired regardless of how complete the content looks. The same goes for a *cross-product* redirect: a feature that moved from product A to product B usually moved to a different billing model and permission surface too, so a guide teaching it as a feature of A is wrong even where the mechanics still read correctly. **Check the canonical URL on every doc fetched for a feature the guide presents as current.**
- **Check which doc variant a claim came from.** Vendor docs are frequently pivoted — by version, by tier, by SKU, by deployment model — and two zones of the same page can describe architecturally different products. Confirm which pivot the claim came from. An FAQ often states a transition that the concept pages don't.
- **Verify code samples as claims, not as illustration.** Prose assertions are the obvious target of item 1, but the worst errors hide in code: a method overload that doesn't exist, a wrong entity API, a non-generic call assigned to a variable, a return-type mismatch. A sample that reads plausibly can still be uncompilable, and readers copy samples more literally than they follow prose. For any guide with code, check attribute names, method names, overload signatures, and return types against the current API reference.

### On tables

- **A two-option comparison is a claim about how many options exist.** A "Standard vs Premium" table reads as complete because two-column tables look finished — even when the product now has three tiers, or the tiers have been renamed. Before writing or refining any "X vs Y" table, confirm against the current tier or feature comparison page that the product still has exactly those options and that they are still called that.
- **A merged cell hides a fact.** When a table cell reads `X/Y` or names a category rather than a metric, check whether the vendor's own table splits it. Merging two SKUs into one row conceals that one half is retiring; merging two independent limits into one column conceals that they differ by an order of magnitude. The merge is usually where the stale or wrong number is hiding.
- **Verify the unmatched cells in a comparison table, not just the ones about your own subject.** A cell naming a competitor's capability with no counterpart on your side asserts an absence, whether or not the author meant it to. Item 1 hunts for missing depth on a covered topic; this is the opposite shape — a topic the table rules out before the body can reach it.

### On the refinement items

- **Item 5 is a two-way check, not a filter.** The easy reading is to judge the diagrams already present, drop the decorative ones, and add nothing. That is half the check, and it lets a guide pass while every relationship it teaches stays in prose-and-table form. Ask both questions on every guide: does each existing diagram clear the bar, **and** does the guide explain a structure with no diagram? The second finds more than the first. Structures that qualify and are easy to miss: a control that enforces at two levels, two options whose traffic paths differ in shape rather than in attributes, and a topology whose behavior comes from routing rather than from the links drawn.
- **Sibling links hide in two forms.** Grepping `](/study-guides/` finds only markdown links; links inside HTML callout blocks use `<a href="/study-guides/...">` and will be missed. Check both. Some cross-references are also unlinked prose ("covered in the X guide") — those are "where this fits" framing and go too.
- **Run the linter even when the edit felt clean.** Heavy prose additions reliably introduce em-dashes and mis-ordered sections that are invisible while writing.

---

## Architecture Terminology Standards

When writing about software architecture, use correct terminology:

**Architectural Characteristics (NOT "Non-Functional Requirements")**:
- Correct term: **Architectural Characteristics**
- Also acceptable: Quality attributes, "-ilities"
- ❌ Avoid: "Non-functional requirements" (outdated term)
- Reference: [Architecture Characteristics](/study-guides/architecture/architecture-characteristics.html)

**Selection process**:
1. Identify 7 characteristics critical to the project's success
2. Prioritize the top 3 — these drive architecture style selection
3. Use structured worksheets: [Developer to Architect Worksheets](https://developertoarchitect.com/downloads/worksheets.html){:target="_blank" rel="noopener noreferrer"}

**Characteristics must meet three criteria**:
- Specify non-domain consideration
- Influence structural design
- Be critical to success

**Common categories**:

| Category | Examples |
| --- | --- |
| Operational | Availability, Performance, Scalability, Reliability, Recoverability |
| Structural | Maintainability, Extensibility, Portability, Upgradeability |
| Cross-Cutting | Security, Privacy, Supportability, Accessibility |

**When writing AAA Phase 2 (Agree) content**:
- List "Architectural Characteristics" as the FIRST design decision
- Emphasize that the top 3 characteristics drive the architecture style choice
- Reference the worksheets for systematic evaluation
- Link to the Architecture Characteristics guide for detailed explanations

---

## Organization Patterns

**Existing category structure**:

| Category | Subcategories |
| --- | --- |
| Architecture | Foundations, Styles, Patterns, Design, Modeling, Quality & Risk, Governance, Business & Economics |
| Data Structures & Algorithms | Fundamentals, Linear Data Structures, Trees & Heaps, Graphs, Hash Tables & Algorithms |
| Object-Oriented Programming | OOP Foundations, Design Patterns |
| Security | Security Fundamentals, Threats & Defense, Application Security, Governance & Response |
| Software Development Lifecycle | SDLC & Modeling |
| AI & Machine Learning | Machine Learning, Building with LLMs, AI in Engineering Practice |
| Data & Analytics | Analytics |
| Observability | Monitoring & Observability |
| Networking | Network Fundamentals |
| Web Development | SEO & Web |

**File organization conventions**:
- Architecture guides: `_guides/architecture/`
- DSA guides: `_guides/dsa/`
- OOP guides: `_guides/oop/`
- Security guides: `_guides/security/`
- SDLC guides: `_guides/sdlc/`
- AI & ML guides: `_guides/ai/`
- Top-level guides (observability, networking, etc.): `_guides/`

**When to create new subcategories**:
- Group related guides under a coherent theme
- Subcategory should have a clear, descriptive name and purpose
- Include a helpful description that explains the content scope
- Consider whether the subcategory will have multiple guides (avoid single-guide subcategories unless it's a starting point for planned expansion)
