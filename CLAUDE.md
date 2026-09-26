# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Content Writing Standards

**Before writing or reviewing any site content**, read the relevant guide in `.claude/content/`:

| Guide | When to use |
| --- | --- |
| [`writing-standards.md`](.claude/skills/refine-prose/writing-standards.md) | **Always** — universal linter rules, voice, flow, punctuation, bullet point usage |
| [`blog-post-guide.md`](.claude/content/blog-post-guide.md) | Writing or editing blog posts, creating social media summaries |
| [`study-guide-guide.md`](.claude/content/study-guide-guide.md) | Writing or editing study guides — format, tagging, organization, the new-guide workflow (scope gate, independent subagent review, definition of done), and the Quality Checklist shared with refinement |
| [`resource-guide.md`](.claude/content/resource-guide.md) | Writing or editing resources — format, cross-linking, quality standards |
| [`domain-map-guide.md`](.claude/content/domain-map-guide.md) | Writing or editing a domain component map — the resource recording how a domain's components wire together |
| [`learning-path-guide.md`](.claude/content/learning-path-guide.md) | Writing or editing a learning path — what qualifies, the front matter format, "why" lines, isolation, validation |
| [`figure-guide.md`](.claude/content/figure-guide.md) | Drawing a diagram as a figure, composing figures into a composite resource, or embedding one in a guide |
| [`derivation-check.md`](.claude/content/derivation-check.md) | Checking any content for borrowed form: scores, grids, coined terms, or counted taxonomies that trace to one source without naming it. Runs as Quality Checklist item 10, in `guide-reviewer`, and in `/review-publishable` |
| [`guide-presentation-standard.md`](.claude/content/guide-presentation-standard.md) | Cheap refinement of existing guides — form, tone, prose, tables, diagrams, tags — without re-verifying facts. Use when a standard changed or a guide reads badly |
| [`guide-refinement-standard.md`](.claude/content/guide-refinement-standard.md) | Depth refinement of a block of study guides — factual verification, gaps, consolidation (Phase 0), the plan doc in `_drafts/`. Runs the presentation standard as its last step. Use when facts may be stale or the guide set is rough |

### Content pipeline

Blog post drafts move through three stages, in order. Each assumes the previous one is done.

| Stage | Command | Operates on | Output |
| --- | --- | --- | --- |
| Shape | `/shape-post-draft` | Raw or half-formed drafts | Restructures the draft, marks new argument `PROPOSED`, plus a plan doc |
| Refine | `/refine-prose` | A draft whose argument has settled | Lints to clean, then narrative self-review |
| Review | `/review-publishable` | A draft ready for final scrutiny | Full report, then a resolution pass that applies every finding to the file |

`/shape-post-draft` is a **gate**. A draft should not reach `/refine-prose` until its argument has stopped moving, because polishing prose on an argument that is about to be restructured is wasted work, and polished prose disguises structural defects. Skip it only for drafts that already know what they argue. A draft it has touched is not ready for `/refine-prose` until every `PROPOSED` marker in it is resolved.

`/refine-prose` lints to a clean state and does a narrative self-review the linter can't do. The skill and its bundled linter script live in `.claude/skills/refine-prose/`.

---

## Project Overview

This is a Jekyll-based GitHub Pages site for **Lucent Owl** (`lucentowl.com`) — a dev-focused tech publishing platform covering software architecture, system design, and engineering practice. The site is deployed directly to GitHub Pages.

## Development Commands

### Local Development
```bash
# Install dependencies
bundle install

# Run local development server (usually port 4000)
bundle exec jekyll serve

# Build the site (output to _site/)
bundle exec jekyll build

# Build the search index into _site/pagefind/ (after a build; see Site Search)
npx -y pagefind@1.5.2 --site _site
```

`jekyll serve` does not reload `_config.yml`. Restart it after changing collections, defaults, or any other config, or pages that depend on the change render as if it never happened.

### Dependency Pinning

Gems, Ruby, npm tools, and browser JS never upgrade without an intentional edit. GitHub's own actions are the deliberate exception:
- **Gems:** `Gemfile.lock` is committed and is the pin; CI installs from it and refuses anything else. It lists both `x64-mingw-ucrt` and `x86_64-linux`. The `Gemfile` states acceptable ranges, not exact versions (except `github-pages`, which fixes the whole Jekyll stack).
- **Ruby:** CI's `ruby-version` in `.github/workflows/jekyll.yml` must satisfy the locked gems. It need not match your local patch version.
- **GitHub Actions:** GitHub's own `actions/*` use major tags (`@v4`) so they receive security and runtime fixes. Third-party actions (`ruby/setup-ruby`) are pinned to a commit SHA with the tag in a trailing comment.
- **npm tools (via `npx`):** `package@x.y.z`, never a range or `latest`, in the workflow and in documented commands.
- **Browser JS:** vendored into `assets/js/` with the version in the filename or header (D3 is `d3.v7.min.js`, v7.9.0), never loaded from a CDN.

To upgrade, change the pin deliberately, run `bundle update <gem>` or `bundle lock` (or update the SHA/version), and build locally before pushing.

## Architecture

### Jekyll Structure
- **_config.yml**: Site configuration, author info, social links, and build settings. Sets `data_dir: assets/data`, so `site.data` reads from `assets/data/`, not `_data/`
- **_layouts/**: HTML templates that wrap content
  - `default.html`: Base template with header/footer includes
  - `home.html`: Homepage layout (extends default). Education first: hero, "four ways to learn" cards with live counts, a slim "Start with a goal" band linking the first four learning paths, then `featured_items` from `index.md` as a secondary section
  - `post.html`: Blog post template with metadata, tags, and author byline
  - `page.html`: Generic page template
  - `radar.html`: Tech radar page template with D3.js visualization
  - `guide.html`: Study guide template with table of contents
  - `guides.html`: Study guides listing page template
  - `blog-listing.html`: Blog listing page template
  - `author.html`: Author page template (avatar, bio, social links, post list)
  - `case-study.html`: Case study template with author byline
  - `learning-path.html`: One learning path, rendered from its front matter
  - `learning-paths.html`: Learning paths listing page template
- **_includes/**: Reusable HTML partials (header.html, footer.html, related-links.html, related-pill.html, post-sources.html, figure.html, search-panel.html)
- **_posts/**: Blog posts in Markdown with YAML front matter (format: YYYY-MM-DD-title.md)
- **_guides/**: Study guides in Markdown organized by topic
- **_learning_paths/**: Learning paths, one file per path, all data in front matter (see Learning Paths)
- **_figures/**: Diagram building blocks (`output: false`, no pages of their own), composed into guides and composite resources by `_includes/figure.html`
- **_site/**: Generated static site (excluded from git)
- **pages/**: Site pages (blog, about, tech-radar, study-guides, authors/)
- **assets/**: Static assets
  - `css/main.css`: Custom stylesheets with CSS variables for theming
  - `js/`: JavaScript files including D3.js and radar visualization
  - `data/radar-data.json`: Tech radar data (quadrants, rings, entries)
  - `img/`: Images and favicon

### Content Files
- **index.md**: Homepage content (uses home layout)
- **pages/blog.md**: Blog listing page
- **pages/about.md**: About Lucent Owl page
- **pages/tech-radar.md**: Interactive tech radar visualization (uses radar layout)
- **pages/study-guides.md**: Study guides listing page
- **pages/authors/steven-stuart.md**: Author page (layout: author)

### Author System
- **`assets/data/authors.yml`**: Author records (name, bio, avatar, social links)
- **`_layouts/author.html`**: Author page template — avatar, bio, social links, post list
- **`_includes/author-byline.html`**: Compact byline for post/case-study headers
- **`_includes/social-links.html`**: Author-scoped; requires `author` param, reads from `assets/data/authors.yml`
- Social links appear **only on author pages** — never in the global header or footer
- All posts and case studies are auto-attributed via `_config.yml` defaults (`author: steven-stuart`)

### Permalinks
- Posts use the permalink structure: `/blog/:year/:month/:day/:title.html`
- Study guides use the permalink structure: `/study-guides/:path.html`

**Important for SEO**: All URLs end with `.html` extension. When generating blog post URLs, always include the `.html` suffix.

### Blog Post Format

All blog posts must:
- Be placed in `_posts/` with filename format `YYYY-MM-DD-title.md`
- Include YAML front matter with: layout, title, date, description, and tags
- Use `layout: post` (set by default in config)

```yaml
---
layout: post
title: "Your Post Title"
date: 2025-09-29
description: "Concise summary that captures the core thesis and key points of the post"
tags: [architecture, design-patterns]
---
```

**All links go in `sources`, never the body.** Posts name each source in prose and list its URL, external or site-relative, under an optional `sources:` front matter array (`title`, `url`), rendered at the bottom by `_includes/post-sources.html`. This keeps the body link-free for syndication. See [`.claude/content/blog-post-guide.md`](.claude/content/blog-post-guide.md).

**CRITICAL: NEVER rename files**:
- ❌ NEVER rename blog post files (`_posts/*.md`) or any other content files
- ❌ NEVER use `git mv` or any other method to rename files
- The filename format `YYYY-MM-DD-title.md` is permanent once created
- If the title changes, update only the `title:` field in the front matter
- **Rationale**: File renames break external links, analytics, bookmarks, and SEO
- This rule is non-negotiable and applies to all content files (posts, guides, pages)

For writing standards, required fields detail, and social media summaries, see [`.claude/content/blog-post-guide.md`](.claude/content/blog-post-guide.md).

### Study Guide Format

All study guides must:
- Be placed in `_guides/` (organized in subdirectories by topic)
- Include YAML front matter with: layout, title, category, subcategory, description, and tags
- Use `layout: guide`

```yaml
---
title: "Guide Title"
layout: guide
category: Main Category
subcategory: Subcategory
description: "Brief description of the guide content"
tags: [tag1, tag2, tag3, tag4]
---
```

**CRITICAL: Always update `assets/data/study_guides_config.json`** when adding or removing guides. Guides that exist in `_guides/` but aren't listed in this config file will not appear on the website. Always modify both files together.

**CRITICAL: `category` and `subcategory` must match the config exactly.** The config is the source of truth — the study guides listing renders from it, so a guide with drifted front matter still appears in the right place and the mismatch stays invisible until something reads the front matter. Match the strings character for character, including `&` vs `and`. When you rename a subcategory in the config, update every guide it contains in the same pass.

When recategorizing a guide, change it in three places together: the file's `category`/`subcategory` front matter, its entry in the config, and — if the file moves directories — every internal link pointing at its old URL (`grep -rn "study-guides/<old-path>"`).

For format details, tag vocabulary, configuration requirements, organization patterns, and quality standards, see [`.claude/content/study-guide-guide.md`](.claude/content/study-guide-guide.md).

### Resource Format

Resources are standalone reference artifacts (cheatsheets, reference material, code) — not long-form learning content.

All resources must:
- Be placed in `_resources/` (flat directory — no subdirectories)
- Include YAML front matter with: layout, title, type, category, description, last_updated, and tags
- Use `layout: resource`

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
related_case_studies:
  - /case-studies/some-case-study.html
related_posts:
  - /blog/2025/01/01/some-post.html
---
```

**Valid types:** `cheatsheet`, `reference`, `code`

- `cheatsheet`: immediately actionable — used as-is, no interpretation required (git commands, HTTP status codes)
- `reference`: information you internalize and apply yourself in some deeper way (glossaries, comparisons, decision guides)
- `code`: templates or code snippets meant to be copied into a project

**`category`**: must exactly match one of the top-level category names in `assets/data/study_guides_config.json` (e.g., `"Architecture"`, `"Security"`). Drives the category filter on the Resources listing page — use the category of the guide(s) in `related_guides`, or the closest topical fit if there is no related guide.

**`last_updated`**: date the resource content was last substantively edited (`YYYY-MM-DD`, unquoted). Update this whenever you revise an existing resource's content. It renders on the resource page and on its listing card.

**Optional fields:** `related_guides`, `related_case_studies`, and `related_posts` — arrays of site-relative URLs. Titles are resolved automatically from Jekyll's `site.guides`, `site.case_studies`, and `site.posts` collections at build time.

**CRITICAL: Always update `assets/data/resources_config.json`** when adding or removing resources. Resources that exist in `_resources/` but aren't listed in this config file will not appear on the Resources listing page. The config controls display order.

```json
{
  "resources": [
    "my-resource.md"
  ]
}
```

**Permalinks:** `/resources/<filename>.html` (no category prefix — flat structure)

**NEVER rename resource files** — same rule as posts and guides.

The `related_*` fields are declared on the resource, never on the guide, case study, or post being linked to — adding a resource never requires editing existing content files. Both directions render from that one declaration — see [`.claude/content/resource-guide.md`](.claude/content/resource-guide.md).

### Figures and Composite Resources

Diagrams are authored as **figures**, one per file in `_figures/<id>.html` (front matter `title`, `kind`, `system`, `summary`, then one `<svg>`). A **composite resource** lists figure ids under `figures:` and the resource layout renders them, each anchored as `#fig-<id>`. Figures never link to the pages that use them. Guides embed a figure in full with `{% include figure.html id="<id>" %}`. There is one embed mode, with no buttons, modal, or script. Never copy a figure's SVG into a page. Adding a figure to a composite never touches its `description` or `tags`. Those state the composite's scope, and the `figures:` list is the inventory (`.figcheck.py` fails a composite description over 250 characters or more than 6 tags). Run `python .figcheck.py` after adding or embedding a figure. Validate each figure's geometry with `python .svgcheck.py _figures/<id>.html`, then look at it with `python .figrender.py <id>` (a headless-Chrome screenshot). Full rules: [`.claude/content/figure-guide.md`](.claude/content/figure-guide.md).

For the Lookup Test (deciding whether content qualifies as a resource), quality standards, and organization guidance, see [`.claude/content/resource-guide.md`](.claude/content/resource-guide.md).

## Learning Paths

Ordered routes through existing content toward a goal, at `/learning-paths.html` and `/learning-paths/<id>.html`. Each step is a site URL plus a "why" line. Full rules: [`.claude/content/learning-path-guide.md`](.claude/content/learning-path-guide.md).

- **Files:** `_learning_paths/<id>.md` (the whole path in front matter, sorted by `order`, no config file), `_layouts/learning-path.html`, `_layouts/learning-paths.html`, `_includes/learning-path-stats.html` (step count, reading time, categories crossed), `_sass/_learning-paths.scss`, `pages/learning-paths.md`.
- **Every stage ends with a checkpoint** (`can`, `try`, optional `exit: true`): what the stage gave the reader and one task on their own work. `pathcheck` requires it. A `prerequisite` renders as a "Start with" link in the path header.
- **Paths are isolated.** A path points to pages; no page points back. Never add path links, "part of this path" notes, or path-aware navigation to guide, resource, case study, or post layouts or content.
- **Moving or deleting content means running `python .pathcheck.py`.** It resolves every step URL and checks the authoring rules. A step that doesn't resolve also renders as a visible "Missing step".
- **No reader state.** The path page is the navigation, and its step links open in a new tab so it stays open while the reader wanders. Step anchors (`#step-7`) and the browser's own `:visited` color are the only "progress", and the site stores nothing.
- The design history and the candidate path catalogue are in `_drafts/learning-paths-plan.md`.

## What's New Stack

A header button (sparkle icon, next to the shelf bookmark) opens a panel listing the latest additions and revisions. Data lives in `assets/data/whats_new.yml` and renders through `_includes/whats-new-panel.html`.

- **No dates, order only.** Newest first, capped at 10. When you add an entry at the top, delete the bottom one.
- **Add an entry when you publish something a returning reader should know about:** a new post, guide, or resource, or a substantive refinement pass over a block of guides (one entry per pass, not per file). Skip mechanical changes like link moves or front-matter fixes.
- **No reader tracking.** The panel is static: no badge, no seen/unseen state, nothing written to the reader's browser. Keep it that way.
- A revision pass links to the filtered listing, e.g. `/study-guides.html?category=<slugified category>`.

## Site Search

Full-text search over every guide, post, resource, and case study, from a magnifier button in the header (or `/`). It has no search page. [Pagefind](https://pagefind.app) indexes the rendered HTML after `jekyll build`. The deploy workflow runs it as the `Build search index` step, pinned to an exact version, and fails the build if fewer than 450 pages are indexed.

- **Files:** `_includes/search-panel.html` (the panel, in the shelf-panel shell), `assets/js/site-search.js` (search, rendering, tabs, keyboard), `_sass/_search.scss`. The Pagefind runtime loads on the first query, never on page load. Nothing about queries is stored or sent (the no-tracking rule).
- **Every content layout needs the markup.** `data-pagefind-body` on the content wrapper, `data-pagefind-meta="title"` on its `<h1>`, `data-pagefind-filter="type:<Type>"` for the type tabs, and `data-pagefind-ignore` on chrome inside the wrapper (breadcrumbs, badges, TOC, share, footers, prev/next). Once any page has `data-pagefind-body`, pages without it are skipped. A new layout without the markup silently drops out of search. The title meta is required because the site header's logo is an `<h1>`, and Pagefind would take it as every page's title.
- **Local preview:** `bundle exec jekyll build`, then the `npx pagefind` command above. `_config.yml`'s `keep_files` keeps `_site/pagefind/` across `jekyll serve` regenerations, but the index reflects content as of the last Pagefind run.
- **Pagefind quirks the script works around:**
  - A word with no match falls back to shorter prefixes ("kanban" matched a lone "k"); `isRealMatch` drops those results.
  - Search responses carry no per-type counts until `pagefind.filters()` has run once.
  - Without a title weight (`metaWeights`), pages that repeat a term in code outrank the page about it.
  - "route53" misses content that writes "Route 53", so letter+digit words also run as an exact spaced phrase (`splitVariant`, `searchPhrase`).
- **Headless testing:** Chrome's `--dump-dom` and `--screenshot` don't wait for Pagefind's fetches and WASM, so results look missing. Drive Chrome over the DevTools protocol with a real wait instead.

## Tech Radar

The site includes an interactive tech radar feature built with D3.js:
- **Data Source**: `assets/data/radar-data.json` contains all radar entries
- **Visualization**: Uses Zalando's tech radar visualization library
- **Data Structure**:
  - 4 quadrants: Languages & Frameworks, Platforms, Techniques, Tools
  - 4 rings: ADOPT, TRIAL, ASSESS, HOLD
  - Each entry includes: id, label, quadrant, ring, moved status, and description
- **Features**: Dual view (radar/list), clickable items with detail modals, responsive design

### Updating the Tech Radar

To add/modify radar entries, edit `assets/data/radar-data.json`:
- Quadrants are indexed 0-3
- Rings are indexed 0-3 (0=ADOPT, 1=TRIAL, 2=ASSESS, 3=HOLD)
- Movement indicators: 0=no change, 1=moved in, -1=moved out, 2=new entry

## Site Configuration

- **Site**: Lucent Owl — `https://lucentowl.com`
- Uses kramdown markdown processor
- Configured for GitHub Pages deployment via github-pages gem
- Theme: Custom CSS with CSS variables; Luna Owl color palette (deep sky blue `#1A5F8A`)

### Link Behavior

**Blog posts are the exception**: they contain no inline links at all, external or internal. Their URLs live in `sources` front matter (see Blog Post Format).

**Everywhere else, links that should open in new tabs must be explicitly marked** using Kramdown's inline attribute syntax:

**For external links** (or any link that should open in a new tab):
```markdown
[Link Text](https://example.com){:target="_blank" rel="noopener noreferrer"}
```

**For internal links** (default behavior, stays in same tab):
```markdown
[Link Text](/study-guides/some-guide.html)
```

Always include `rel="noopener noreferrer"` with `target="_blank"` to prevent security vulnerabilities.

### Liquid and Code Samples

**Jekyll runs Liquid before Markdown, so backticks and fenced code blocks give no protection.** Any `{{ ... }}` or `{% ... %}` in a guide is evaluated as a template tag. This bites hardest on GitHub Actions (`${{ secrets.X }}`), Azure Pipelines (`${{ ... }}`), AWS Systems Manager (`{{serviceName}}`), and any mustache-style templating.

The failure mode is usually silent. Invalid Liquid produces a build warning, but *valid* Liquid — which `${{ secrets.AZURE_CLIENT_ID }}` is — resolves to an empty string and publishes as `client-id: $` with no warning at all. Never assume a clean build means the code samples survived.

**Fix:** wrap the whole document body in `{% raw %}` / `{% endraw %}` — `{% raw %}` on the line right after the closing front-matter `---`, `{% endraw %}` as the last line. See `_guides/developer-tools/github-actions.md`. Guides contain no intentional Liquid, so a whole-document wrap is safe and catches future additions too. Raw blocks cannot nest: if a file already has inline `{% raw %}` pairs, remove them before wrapping.

To audit, search content for `{{` and `{%` outside `pages/` (where Liquid *is* intentional) and confirm each hit sits inside a raw block.

## Best Practices

### When Working with Code
- Always read files before editing to understand context
- Maintain consistent formatting and indentation
- Test changes locally with `bundle exec jekyll serve` before committing
- Keep radar data JSON properly formatted and validated

### Code Examples
- **Default to C# for programming examples** unless the subject is language-specific
- Use the appropriate language when the topic requires it (e.g., Terraform uses HCL, CloudFormation uses YAML/JSON, Python for data science)

### Content Discovery Features

**Tagging system** (implemented):
- Tags enable cross-category discovery (e.g., find all "decision-making" content regardless of category)
- Tag policy (5-7 tags, one skill level, specific nouns over category filler) and the cross-cutting vocabulary are in [`.claude/content/study-guide-guide.md`](.claude/content/study-guide-guide.md)
- Blog posts already have tags in place

**Filtering UI** (planned):
- Client-side JavaScript filtering for study guides page (filter by category, subcategory, tags)
- Client-side JavaScript filtering for blog page (filter by tags)
- Optional: Unified "Browse by Tag" page showing all content with specific tags
- No backend required; filters operate on existing JSON data and front matter

## Maintaining This File

**IMPORTANT**: Claude Code should proactively keep this CLAUDE.md file up to date during conversations.

### When to Update CLAUDE.md

Update this file whenever:
1. **New patterns emerge** — architectural patterns, naming conventions, or project-specific approaches discovered during a session
2. **Project structure changes** — new directories, major file reorganizations, or build process changes
3. **Common tasks are repeated** — if the same task is performed multiple times, document it as a standard procedure
4. **Important decisions are made** — architecture choices, technology selections, or design patterns adopted
5. **Gotchas are discovered** — edge cases, quirks, or common mistakes to avoid
6. **Dependencies change** — new gems, plugins, or significant configuration updates

Writing standards and content guidelines belong in the `.claude/content/` guides, not here.

### Session Management

At the end of substantial work sessions:
1. Review what was accomplished
2. Identify any new patterns or learnings that would benefit future sessions
3. Proactively ask if CLAUDE.md or a content guide should be updated with these learnings
4. Commit the changes if significant

### What NOT to Include

- Temporary or session-specific information
- Highly detailed implementation notes (use code comments instead)
- User-specific preferences (unless they're project standards)
- Writing standards and content quality rules (those belong in `.claude/content/`)
- Duplicate information already covered elsewhere in the file
