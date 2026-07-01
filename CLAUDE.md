# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Content Writing Standards

**Before writing or reviewing any site content**, read the relevant guide in `.claude/content/`:

| Guide | When to use |
| --- | --- |
| [`writing-standards.md`](.claude/content/writing-standards.md) | **Always** — universal linter rules, voice, flow, punctuation, bullet point usage |
| [`blog-post-guide.md`](.claude/content/blog-post-guide.md) | Writing or editing blog posts, creating social media summaries |
| [`study-guide-guide.md`](.claude/content/study-guide-guide.md) | Writing or editing study guides — format, tagging, organization, quality standards |
| [`resource-guide.md`](.claude/content/resource-guide.md) | Writing or editing resources — format, cross-linking, quality standards |

After drafting content, run `python lint_content.py <filepath>` to catch mechanical violations.

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
```

## Architecture

### Jekyll Structure
- **_config.yml**: Site configuration, author info, social links, and build settings
- **_layouts/**: HTML templates that wrap content
  - `default.html`: Base template with header/footer includes
  - `home.html`: Homepage layout (extends default) with recent posts section
  - `post.html`: Blog post template with metadata, tags, and author byline
  - `page.html`: Generic page template
  - `radar.html`: Tech radar page template with D3.js visualization
  - `guide.html`: Study guide template with table of contents
  - `guides.html`: Study guides listing page template
  - `blog-listing.html`: Blog listing page template
  - `author.html`: Author page template (avatar, bio, social links, post list)
  - `case-study.html`: Case study template with author byline
- **_includes/**: Reusable HTML partials (header.html, footer.html)
- **_posts/**: Blog posts in Markdown with YAML front matter (format: YYYY-MM-DD-title.md)
- **_guides/**: Study guides in Markdown organized by topic
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
- **`_data/authors.yml`**: Author records (name, bio, avatar, social links)
- **`_layouts/author.html`**: Author page template — avatar, bio, social links, post list
- **`_includes/author-byline.html`**: Compact byline for post/case-study headers
- **`_includes/social-links.html`**: Author-scoped; requires `author` param, reads from `_data/authors.yml`
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

For format details, tag vocabulary, configuration requirements, organization patterns, and quality standards, see [`.claude/content/study-guide-guide.md`](.claude/content/study-guide-guide.md).

### Resource Format

Resources are standalone reference artifacts (tables, cheatsheets, diagrams, code, charts) — not long-form learning content.

All resources must:
- Be placed in `_resources/` (flat directory — no subdirectories)
- Include YAML front matter with: layout, title, type, description, last_updated, and tags
- Use `layout: resource`

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

**Valid types:** `cheatsheet`, `diagram`, `table`, `chart`, `code`

**`last_updated`**: date the resource content was last substantively edited (`YYYY-MM-DD`, unquoted). Update this whenever you revise an existing resource's content. It renders on the resource page and on its listing card.

**Optional fields:** `related_guides` and `related_posts` — arrays of site-relative URLs. Titles are resolved automatically from Jekyll's `site.guides` and `site.posts` collections at build time.

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

**Links that should open in new tabs must be explicitly marked** using Kramdown's inline attribute syntax:

**For external links** (or any link that should open in a new tab):
```markdown
[Link Text](https://example.com){:target="_blank" rel="noopener noreferrer"}
```

**For internal links** (default behavior, stays in same tab):
```markdown
[Link Text](/study-guides/some-guide.html)
```

Always include `rel="noopener noreferrer"` with `target="_blank"` to prevent security vulnerabilities.

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
- All 105+ study guides have been tagged with 4-8 tags each
- Tags enable cross-category discovery (e.g., find all "decision-making" content regardless of category)
- Tag vocabulary is standardized — see [`.claude/content/study-guide-guide.md`](.claude/content/study-guide-guide.md) for the full vocabulary
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
