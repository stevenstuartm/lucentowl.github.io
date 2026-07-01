# Resource Guide

This guide covers format requirements, organization, and quality standards for resources — standalone reference artifacts. Always also read [writing-standards.md](writing-standards.md) — the universal rules apply to resource content too.

---

## What a Resource Is

A resource is a self-contained visual or reference artifact — not prose, not a guide, not a post. The unit of value is the artifact itself: a table you screenshot, a diagram you reference in a PR, a cheatsheet you keep open in a tab. Readers glance at a resource; they don't read it front to back.

**Valid types**: `cheatsheet`, `diagram`, `table`, `chart`, `code`

If content requires sustained reading to understand — narrative explanation, reasoning through trade-offs, building up a concept step by step — it belongs in a study guide or blog post, not a resource.

---

## Format Requirements

**File location**: Place in `_resources/` — flat directory, no subdirectories. Resources are isolated artifacts, not a curriculum, so they don't need the category/subcategory nesting that guides use.

**Required front matter**:
```yaml
---
title: "Resource Title"
layout: resource
type: table
description: "Concise description of what this reference artifact contains"
last_updated: 2025-01-01
tags: [tag1, tag2, tag3]
related_guides:
  - /study-guides/some-guide.html
related_posts:
  - /blog/2025/01/01/some-post.html
---
```

**Required fields**: `title`, `layout`, `type`, `description`, `last_updated`, `tags`
**Optional fields**: `related_guides`, `related_posts` — arrays of site-relative URLs

- **type**: Must be one of the five valid types above. Drives the type badge and the listing page's type filter.
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

Resources have no category hierarchy. Type and tags are sufficient for filtering. When choosing tags, reuse the existing tag vocabulary from [study-guide-guide.md](study-guide-guide.md) where the concept overlaps (e.g., `distributed-systems`, `algorithms`, `security`) rather than inventing new tags for concepts that already have one.
