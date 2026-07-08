# Resource Guide

This guide covers format requirements, organization, and quality standards for resources — standalone reference artifacts. Always also read [writing-standards.md](../../skills/refine-prose/writing-standards.md) — the universal rules apply to resource content too.

---

## What a Resource Is

A resource is a self-contained visual or reference artifact — not prose, not a guide, not a post. The unit of value is the artifact itself: a table you screenshot, a diagram you reference in a PR, a cheatsheet you keep open in a tab. Readers glance at a resource; they don't read it front to back.

**Valid types**: `cheatsheet`, `reference`, `code`

- **`cheatsheet`**: Immediately actionable — used as-is, no interpretation required (git commands, HTTP status codes, keyboard shortcuts)
- **`reference`**: Information you internalize and then apply yourself in some deeper way (glossaries, comparisons, decision guides, conceptual lookups)
- **`code`**: Templates or code snippets meant to be copied into a project (ADR templates, skill definitions)

If content requires sustained reading to understand — narrative explanation, reasoning through trade-offs, building up a concept step by step — it belongs in a study guide or blog post, not a resource.

### The Lookup Test

Well-organized content is not automatically a resource candidate. A three-item quoted list ("The Core Laws of Software Architecture") can be memorable and well-formatted without being something anyone looks up independent of the guide it lives in. Before flagging something as a candidate, apply both filters:

- **Density**: Does it have enough data points to justify its own page? Count rows × meaningful comparison dimensions, not raw row count — a 2-row table compared across several dimensions (e.g., Scrum vs. Kanban across cadence, roles, WIP limits) is dense enough even with few rows, while a 3-item list of one-line statements (e.g., three quoted "laws") is thin even though it clears a raw item-count floor. Roughly 4+ data points is the practical floor.
- **Self-contained meaning**: Would someone search for or bookmark this independent of ever reading the source guide? "OWASP Top 10" passes — it's canonical, enumerable, and answers a "what/which/when" lookup question with no context required. "Core Laws of Software Architecture" fails — it's a "why" statement that only lands with the surrounding argument.

When auditing content for candidates, reject anything that fails either filter rather than flagging it as "Review." The goal is a short list of high-confidence extractions, not an index of every well-organized paragraph.

### Synthesis Candidates

Not every resource exists as a ready-made table. Some guides explain a set of parallel concepts in prose — one subsection per concept, same shape each time (a name, a definition, maybe a metric) — without ever presenting them together. That's still a resource candidate; it just needs compiling before it's extractable.

**How to recognize one**: look for a guide section broken into parallel subsections with a consistent shape — e.g., "Operational Characteristics," "Structural Characteristics," "Cloud-Specific Characteristics" each defining a handful of terms the same way. The parallelism itself is the signal: the author already organized these as a set, they just didn't table them.

**The test still applies to the output, not the source.** Don't ask "is this already a table?" — ask "if I compiled this into a table, would it pass the lookup test?" A guide with four sections defining 22 total characteristics compiles into a dense, self-contained glossary that clearly passes. A guide with one paragraph explaining a single concept doesn't get to become a resource just because you could technically put it in a two-cell table.

**Guardrails against overreach**:
- Only synthesize categorization the source actually uses (headers, explicit groupings). Don't invent a taxonomy the guide doesn't have.
- It's fine — often better — to pull in a second, non-adjacent section of the same guide if it answers the same lookup question (e.g., merging a "what does X mean" glossary with a separate "how do you measure X" section later in the same file). Readers looking up a concept want both.
- If compiling requires rewriting the author's explanations rather than just reformatting them, that's a sign this is guide content, not resource content — stop.

---

## Format Requirements

**File location**: Place in `_resources/` — flat directory, no subdirectories. Resources are isolated artifacts, not a curriculum, so the directory itself doesn't nest by category the way `_guides/` does — but each resource still declares a single top-level `category` in its front matter (see below) for filtering on the listing page.

**Required front matter**:
```yaml
---
title: "Resource Title"
layout: resource
type: reference
category: "Architecture"
description: "Concise description of what this reference artifact contains"
last_updated: 2025-01-01
tags: [tag1, tag2, tag3]
related_guides:
  - /study-guides/some-guide.html
related_posts:
  - /blog/2025/01/01/some-post.html
---
```

**Required fields**: `title`, `layout`, `type`, `category`, `description`, `last_updated`, `tags`
**Optional fields**: `related_guides`, `related_posts` — arrays of site-relative URLs

- **type**: Must be one of the three valid types above. Drives the type badge and the listing page's type filter.
- **category**: Must exactly match one of the top-level category names in `assets/data/study_guides_config.json` (e.g., `"Architecture"`, `"Security"`, `"Data Structures & Algorithms"`). Use the category of the study guide the resource is most closely tied to — usually the guide(s) in `related_guides`. Drives the listing page's category filter. If a resource has no natural related guide, pick the category that best matches its subject and tags.
- **last_updated**: Date the resource content was last substantively edited (`YYYY-MM-DD`, unquoted). Update this whenever you revise a resource's content — it renders on both the resource page and its listing card.
- **description**: A 1-2 sentence summary of what the artifact contains. Write it to stand alone in a listing card.

---

## CRITICAL: Update the Configuration File

When adding or removing a resource, ALWAYS update `assets/data/resources_config.json`. This file controls both which resources appear on the listing page and their display order. A resource that exists in `_resources/` but isn't listed here will not be discoverable on the website.

**Standard procedure for adding a new resource**:
1. Create the markdown file in `_resources/`
2. Include complete YAML front matter (title, layout, type, description, last_updated, tags)
3. **Immediately update** `assets/data/resources_config.json` — add the filename to the `resources` array in the position where it should appear
4. Test locally to verify the resource appears on the resources listing page

Always modify both the resource file and the config file together.

---

## CRITICAL: Never Rename Files

- NEVER rename resource files (`_resources/*.md`)
- NEVER use `git mv` or any other method to rename them
- If the title changes, update only the `title:` field in the front matter
- **Rationale**: File renames break external links, analytics, bookmarks, and SEO — same rule as posts and guides

---

## Relationship Ownership

`related_guides` and `related_posts` are declared on the resource — never on the guide or post being linked to. This means adding a resource never requires editing existing content files.

- If a resource was extracted from a guide or post, link back to that source via `related_guides` or `related_posts`
- Only link to content that actually exists — verify the URL resolves before adding it
- A resource doesn't need either field; leave them out if there's no natural source to point back to

---

## Content Quality Standards

**Extract, don't duplicate prose**: A resource should be the table, cheatsheet, or diagram itself — not a rewritten summary of a guide's argument. If the source material is prose (e.g., paragraphs explaining a trade-off), synthesize it into the artifact form (a table, a decision list) rather than porting the prose over.

**No narrative framing**: Skip introductions that build context or motivate the reader. A one-line description in the front matter and a short lead-in sentence (if needed to orient the table/diagram) is enough. The artifact should be usable within seconds of landing on the page.

**Self-contained**: A reader should get full value from the resource without needing to open the related guide or post. `related_guides`/`related_posts` are for readers who want to go deeper — not a requirement to understand the resource itself.

**Code resources**: Follow the same code language defaults as guides and posts — default to C# for programming examples unless the subject is language-specific (e.g., a Claude Code skill, a shell script, a Terraform snippet).

---

## Organization

Resources have no subcategory hierarchy — just a single top-level `category` (matching the study guide categories) plus type and tags for filtering. When choosing tags, reuse the existing tag vocabulary from [study-guide-guide.md](study-guide-guide.md) where the concept overlaps (e.g., `distributed-systems`, `algorithms`, `security`) rather than inventing new tags for concepts that already have one.
