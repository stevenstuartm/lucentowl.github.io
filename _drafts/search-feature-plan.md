# Site Search — Feature Plan

Full-text search across guides, posts, resources, and case studies, so a reader can find a concept that is buried inside a guide body rather than surfaced in its title or tags.

**Background research lives in [`SEARCH-FEATURE-RESEARCH.md`](SEARCH-FEATURE-RESEARCH.md).** It covers the problem, why Pagefind over Lunr.js or a metadata-only index, and six trade-offs. This plan carries the decisions and the work; it does not repeat the research.

## Status

Planning. No implementation started. Decisions below carry a recommendation each; the prototype confirms or overturns them.

## Scope

Corpus as of 2026-09-25: 383 guides, 31 posts, 56 resources, 10 case studies — about 480 pages.

## Goals

- A reader can find a term that appears only in a guide body, such as "outbox pattern" or "RPO", in one query.
- A result for a long guide lands on the matching section, not the top of a 40-minute read.
- Zero authoring tax: the index is generated from rendered HTML, never curated by hand. New content is indexed because of its layout, not because anyone remembered to do something.
- No cost on pages that don't search. The search runtime loads only when a reader starts a search.
- No per-reader state and no query tracking. Queries are not stored in the browser or sent anywhere.

## Non-goals

- AI or natural-language "ask the site" answers. They need a backend and running cost, and they conflict with the static, curated nature of the site.
- Replacing `content-filter.js` on the listing pages. Filtering a listing and searching the corpus are different jobs.
- Search suggestions, spelling correction, or synonyms beyond what Pagefind provides out of the box.
- Search analytics, including a GA4 event for zero-result queries. It would send query text to Google, which crosses the no-tracking line even when aggregated. Revisit only as a deliberate decision, not as a follow-on task.

## Approach

Pagefind, run as a post-build step in [`.github/workflows/jekyll.yml`](../.github/workflows/jekyll.yml), between `Build with Jekyll` and `Upload artifact`. It indexes `_site/` and writes its bundle into `_site/pagefind/`.

### How indexing scope works

Once any page carries `data-pagefind-body`, Pagefind indexes only pages that carry it and skips every other page. So scope is set by the four content layouts and nothing else:

- Listing pages, tech radar, home, about, and author pages are excluded without any markup on them.
- A new page in one of the four collections is indexed automatically. A new layout is not, until it gets the attribute.
- The header, footer, shelf panel, and What's New panel sit outside the content wrapper, so they need no ignore markup.

What does need `data-pagefind-ignore` is the chrome *inside* each layout's wrapper. From the current layouts:

| Layout | Wrapper | Inside the wrapper, to ignore |
|---|---|---|
| `guide.html` | `<article class="guide">` | breadcrumb, reading-time badges, TOC toggle and `aside.guide-toc`, `.guide-share`, `footer.guide-footer` |
| `post.html` | see note below | breadcrumb, post meta, badges, TOC, `.post-share`, `footer.post-footer` |
| `resource.html` | `<article class="resource">` | breadcrumb, last-updated line, header tag links, `.guide-share`, `footer.resource-footer` |
| `case-study.html` | `<article class="case-study">` | breadcrumb, meta line, tech tags, badges, TOC, `.case-study-share` |

**Post layout note.** In `post.html` the title `<h1>` sits in a `page-header-card` *before* `<article class="post">`, unlike the other three layouts. Putting the attribute on the article would drop the title from the indexed body. Either wrap the header and article in one element that carries the attribute, or mark the `<h1>` with `data-pagefind-meta="title"` and confirm in the prototype that Pagefind picks it up from outside the body.

## Decisions

Each has a recommendation. Settle 1–3 before Phase 2; 4–5 come out of the query test log.

1. **Where search lives.** *Recommended: a header button that opens a panel, matching the shelf and What's New buttons, plus a `/search.html` page.* The earlier trade-off (panel is discoverable but loads the runtime everywhere) goes away if the panel imports Pagefind on first open instead of on page load, so every page pays for one button and nothing else. The page is still worth having: Phase 1 needs it for the prototype, it gives a full-width results view, and `?q=` makes a search linkable. The panel's "see all results" links to it.
2. **Default UI or custom.** *Recommended: Default UI for the prototype and the page; decide the panel after.* The Default UI is themed through its own CSS custom properties, which can map onto the site's variables in both light and dark mode, so restyling is a stylesheet, not a rewrite. If the panel needs markup the Default UI can't produce inside the existing panel shell, build it on the JS API instead. Don't commit to the JS API up front.
3. **Figures.** *Recommended: ignore SVG content, keep the figure title and summary.* SVG text labels are fragments ("Queue", "Worker", "retry") that match many queries and explain none of them. The figure's title and summary, rendered by `_includes/figure.html`, are plain sentences about what the diagram shows and should stay indexed. Put `data-pagefind-ignore` on the `<svg>` in `figure.html`, one change covering every figure.
4. **Facets.** *Recommended: content type (Guide / Post / Resource / Case Study) and category.* Guides and resources both have a `category` from the same config, so one category facet covers both. Posts and case studies have none and sit under type alone. Skip tags as a facet: at ~480 pages the tag list is too long to scan, and the listing pages already filter by tag.
5. **Ranking weights.** Pagefind already weights headings above body text by default; confirm in the prototype rather than adding weights up front. The open question is whether guides should outrank posts. Leave them equal unless the query log shows posts crowding out the guide a reader wanted.
6. **Running Pagefind in CI.** *Recommended: `npx -y pagefind@<pinned version> --site _site`.* The `ubuntu-latest` runner ships Node, so this adds no setup step; pinning the exact version removes the "version bump breaks deploy" risk from the research. The Python wrapper would also work (Python is preinstalled too) but has no advantage here, and npx matches every Pagefind example.
7. **Local development.** `jekyll serve` rebuilds `_site/` and deletes anything Jekyll didn't write, including `_site/pagefind/`. Two parts:
   - Add `keep_files: [pagefind]` to `_config.yml` so a regeneration doesn't wipe the index.
   - Document the preview command in CLAUDE.md: `bundle exec jekyll build`, then `npx -y pagefind@<pinned version> --site _site --serve`, the same version the workflow pins. Pagefind's own server is enough for checking search; the index won't reflect edits made after the build, which is fine for a preview.

## Work outline

### Phase 1 — Prototype (local only)

- Add `data-pagefind-body` and the ignore markup per the table above, including the post-layout title fix.
- Add `data-pagefind-ignore` to the `<svg>` in `_includes/figure.html`.
- Stand up `/search.html` with the Default UI, unstyled.
- Build, index, and serve locally. Check Pagefind's page count against the corpus (~480). A big gap means a layout is missing the attribute.
- Spot-check three indexed pages in the Pagefind result excerpts: no breadcrumb, TOC, share, or reading-time text leaking into excerpts.
- Run the query test log. Include:
  - buried concepts (terms only in a guide body),
  - title matches,
  - ambiguous terms that appear in dozens of guides ("latency", "idempotent", "cache"),
  - acronyms and their expansions ("RPO" and "recovery point objective"),
  - terms that appear in code samples only.
- Confirm sub-results: a query for a section heading in a long guide returns a result that links to that section's anchor. Kramdown generates heading ids, so this should work without markup.

**Gate:** buried-concept queries land the right guide on the first page of results, and sub-results link to the right section. If buried concepts fail, stop and reconsider before any styling work.

### Phase 2 — Build and style

- Add facet attributes (`data-pagefind-filter`) for type and category.
- Theme the Default UI on `/search.html` with the site's CSS variables in light and dark mode, usable at phone width.
- Build the header button and panel, lazy-loading Pagefind on first open. Match the shelf and What's New panels' open/close, focus, and Escape behavior.
- Apply ranking changes only if the query log calls for them. Re-run the log after.

### Phase 3 — Ship

- Add the Pagefind step to the deploy workflow with an exact pinned version (`pagefind@1.x.y`, never a range or `latest`). A failed indexing step fails the build.
- Guard against a silent failure: if the indexed page count drops below a floor (say 400), fail the step. An exit code of 0 with 30 pages indexed is the likely real-world failure, after a layout refactor drops the attribute.
- Add `keep_files: [pagefind]` to `_config.yml`.
- Update CLAUDE.md: an architecture entry, the local preview command, and a note that new content layouts need `data-pagefind-body`.
- Add a What's New entry.

## Query test log

| Query | Expected top result | Actual | Notes |
|---|---|---|---|
| | | | |

## Resolved

- **`{% raw %}` wrapping.** No effect on indexing. Raw blocks are consumed by Liquid at build time and leave nothing in the rendered HTML, which is all Pagefind reads.
- **Deep-linking to headings.** Promoted from an open question to a goal and a Phase 1 gate check. At this guide length it may be the most useful part of the feature.
