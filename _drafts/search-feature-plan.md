# Site Search — Feature Plan

Full-text search across guides, posts, resources, and case studies, so a reader can find a concept that is buried inside a guide body rather than surfaced in its title or tags.

**Background research lives in [`SEARCH-FEATURE-RESEARCH.md`](SEARCH-FEATURE-RESEARCH.md).** It covers the problem, why Pagefind over Lunr.js or a metadata-only index, and six trade-offs. This plan carries the decisions and the work; it does not repeat the research.

## Status

Planning. No implementation started.

## Goals

- A reader can find a term that appears only in a guide body, such as "outbox pattern" or "RPO", in one query.
- Zero authoring tax: the index is generated from rendered HTML, never curated by hand.
- No cost on pages that don't search. Only the search UI loads the search runtime.
- No per-reader state. Queries are not stored in the browser. The site's no-tracking rule applies.

## Non-goals

- AI or natural-language "ask the site" answers. They need a backend and running cost, and they conflict with the static, curated nature of the site.
- Replacing `content-filter.js` on the listing pages. Filtering a listing and searching the corpus are different jobs.
- Search suggestions, spelling correction, or synonyms beyond what Pagefind provides out of the box.

## Approach

Pagefind, run as a post-build step in [`.github/workflows/jekyll.yml`](../.github/workflows/jekyll.yml), between `Build with Jekyll` and `Upload artifact`. It indexes `_site/` and writes its bundle into `_site/pagefind/`.

## Decisions to make

1. **Where search lives.** Options: a dedicated `/search.html` page; a header button that opens a panel, matching the shelf and What's New panels; or both, with the panel deep-linking to the page for full results. The header panel is the most discoverable. The page is simpler and keeps the runtime off every other page.
2. **Default UI or custom.** Pagefind's Default UI is fast to ship but must be restyled to the site's CSS variables and dark mode. The Modular UI or the raw JS API gives full control over markup at more cost.
3. **What gets indexed.** Proposed: guide, post, resource, and case-study bodies. Excluded: listing pages, tech radar, home, about, author pages. Figures have no pages of their own but render inside guides and resources; decide whether SVG text labels should be indexed or ignored.
4. **Facets.** Proposed: content type (Guide / Post / Resource / Case Study) and guide category. Tags as a facet may be too noisy at ~390 guides; decide after the prototype.
5. **Ranking weights.** Title and headings above body text. Decide whether guides outrank posts by default.
6. **Node in CI.** Pin the Pagefind version, or run it via its Python wrapper to avoid adding a Node step. Check which is less fragile.
7. **Local development.** How to preview search with `jekyll serve`, which doesn't run Pagefind. Likely a documented one-off command against `_site/`, added to CLAUDE.md's Development Commands.
8. **Zero-result signal.** Whether to fire a GA4 event on queries with no results. It's aggregate and not per-reader, but confirm it sits within the no-tracking rule before building it.

## Work outline

### Phase 1 — Prototype (local only)

- Run Pagefind locally against a fresh `_site/` build.
- Add `data-pagefind-body` to the content wrapper in the `guide`, `post`, `resource`, and `case-study` layouts. Mark nav, TOC, related links, shelf/What's New panels, and prev/next navigation as ignored.
- Stand up a bare search page with the Default UI.
- Test relevance with 15–20 real queries: some buried concepts, some title matches, some ambiguous terms that appear in many guides. Record results in this doc.

**Gate:** proceed only if buried-concept queries land the right guide on the first page of results.

### Phase 2 — Build and style

- Settle decisions 1–5.
- Build the chosen UI, themed with the site's CSS variables in light and dark mode, and usable at phone width.
- Add facet attributes and ranking weights.

### Phase 3 — Ship

- Add the Pagefind step to the deploy workflow. Confirm a failed indexing step fails the build loudly, not silently.
- Update CLAUDE.md: architecture entry, the local preview command, and a note that new layouts need `data-pagefind-body`.
- Add a What's New entry.

## Query test log

| Query | Expected top result | Actual | Notes |
|---|---|---|---|
| | | | |

## Open questions

- Should a search result deep-link to the matching heading inside a guide? Pagefind supports sub-results by heading, which could be the best feature of the whole thing at this guide length.
- Does the `{% raw %}` wrapping in some guides affect rendered output in any way that matters for indexing? Expected no, but confirm during the prototype.
